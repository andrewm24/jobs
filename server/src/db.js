import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// JOBOPS_DB_PATH lets tests (and Docker volumes) point at a specific database file.
const dbPath = process.env.JOBOPS_DB_PATH || path.join(here, "..", "data", "jobops.db");
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    text TEXT NOT NULL DEFAULT '',
    json_data TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    link TEXT DEFAULT '',
    jd TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Saved',
    created TEXT NOT NULL,
    ai TEXT NOT NULL DEFAULT '{}',
    source TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ats TEXT NOT NULL CHECK (ats IN ('greenhouse', 'lever', 'ashby')),
    slug TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
  CREATE TABLE IF NOT EXISTS postings (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT DEFAULT '',
    url TEXT DEFAULT '',
    source TEXT NOT NULL,
    jd TEXT DEFAULT '',
    discovered_at TEXT NOT NULL,
    score REAL,
    reason TEXT,
    state TEXT NOT NULL DEFAULT 'new'
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS answers_map (
    question TEXT PRIMARY KEY,
    answer TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    type TEXT NOT NULL,
    from_stage TEXT,
    to_stage TEXT,
    at TEXT NOT NULL,
    meta TEXT
  );
  CREATE TABLE IF NOT EXISTS usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    model TEXT NOT NULL,
    kind TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0
  );
`);

// Migrate databases created before the structured-resume column existed.
// Must run before seeding, since the seed row relies on the column's default.
for (const stmt of [
  "ALTER TABLE profile ADD COLUMN json_data TEXT NOT NULL DEFAULT '{}'",
  "ALTER TABLE jobs ADD COLUMN source TEXT DEFAULT ''",
]) {
  try {
    db.exec(stmt);
  } catch (e) {
    // Column already exists — nothing to migrate.
  }
}

db.exec("INSERT OR IGNORE INTO profile (id, text) VALUES (1, '')");

// Pre-seed top engineering internship company targets
const SEED_COMPANIES = [
  { name: "Anthropic", ats: "ashby", slug: "anthropic" },
  { name: "Anduril Industries", ats: "greenhouse", slug: "andurilindustries" },
  { name: "Scale AI", ats: "greenhouse", slug: "scaleai" },
  { name: "Palantir", ats: "lever", slug: "palantir" },
  { name: "Stripe", ats: "greenhouse", slug: "stripe" },
  { name: "OpenAI", ats: "greenhouse", slug: "openai" },
  { name: "Databricks", ats: "greenhouse", slug: "databricks" },
  { name: "Relativity Space", ats: "greenhouse", slug: "relativityspace" },
  { name: "Astranis", ats: "greenhouse", slug: "astranis" },
  { name: "Figma", ats: "greenhouse", slug: "figma" },
  { name: "Linear", ats: "ashby", slug: "linear" },
  { name: "Shield AI", ats: "greenhouse", slug: "shieldai" },
  { name: "Cloudflare", ats: "greenhouse", slug: "cloudflare" },
  { name: "Ramp", ats: "greenhouse", slug: "ramp" },
  { name: "Robinhood", ats: "greenhouse", slug: "robinhood" },
];

const seedStmt = db.prepare("INSERT OR IGNORE INTO companies (name, ats, slug) VALUES (?, ?, ?)");
for (const c of SEED_COMPANIES) {
  seedStmt.run(c.name, c.ats, c.slug);
}

/* ---------------- events + usage (analytics, cost) ---------------- */

export function recordEvent(jobId, type, fromStage, toStage, meta) {
  db.prepare(
    "INSERT INTO events (job_id, type, from_stage, to_stage, at, meta) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(jobId, type, fromStage ?? null, toStage ?? null, new Date().toISOString(), meta ? JSON.stringify(meta) : null);
}

export function listEvents() {
  return db.prepare("SELECT * FROM events ORDER BY at").all();
}

export function logUsage({ model, kind, input_tokens = 0, output_tokens = 0, cost = 0 }) {
  db.prepare(
    "INSERT INTO usage_log (at, model, kind, input_tokens, output_tokens, cost) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(new Date().toISOString(), model, kind, input_tokens, output_tokens, cost);
}

export function getSpend() {
  const all = db
    .prepare("SELECT COALESCE(SUM(cost), 0) c, COALESCE(SUM(input_tokens + output_tokens), 0) t FROM usage_log")
    .get();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const day = db.prepare("SELECT COALESCE(SUM(cost), 0) c FROM usage_log WHERE at >= ?").get(since);
  return { allTime: all.c, allTimeTokens: all.t, last24h: day.c };
}

const rowToJob = (row) => row && { ...row, ai: JSON.parse(row.ai) };

/* ---------------- profile ---------------- */

export function getProfile() {
  const row = db.prepare("SELECT text, json_data FROM profile WHERE id = 1").get();
  return {
    text: row?.text ?? "",
    json_data: row?.json_data ? JSON.parse(row.json_data) : {}
  };
}

export function setProfile(text, jsonData) {
  if (jsonData !== undefined) {
    db.prepare("UPDATE profile SET text = ?, json_data = ? WHERE id = 1").run(text, JSON.stringify(jsonData));
  } else {
    db.prepare("UPDATE profile SET text = ? WHERE id = 1").run(text);
  }
}

/* ---------------- jobs (pipeline) ---------------- */

export function listJobs() {
  return db
    .prepare("SELECT * FROM jobs ORDER BY created DESC")
    .all()
    .map(rowToJob);
}

export function getJob(id) {
  return rowToJob(db.prepare("SELECT * FROM jobs WHERE id = ?").get(id));
}

export function insertJob(job) {
  const status = job.status ?? "Saved";
  db.prepare(
    `INSERT INTO jobs (id, company, role, link, jd, notes, status, created, ai, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    job.id,
    job.company,
    job.role,
    job.link ?? "",
    job.jd ?? "",
    job.notes ?? "",
    status,
    job.created ?? new Date().toISOString(),
    JSON.stringify(job.ai ?? {}),
    job.source ?? ""
  );
  recordEvent(job.id, "created", null, status);
  return getJob(job.id);
}

