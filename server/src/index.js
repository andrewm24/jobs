import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import * as db from "./db.js";
import { generate, KINDS } from "./claude.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/profile", (req, res) => {
  res.json({ profile: db.getProfile() });
});

app.put("/api/profile", (req, res) => {
  const { profile } = req.body ?? {};
  if (typeof profile !== "string") {
    return res.status(400).json({ error: "profile must be a string" });
  }
  db.setProfile(profile);
  res.json({ profile });
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

app.post("/api/generate", async (req, res) => {
  const { jobId, kind } = req.body ?? {};
  if (!KINDS.includes(kind)) {
    return res.status(400).json({ error: `kind must be one of: ${KINDS.join(", ")}` });
  }
  const job = db.getJob(jobId);
  if (!job) return res.status(404).json({ error: "job not found" });
  const profile = db.getProfile();
  if (!profile.trim()) {
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

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Job Ops server running on http://localhost:${port}`);
});
