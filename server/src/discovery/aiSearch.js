import * as db from "../db.js";
import { planAiSearch, scoreFit } from "../claude.js";
import { fetchCompanyPostings } from "./ats.js";
import { dedupeHash, prefilter, norm } from "./scan.js";

const SCORE_CONCURRENCY = 4;

export async function runAiJobSearch(userQuery = "") {
  const profile = db.getProfile();
  const settings = db.getSettings();

  // 1. AI Agent generates targeted company ATS list & title keywords based on profile & query
  const plan = await planAiSearch(userQuery, profile.text);
  const targetCompanies = plan.targetCompanies || [];
  const titleKeywords = (plan.titleKeywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean);

  const results = {
    query: userQuery,
    searchFocus: plan.searchFocus || "AI Targeted Search",
    companiesSearched: targetCompanies.length,
    fetchedCount: 0,
    newCount: 0,
    scoredCount: 0,
    belowThresholdCount: 0,
    errors: [],
    topMatches: [],
  };

  if (!targetCompanies.length) {
    results.errors.push("AI search strategy generated no target companies.");
    return results;
  }

  // 2. Fetch postings from all AI-targeted companies concurrently
  const rawPostings = [];
  const outcomes = await Promise.allSettled(
    targetCompanies.map(async (comp) => {
      try {
        const found = await fetchCompanyPostings({ name: comp.name, ats: comp.ats, slug: comp.slug });
        found.forEach((p) => (p.source = `ai:${comp.ats}`));
        return found;
      } catch (err) {
        // Log individual company fetch errors silently without breaking the search
        return [];
      }
    })
  );

  for (const outcome of outcomes) {
    if (outcome.status === "fulfilled" && Array.isArray(outcome.value)) {
      rawPostings.push(...outcome.value);
    }
  }

  results.fetchedCount = rawPostings.length;

  // 3. Filter postings by title keywords if specified by AI
  let filtered = rawPostings;
  if (titleKeywords.length > 0) {
    filtered = rawPostings.filter((p) => {
      const title = norm(p.title);
      return titleKeywords.some((k) => title.includes(k));
    });
  }

  // Also apply standard user settings filters (include/exclude keywords)
  filtered = prefilter(filtered, settings);

  // 4. Skip postings that already exist in pipeline jobs
  const jobKeys = new Set(db.listJobs().map((j) => `${norm(j.company)}|${norm(j.role)}`));
  const newPostingsToScore = [];

  for (const p of filtered) {
    const key = `${norm(p.company)}|${norm(p.title)}`;
    if (jobKeys.has(key)) continue;
    const pId = dedupeHash(p);
    const isNew = db.insertPosting({ ...p, id: pId });
    if (isNew) {
      results.newCount++;
      newPostingsToScore.push({ ...p, id: pId });
    }
  }

  // 5. Score newly discovered postings against candidate profile
  if (profile.text.trim()) {
    const minScore = Number(settings.min_score) || 6;
    for (let i = 0; i < newPostingsToScore.length; i += SCORE_CONCURRENCY) {
      const chunk = newPostingsToScore.slice(i, i + SCORE_CONCURRENCY);
      await Promise.allSettled(
        chunk.map(async (posting) => {
          try {
            const { score, reason } = await scoreFit(profile.text, posting, settings);
            db.setPostingScore(posting.id, score, reason);
            results.scoredCount++;
            if (score >= minScore) {
              results.topMatches.push({ ...posting, score, reason });
            } else {
              db.setPostingState(posting.id, "filtered");
              results.belowThresholdCount++;
            }
          } catch (err) {
            results.errors.push(`Scoring failed for ${posting.title}: ${err.message}`);
          }
        })
      );
    }
  }

  // Sort top matches by highest fit score first
  results.topMatches.sort((a, b) => (b.score || 0) - (a.score || 0));

  return results;
}
