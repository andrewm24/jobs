import { test, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

process.env.JOBOPS_DB_PATH = path.join(os.tmpdir(), `jobops-test-${randomUUID()}.db`);
const db = await import("../src/db.js");
const { computeAnalytics } = await import("../src/analytics.js");

after(() => {
  try {
    fs.unlinkSync(process.env.JOBOPS_DB_PATH);
  } catch {}
});

test("funnel + rates + by-source derive from stage events", () => {
  db.insertJob({ id: "a1", company: "A", role: "R", status: "Saved", created: new Date().toISOString(), ai: {}, source: "github" });
  db.updateJob("a1", { status: "Applied" });
  db.updateJob("a1", { status: "Screen" }); // response + interview

  db.insertJob({ id: "a2", company: "B", role: "R", status: "Saved", created: new Date().toISOString(), ai: {}, source: "greenhouse" });
  db.updateJob("a2", { status: "Applied" }); // applied, no response

  const r = computeAnalytics();
  assert.equal(r.funnel.applied, 2);
  assert.equal(r.funnel.responded, 1);
  assert.equal(r.funnel.interviewed, 1);
  assert.equal(r.funnel.offered, 0);
  assert.equal(r.rates.response, 50);

  const github = r.bySource.find((s) => s.source === "github");
  assert.ok(github);
  assert.equal(github.applied, 1);
  assert.equal(github.responded, 1);
});
