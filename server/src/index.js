import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import * as db from "./db.js";
import { generate, KINDS, parseMasterResume, chat, estimate, recommendCompanies } from "./claude.js";
import { runScan } from "./discovery/scan.js";
import { runAiJobSearch } from "./discovery/aiSearch.js";
import { runApplyAssist } from "./applyAssist.js";
import { computeAnalytics } from "./analytics.js";
import { MODEL_OPTIONS, RATES } from "./costs.js";

const isProd = process.env.NODE_ENV === "production";
const app = express();

// --- Security middleware (H-2, M-1, C-1, H-3) ---

// H-2: Security headers (CSP, X-Frame-Options, nosniff, etc.)
app.use(helmet({ contentSecurityPolicy: false })); // CSP off to avoid blocking inline Vite styles in dev

// M-1: CORS — restrict to known origins instead of allowing all
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3001")
  .split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (same-origin, curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
}));

app.use(express.json({ limit: "1mb" }));

// C-1: Optional bearer-token authentication for all /api routes
const AUTH_TOKEN = process.env.JOBOPS_AUTH_TOKEN;
if (AUTH_TOKEN) {
  app.use("/api", (req, res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (token !== AUTH_TOKEN) {
      return res.status(401).json({ error: "Unauthorized — set Authorization: Bearer <token>" });
    }
    next();
  });
}

