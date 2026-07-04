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
    text TEXT NOT NULL DEFAULT ''
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
  INSERT OR IGNORE INTO profile (id, text) VALUES (1, '');
`);

const rowToJob = (row) => row && { ...row, ai: JSON.parse(row.ai) };

export function getProfile() {
  return db.prepare("SELECT text FROM profile WHERE id = 1").get().text;
}

export function setProfile(text) {
  db.prepare("UPDATE profile SET text = ? WHERE id = 1").run(text);
}

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
