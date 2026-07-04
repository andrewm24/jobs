# Job Ops Center

Personal job-application command center: track applications through a pipeline, and generate tailored cover letters, fit analyses, and interview prep with Claude.

This is Phase 0 of a larger automated job-applier system (discovery workers, resume tailoring, apply assist, interview practice — see the roadmap below).

## Structure

```
client/   Vite + React frontend (the Job Ops UI)
server/   Express API — SQLite persistence (node:sqlite) + Claude generation
```

The Anthropic API key lives only on the server. The frontend talks to `/api/*`; generation prompts are built server-side.

## Setup

Requires Node >= 22.9.

```sh
npm install
cp server/.env.example server/.env   # add your ANTHROPIC_API_KEY
npm run dev                          # server on :3001, client on :5173
```

Open http://localhost:5173.

Production-ish: `npm run build && npm start` — the server serves the built client on :3001.

## Data

SQLite database at `server/data/jobops.db` (gitignored). Tables: `profile` (single row of resume text), `jobs` (pipeline entries with generated artifacts in the `ai` JSON column).

## API

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/api/profile` | Read/save resume profile text |
| GET/POST | `/api/jobs` | List / create jobs |
| PATCH/DELETE | `/api/jobs/:id` | Update / remove a job |
| POST | `/api/generate` | `{jobId, kind: cover\|fit\|prep}` — Claude generation, saved to the job |

## Roadmap

- **Phase 1 — Discovery + inbox:** company watchlist, Greenhouse/Lever/Ashby feed pollers, GitHub internship-list differ, dedupe, Claude fit scoring, inbox tab with accept/dismiss.
- **Phase 2 — Resume tailoring:** structured master resume, per-job bullet selection/rewrite, PDF rendering (versioned artifacts).
- **Phase 3 — Apply assist:** Playwright prefill for known ATS forms, growing answers map, human-confirm submit.
- **Phase 4 — Practice + analytics:** mock-interview chat per job, response-rate dashboards.
