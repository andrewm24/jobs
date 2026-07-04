import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "jobops.db"));

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
    ai TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ats TEXT NOT NULL CHECK (ats IN ('greenhouse', 'lever', 'ashby')),
    slug TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
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
`);

// Migrate databases created before the structured-resume column existed.
// Must run before seeding, since the seed row relies on the column's default.
try {
  db.exec("ALTER TABLE profile ADD COLUMN json_data TEXT NOT NULL DEFAULT '{}'");
} catch (e) {
  // Column already exists — nothing to migrate.
}

db.exec("INSERT OR IGNORE INTO profile (id, text) VALUES (1, '')");

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
  db.prepare(
    `INSERT INTO jobs (id, company, role, link, jd, notes, status, created, ai)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    job.id,
    job.company,
    job.role,
    job.link ?? "",
    job.jd ?? "",
    job.notes ?? "",
    job.status ?? "Saved",
    job.created ?? new Date().toISOString(),
    JSON.stringify(job.ai ?? {})
  );
  return getJob(job.id);
}

const PATCHABLE = ["company", "role", "link", "jd", "notes", "status", "ai"];

export function updateJob(id, patch) {
  const existing = getJob(id);
  if (!existing) return null;
  for (const key of PATCHABLE) {
    if (!(key in patch)) continue;
    const value = key === "ai" ? JSON.stringify(patch.ai ?? {}) : patch[key];
    db.prepare(`UPDATE jobs SET ${key} = ? WHERE id = ?`).run(value, id);
  }
  return getJob(id);
}

export function deleteJob(id) {
  db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
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
