import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import * as db from "./db.js";
import { generate, KINDS, parseMasterResume, chat } from "./claude.js";
import { runScan } from "./discovery/scan.js";
import { runApplyAssist } from "./applyAssist.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/profile", (req, res) => {
  res.json({ profile: db.getProfile() }); // profile is { text, json_data }
});

app.put("/api/profile", (req, res) => {
  const { profile, json_data } = req.body ?? {};
  if (typeof profile !== "string") {
    return res.status(400).json({ error: "profile must be a string" });
  }
  db.setProfile(profile, json_data);
  res.json({ profile: db.getProfile() });
});

app.post("/api/profile/parse", async (req, res) => {
  const current = db.getProfile();
  if (!current.text.trim()) {
    return res.status(400).json({ error: "No profile text to parse." });
  }
  try {
    const json_data = await parseMasterResume(current.text);
    db.setProfile(current.text, json_data);
    res.json({ profile: db.getProfile() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Parsing failed" });
  }
});

app.get("/api/jobs", (req, res) => {
  res.json({ jobs: db.listJobs() });
});

app.post("/api/jobs", (req, res) => {
  const { id, company, role } = req.body ?? {};
  if (!id || !company?.trim() || !role?.trim()) {
    return res.status(400).json({ error: "id, company, and role are required" });
  }
  res.status(201).json({ job: db.insertJob(req.body) });
});

app.patch("/api/jobs/:id", (req, res) => {
  const job = db.updateJob(req.params.id, req.body ?? {});
  if (!job) return res.status(404).json({ error: "job not found" });
  res.json({ job });
});

app.delete("/api/jobs/:id", (req, res) => {
  db.deleteJob(req.params.id);
  res.status(204).end();
});

app.post("/api/jobs/:id/apply", async (req, res) => {
  try {
    // Fire and forget so we don't hold the connection open while the human reviews the form
    runApplyAssist(req.params.id).catch(console.error);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start apply assist" });
  }
});

app.post("/api/jobs/:id/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });
    
    const job = db.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "job not found" });
    
    const profile = db.getProfile();
    
    const history = job.ai?.chat || [];
    
    const responseText = await chat(job, profile, history, message);
    
    const newHistory = [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: responseText }
    ];
    
    const ai = { ...job.ai, chat: newHistory };
    db.updateJob(job.id, { ai });
    
    res.json({ chat: newHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chat failed" });
  }
});

app.post("/api/generate", async (req, res) => {
  const { jobId, kind } = req.body ?? {};
  if (!KINDS.includes(kind)) {
    return res.status(400).json({ error: `kind must be one of: ${KINDS.join(", ")}` });
  }
  const job = db.getJob(jobId);
  if (!job) return res.status(404).json({ error: "job not found" });
  const profile = db.getProfile();
  if (!profile.text.trim()) {
    return res.status(400).json({ error: "Add your profile first — generation is tailored against it." });
  }
  try {
    const text = await generate(kind, profile, job);
    const updated = db.updateJob(jobId, { ai: { ...job.ai, [kind]: text } });
    res.json({ job: updated });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(502).json({ error: "Claude API auth failed — set ANTHROPIC_API_KEY in server/.env" });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(502).json({ error: "Claude API rate limited — try again shortly" });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `Claude API error (${err.status}): ${err.message}` });
    }
    if (/Could not resolve authentication/i.test(err?.message ?? "")) {
      return res.status(502).json({ error: "No Anthropic credentials — set ANTHROPIC_API_KEY in server/.env (copy server/.env.example)" });
    }
    console.error(err);
    res.status(500).json({ error: "Generation failed" });
  }
});

/* ---------------- discovery: companies, settings, scan, inbox ---------------- */

app.get("/api/companies", (req, res) => {
  res.json({ companies: db.listCompanies() });
});

app.post("/api/companies", (req, res) => {
  const { name, ats, slug } = req.body ?? {};
  if (!name?.trim() || !slug?.trim() || !["greenhouse", "lever", "ashby"].includes(ats)) {
    return res.status(400).json({ error: "name, slug, and ats (greenhouse|lever|ashby) required" });
  }
  res.status(201).json({ company: db.addCompany({ name, ats, slug }) });
});

app.patch("/api/companies/:id", (req, res) => {
  db.setCompanyActive(Number(req.params.id), !!req.body?.active);
  res.json({ ok: true });
});

app.delete("/api/companies/:id", (req, res) => {
  db.deleteCompany(Number(req.params.id));
  res.status(204).end();
});

app.get("/api/settings", (req, res) => {
  res.json({ settings: db.getSettings() });
});

app.put("/api/settings", (req, res) => {
  res.json({ settings: db.setSettings(req.body?.settings ?? {}) });
});

let scanning = false;

app.post("/api/scan", async (req, res) => {
  if (scanning) return res.status(409).json({ error: "a scan is already running" });
  scanning = true;
  try {
    res.json(await runScan());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    scanning = false;
  }
});

app.get("/api/inbox", (req, res) => {
  const minScore = Number(db.getSettings().min_score) || 6;
  res.json({ postings: db.listInbox(minScore) });
});

app.post("/api/inbox/:id/accept", (req, res) => {
  const posting = db.getPosting(req.params.id);
  if (!posting) return res.status(404).json({ error: "posting not found" });
  const job = db.insertJob({
    id: randomUUID(),
    company: posting.company,
    role: posting.title,
    link: posting.url,
    jd: posting.jd,
    notes: posting.reason ? `Fit ${posting.score}/10 — ${posting.reason}` : "",
    status: "Saved",
    created: new Date().toISOString(),
    ai: {},
  });
  db.setPostingState(posting.id, "accepted");
  res.json({ job });
});

app.post("/api/inbox/:id/dismiss", (req, res) => {
  if (!db.getPosting(req.params.id)) return res.status(404).json({ error: "posting not found" });
  db.setPostingState(req.params.id, "dismissed");
  res.json({ ok: true });
});

// Serve the built frontend in production
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "..", "client", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(dist, "index.html"));
    }
    next();
  });
}

// Background discovery: rescan every SCAN_INTERVAL_HOURS (0 disables)
const scanHours = Number(process.env.SCAN_INTERVAL_HOURS ?? 6);
if (scanHours > 0) {
  setInterval(() => {
    if (scanning) return;
    scanning = true;
    runScan()
      .then((r) => console.log(`[scan] fetched=${r.fetched} new=${r.new} scored=${r.scored}`))
      .catch((err) => console.error("[scan]", err))
      .finally(() => {
        scanning = false;
      });
  }, scanHours * 3600 * 1000).unref();
}

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Job Ops server running on http://localhost:${port}`);
});