// H-3: Rate limiting — general + tighter limit on expensive Claude-proxied endpoints
app.use("/api", rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
const claudeRateLimit = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many AI requests — try again in a minute" } });

// Consistent, human-readable errors for any Claude API failure.
// M-4: In production, avoid leaking internal details in error messages.
function claudeError(err, res) {
  if (err instanceof Anthropic.AuthenticationError) {
    return res.status(502).json({ error: "Claude API auth failed — set ANTHROPIC_API_KEY in server/.env" });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return res.status(502).json({ error: "Claude API rate limited — try again shortly" });
  }
  if (err instanceof Anthropic.APIError) {
    const detail = isProd ? "External API error" : `Claude API error (${err.status}): ${err.message}`;
    return res.status(502).json({ error: detail });
  }
  if (/Could not resolve authentication/i.test(err?.message ?? "")) {
    return res.status(502).json({ error: "No Anthropic credentials — set ANTHROPIC_API_KEY in server/.env (copy server/.env.example)" });
  }
  console.error(err);
  return res.status(500).json({ error: "Request failed" });
}

app.get("/api/profile", (req, res) => {
  res.json({ profile: db.getProfile() }); // profile is { text, json_data }
});

app.put("/api/profile", (req, res) => {
  const { profile, json_data } = req.body ?? {};
  if (typeof profile !== "string") {
    return res.status(400).json({ error: "profile must be a string" });
  }
  // L-2: Limit profile text length to prevent huge Claude prompts
  if (profile.length > 50_000) {
    return res.status(400).json({ error: "profile text too long (max 50,000 characters)" });
  }
  db.setProfile(profile, json_data);
  res.json({ profile: db.getProfile() });
});

app.post("/api/profile/parse", claudeRateLimit, async (req, res) => {
  const current = db.getProfile();
  if (!current.text.trim()) {
    return res.status(400).json({ error: "No profile text to parse." });
  }
  try {
    const json_data = await parseMasterResume(current.text);
    db.setProfile(current.text, json_data);
    res.json({ profile: db.getProfile() });
  } catch (err) {
    return claudeError(err, res);
  }
});

app.get("/api/jobs", (req, res) => {
  res.json({ jobs: db.listJobs() });
});

// M-5: Server-generate job ID; only accept expected fields from the client.
app.post("/api/jobs", (req, res) => {
  const { company, role, link, jd, notes } = req.body ?? {};
  if (!company?.trim() || !role?.trim()) {
    return res.status(400).json({ error: "company and role are required" });
  }
  const job = {
    id: randomUUID(), company, role, link: link ?? "", jd: jd ?? "",
    notes: notes ?? "", status: "Saved", created: new Date().toISOString(),
    ai: {}, source: "manual",
  };
  res.status(201).json({ job: db.insertJob(job) });
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

app.post("/api/jobs/:id/chat", claudeRateLimit, async (req, res) => {
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
    return claudeError(err, res);
  }
});

app.post("/api/generate", claudeRateLimit, async (req, res) => {
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
    return claudeError(err, res);
  }
});

app.post("/api/estimate", claudeRateLimit, async (req, res) => {
  const { jobId, kind } = req.body ?? {};
  if (!KINDS.includes(kind)) {
    return res.status(400).json({ error: `kind must be one of: ${KINDS.join(", ")}` });
  }
  const job = db.getJob(jobId);
  if (!job) return res.status(404).json({ error: "job not found" });
  const profile = db.getProfile();
  if (!profile.text.trim()) return res.status(400).json({ error: "Add your profile first." });
  try {
    res.json(await estimate(kind, profile, job));
  } catch (err) {
    return claudeError(err, res);
  }
});

app.get("/api/config", (req, res) => {
  res.json({ models: MODEL_OPTIONS, rates: RATES });
});

app.get("/api/analytics", (req, res) => {
  res.json(computeAnalytics());
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
  if (!/^[A-Za-z0-9._-]+$/.test(slug.trim())) {
    return res.status(400).json({ error: "slug must be the board identifier from the URL — letters, numbers, . _ - only (no spaces or full URL)" });
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

app.post("/api/companies/bulk", (req, res) => {
  const { companies } = req.body ?? {};
  if (!Array.isArray(companies)) {
    return res.status(400).json({ error: "companies must be an array" });
  }
  const added = db.addCompaniesBulk(companies);
  res.status(201).json({ added, total: db.listCompanies().length });
});

/* ---------------- AI Job Finder routes ---------------- */

let aiSearching = false;

app.post("/api/ai-search", claudeRateLimit, async (req, res) => {
  if (aiSearching) return res.status(409).json({ error: "An AI search is already in progress" });
  aiSearching = true;
  try {
    const { query } = req.body ?? {};
    const result = await runAiJobSearch(query || "");
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: isProd ? "AI search failed" : err.message });
  } finally {
    aiSearching = false;
  }
});

app.post("/api/ai-suggest-companies", claudeRateLimit, async (req, res) => {
  try {
    const profile = db.getProfile();
    const suggestions = await recommendCompanies(profile.text);
    res.json({ companies: suggestions });
  } catch (err) {
    return claudeError(err, res);
  }
});

app.get("/api/settings", (req, res) => {
  res.json({ settings: db.getSettings() });
});

app.put("/api/settings", (req, res) => {
  const patch = req.body?.settings ?? {};
  const modelIds = MODEL_OPTIONS.map((m) => m.id);
  const numeric = { min_score: [0, 10], github_days: [1, 365], score_limit: [0, 500] };
  for (const [key, [lo, hi]] of Object.entries(numeric)) {
    if (key in patch) {
      const n = Number(patch[key]);
      if (!Number.isFinite(n) || n < lo || n > hi) {
        return res.status(400).json({ error: `${key} must be a number between ${lo} and ${hi}` });
      }
    }
  }
  for (const key of ["gen_model", "scoring_model"]) {
    if (key in patch && !modelIds.includes(patch[key])) {
      return res.status(400).json({ error: `${key} must be one of: ${modelIds.join(", ")}` });
    }
  }
  // M-3: Validate github_repo to prevent URL manipulation / SSRF
  if ("github_repo" in patch && patch.github_repo) {
    if (!/^[A-Za-z0-9._-]+$/.test(patch.github_repo.trim())) {
      return res.status(400).json({ error: "github_repo must be a simple repo name (letters, numbers, . _ - only)" });
    }
  }
  res.json({ settings: db.setSettings(patch) });
});

let scanning = false;

app.post("/api/scan", claudeRateLimit, async (req, res) => {
  if (scanning) return res.status(409).json({ error: "a scan is already running" });
  scanning = true;
  try {
    res.json(await runScan());
  } catch (err) {
    console.error(err);
    // M-4: Don't leak internal error details in production
    res.status(500).json({ error: isProd ? "Scan failed" : err.message });
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
    source: posting.source || "inbox",
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
