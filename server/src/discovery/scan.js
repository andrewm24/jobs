import { createHash } from "node:crypto";
import * as db from "../db.js";
import { scoreFit } from "../claude.js";
import { fetchCompanyPostings } from "./ats.js";
import { fetchGithubListings } from "./github.js";

const SCORE_CONCURRENCY = 4;

export const norm = (s) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const jobKey = (company, title) => `${norm(company)}|${norm(title)}`;

export function dedupeHash(p) {
  return createHash("sha256")
    .update(`${norm(p.company)}|${norm(p.title)}|${norm(p.location)}`)
    .digest("hex")
    .slice(0, 24);
}

const csv = (s) =>
  (s ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

export function prefilter(postings, settings) {
  const include = csv(settings.include_keywords);
  const exclude = csv(settings.exclude_keywords);
  const locations = csv(settings.locations);
  return postings.filter((p) => {
    const title = norm(p.title);
    if (!title) return false;
    if (include.length && !include.some((k) => title.includes(k))) return false;
    if (exclude.some((k) => title.includes(k))) return false;
    if (locations.length) {
      const loc = norm(p.location);
      if (loc && !loc.includes("remote") && !locations.some((k) => loc.includes(k))) return false;
    }
    return true;
  });
}

async function scoreNewPostings(settings, results) {
  const profile = db.getProfile();
  if (!profile.text.trim()) {
    results.notes.push("scoring skipped: profile is empty");
    return;
  }
  const minScore = Number(settings.min_score) || 6;
  const limit = Math.max(0, Number(settings.score_limit) || Number(process.env.SCORE_LIMIT) || 40);
  const queue = db.unscoredPostings(limit);
  for (let i = 0; i < queue.length; i += SCORE_CONCURRENCY) {
    const chunk = queue.slice(i, i + SCORE_CONCURRENCY);
    const outcomes = await Promise.allSettled(
      chunk.map(async (posting) => {
        const { score, reason } = await scoreFit(profile.text, posting, settings);
        db.setPostingScore(posting.id, score, reason);
        if (score < minScore) {
          db.setPostingState(posting.id, "filtered");
          results.belowThreshold++;
        }
        results.scored++;
      })
    );
    const failure = outcomes.find((o) => o.status === "rejected");
    if (failure) {
      // Auth/quota failures will hit every request — stop instead of burning the queue.
      results.errors.push(`scoring stopped: ${failure.reason?.message ?? failure.reason}`);
      return;
    }
  }
}

export async function runScan() {
  const settings = db.getSettings();
  const results = { fetched: 0, new: 0, scored: 0, belowThreshold: 0, errors: [], notes: [] };
  const postings = [];

  for (const company of db.listCompanies().filter((c) => c.active)) {
    try {
      const found = await fetchCompanyPostings(company);
      found.forEach((p) => (p.source = company.ats));
      postings.push(...found);
    } catch (err) {
      results.errors.push(`${company.name}: ${err.message}`);
    }
  }

  try {
    const listings = await fetchGithubListings(settings);
    listings.forEach((p) => (p.source = p.sourceDetail ?? "github"));
    postings.push(...listings);
  } catch (err) {
    results.errors.push(`github list: ${err.message}`);
  }

  results.fetched = postings.length;
  // Skip postings that already exist as pipeline jobs (accepted or added manually).
  const jobKeys = new Set(db.listJobs().map((j) => jobKey(j.company, j.role)));
  for (const p of prefilter(postings, settings)) {
    if (jobKeys.has(jobKey(p.company, p.title))) continue;
    if (db.insertPosting({ ...p, id: dedupeHash(p) })) results.new++;
  }

  await scoreNewPostings(settings, results);
  return results;
}
