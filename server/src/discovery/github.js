// SimplifyJobs community-maintained internship lists on GitHub — a structured
// listings.json updated continuously. Zero-config source: works with an empty
// company watchlist.

const CANDIDATE_REPOS = [
  "Summer2027-Internships",
  "Summer2026-Internships",
];

const rawUrl = (repo) =>
  `https://raw.githubusercontent.com/SimplifyJobs/${repo}/dev/.github/scripts/listings.json`;

export async function fetchGithubListings(settings) {
  const repos = settings.github_repo?.trim()
    ? [settings.github_repo.trim(), ...CANDIDATE_REPOS]
    : CANDIDATE_REPOS;
  const days = Math.max(1, Number(settings.github_days) || 14);
  const cutoff = Date.now() / 1000 - days * 86400;

  let lastError = null;
  for (const repo of repos) {
    try {
      const res = await fetch(rawUrl(repo), { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} for ${repo}`);
        continue;
      }
      const listings = await res.json();
      return listings
        .filter(
          (l) =>
            l.active !== false &&
            l.is_visible !== false &&
            (l.date_posted ?? l.date_updated ?? 0) >= cutoff
        )
        .map((l) => ({
          company: l.company_name ?? "",
          title: l.title ?? "",
          location: (l.locations ?? []).join("; "),
          url: l.url ?? "",
          jd: "",
          sourceDetail: `github:${repo}`,
        }));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("no SimplifyJobs listings repo reachable");
}
