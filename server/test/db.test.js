import { test, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

process.env.JOBOPS_DB_PATH = path.join(os.tmpdir(), `jobops-test-${randomUUID()}.db`);
const db = await import("../src/db.js");

after(() => {
  try {
    fs.unlinkSync(process.env.JOBOPS_DB_PATH);
  } catch {}
});

test("job insert stores source and records a created event", () => {
  const job = db.insertJob({
    id: "t1", company: "Acme", role: "Intern",
    status: "Saved", created: new Date().toISOString(), ai: {}, source: "github",
  });
  assert.equal(job.company, "Acme");
  assert.equal(job.source, "github");
  const created = db.listEvents().filter((e) => e.job_id === "t1" && e.type === "created");
  assert.equal(created.length, 1);
});

test("status change records a stage_change event", () => {
  db.updateJob("t1", { status: "Applied" });
  const changes = db.listEvents().filter((e) => e.job_id === "t1" && e.type === "stage_change");
  assert.equal(changes.length, 1);
  assert.equal(changes[0].from_stage, "Saved");
  assert.equal(changes[0].to_stage, "Applied");
});

test("non-status updates do not emit stage_change", () => {
  const before = db.listEvents().filter((e) => e.type === "stage_change").length;
  db.updateJob("t1", { notes: "hello" });
  const after = db.listEvents().filter((e) => e.type === "stage_change").length;
  assert.equal(before, after);
});

test("settings expose model defaults and round-trip", () => {
  const s = db.getSettings();
  assert.equal(s.gen_model, "claude-opus-4-8");
  assert.equal(s.scoring_model, "claude-haiku-4-5");
  db.setSettings({ min_score: "7" });
  assert.equal(db.getSettings().min_score, "7");
});

test("usage log accumulates spend", () => {
  db.logUsage({ model: "claude-haiku-4-5", kind: "score", input_tokens: 1000, output_tokens: 100, cost: 0.0015 });
  const spend = db.getSpend();
  assert.ok(spend.allTime >= 0.0015);
  assert.ok(spend.allTimeTokens >= 1100);
});
