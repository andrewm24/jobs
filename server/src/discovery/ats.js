// Adapters for public ATS job-board APIs. Each returns normalized postings:
// { company, title, location, url, jd }

const JD_MAX = 8000;

async function getJSON(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "job-ops-personal-tracker" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

const ENTITIES = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

function htmlToText(html) {
  if (!html) return "";
  let text = html.replace(/&(lt|gt|amp|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? " ");
  text = text
    .replace(/<(br|\/p|\/li|\/div|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
  return text.slice(0, JD_MAX);
}

async function fetchGreenhouse(company) {
  const data = await getJSON(
    `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs?content=true`
  );
  return (data.jobs ?? []).map((j) => ({
    company: company.name,
    title: j.title ?? "",
    location: j.location?.name ?? "",
    url: j.absolute_url ?? "",
    jd: htmlToText(j.content),
  }));
}

async function fetchLever(company) {
  const data = await getJSON(`https://api.lever.co/v0/postings/${company.slug}?mode=json`);
  return (Array.isArray(data) ? data : []).map((j) => ({
    company: company.name,
    title: j.text ?? "",
    location: j.categories?.location ?? "",
    url: j.hostedUrl ?? "",
    jd: (j.descriptionPlain ?? "").slice(0, JD_MAX),
  }));
}

async function fetchAshby(company) {
  const data = await getJSON(
    `https://api.ashbyhq.com/posting-api/job-board/${company.slug}?includeCompensation=false`
  );
  return (data.jobs ?? [])
    .filter((j) => j.isListed !== false)
    .map((j) => ({
      company: company.name,
      title: j.title ?? "",
      location: [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)]
        .filter(Boolean)
        .join("; "),
      url: j.jobUrl ?? j.applyUrl ?? "",
      jd: htmlToText(j.descriptionHtml ?? ""),
    }));
}

const ADAPTERS = { greenhouse: fetchGreenhouse, lever: fetchLever, ashby: fetchAshby };

export function fetchCompanyPostings(company) {
  const adapter = ADAPTERS[company.ats];
  if (!adapter) throw new Error(`unknown ATS: ${company.ats}`);
  return adapter(company);
}