const PATCHABLE = ["company", "role", "link", "jd", "notes", "status", "ai"];

export function updateJob(id, patch) {
  const existing = getJob(id);
  if (!existing) return null;
  for (const key of PATCHABLE) {
    if (!(key in patch)) continue;
    // M-2: Defense-in-depth — verify key is from the allowlist before SQL interpolation.
    if (!PATCHABLE.includes(key)) throw new Error(`updateJob: invalid column "${key}"`);
    const value = key === "ai" ? JSON.stringify(patch.ai ?? {}) : patch[key];
    db.prepare(`UPDATE jobs SET ${key} = ? WHERE id = ?`).run(value, id);
  }
  if ("status" in patch && patch.status !== existing.status) {
    recordEvent(id, "stage_change", existing.status, patch.status);
  }
  return getJob(id);
}

export function deleteJob(id) {
  db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  db.prepare("DELETE FROM events WHERE job_id = ?").run(id);
}

/* ---------------- companies (watchlist) ---------------- */

export function listCompanies() {
  return db
    .prepare("SELECT * FROM companies ORDER BY name COLLATE NOCASE")
    .all()
    .map((c) => ({ ...c, active: !!c.active }));
}

export function addCompany({ name, ats, slug }) {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO companies (name, ats, slug) VALUES (?, ?, ?)")
    .run(name.trim(), ats, slug.trim());
  return db.prepare("SELECT * FROM companies WHERE id = ?").get(lastInsertRowid);
}

export function addCompaniesBulk(list) {
  const existing = new Set(listCompanies().map((c) => c.slug.toLowerCase()));
  const added = [];
  for (const c of list ?? []) {
    if (!c.name?.trim() || !c.slug?.trim() || !["greenhouse", "lever", "ashby"].includes(c.ats)) continue;
    const slugNorm = c.slug.trim().toLowerCase();
    if (existing.has(slugNorm)) continue;
    try {
      const row = addCompany({ name: c.name.trim(), ats: c.ats, slug: slugNorm });
      added.push(row);
      existing.add(slugNorm);
    } catch (e) {
      // Ignore duplicates or constraint errors
    }
  }
  return added;
}

export function setCompanyActive(id, active) {
  db.prepare("UPDATE companies SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
}

export function deleteCompany(id) {
  db.prepare("DELETE FROM companies WHERE id = ?").run(id);
}

/* ---------------- settings ---------------- */

const SETTINGS_DEFAULTS = {
  include_keywords: "intern, co-op",
  exclude_keywords: "unpaid, senior, staff, phd",
  locations: "",
  min_score: "6",
  github_days: "14",
  github_repo: "",
  gen_model: "claude-opus-4-8",
  scoring_model: "claude-haiku-4-5",
  score_limit: "40",
  resume_template: "classic",
  resume_color: "navy",
  resume_font: "Helvetica",
};

export function getSettings() {
  const merged = { ...SETTINGS_DEFAULTS };
  for (const row of db.prepare("SELECT key, value FROM settings").all()) {
    merged[row.key] = row.value;
  }
  return merged;
}

export function setSettings(patch) {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key in SETTINGS_DEFAULTS) stmt.run(key, String(value));
  }
  return getSettings();
}

/* ---------------- postings (discovery inbox) ---------------- */

export function insertPosting(p) {
  const { changes } = db
    .prepare(
      `INSERT OR IGNORE INTO postings (id, company, title, location, url, source, jd, discovered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      p.id,
      p.company,
      p.title,
      p.location ?? "",
      p.url ?? "",
      p.source,
      p.jd ?? "",
      new Date().toISOString()
    );
  return changes > 0;
}

export function getPosting(id) {
  return db.prepare("SELECT * FROM postings WHERE id = ?").get(id);
}

// Inbox: fresh postings that scored above threshold, plus not-yet-scored ones
// (so the inbox is useful before an API key is configured). Scored first.
export function listInbox(minScore) {
  return db
    .prepare(
      `SELECT * FROM postings
       WHERE state = 'new' AND (score IS NULL OR score >= ?)
       ORDER BY score IS NULL, score DESC, discovered_at DESC`
    )
    .all(minScore);
}

export function unscoredPostings(limit) {
  return db
    .prepare(
      "SELECT * FROM postings WHERE state = 'new' AND score IS NULL ORDER BY discovered_at DESC LIMIT ?"
    )
    .all(limit);
}

export function setPostingScore(id, score, reason) {
  db.prepare("UPDATE postings SET score = ?, reason = ? WHERE id = ?").run(score, reason, id);
}

export function setPostingState(id, state) {
  db.prepare("UPDATE postings SET state = ? WHERE id = ?").run(state, id);
}

/* ---------------- answers_map ---------------- */

export function getAnswers() {
  const rows = db.prepare("SELECT question, answer FROM answers_map").all();
  const map = {};
  for (const row of rows) {
    map[row.question] = row.answer;
  }
  return map;
}

export function saveAnswer(question, answer) {
  db.prepare(
    "INSERT INTO answers_map (question, answer) VALUES (?, ?) ON CONFLICT(question) DO UPDATE SET answer = excluded.answer"
  ).run(question, answer);
}
