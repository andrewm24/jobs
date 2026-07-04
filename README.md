# Job Ops Center

Personal job-application command center. Discovers internships, ranks them by fit,
tracks applications through a pipeline, and uses Claude to tailor resumes, write
cover letters, prefill application forms, and run mock interviews.

Phases 0–4 are implemented. See the roadmap for what each phase covers.

## Structure

```
client/   Vite + React frontend
  src/App.jsx        pipeline, inbox, sources, profile, analytics tabs + job detail
  src/ResumePDF.jsx  @react-pdf/renderer template for the tailored resume export
  src/ResumePDF.jsx  @react-pdf/renderer template for the browser PDF export
server/   Express API — SQLite persistence (node:sqlite) + Claude
  src/claude.js          generation, fit scoring, cost/usage logging, mock-interview chat
  src/costs.js           per-model $ rates + model options
  src/analytics.js       funnel / time-series / by-source from the events table
  src/resumePdf.js       server-side resume PDF render (for apply-assist upload)
  src/applyAssist.js     Playwright form prefill + PDF upload (headed, human submits)
  src/discovery/*        Greenhouse/Lever/Ashby adapters, SimplifyJobs list, scan
  test/*.test.js         node:test suite (db, discovery, analytics)
```

The Anthropic API key lives only on the server. The frontend talks to `/api/*`;
all prompts are built server-side.

## Run with Docker (recommended — one command)

Requires Docker Desktop.

```sh
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env    # your API key (repo-root .env)
docker compose up --build
```

- App: http://localhost:3001
- Apply-assist browser (headed Chromium via noVNC): http://localhost:6080/vnc.html
  — when you click Auto-Apply, the browser opens there for you to review and submit.

The SQLite database lives in a named volume (`jobops-data`), so your data
survives `docker compose down` / restarts. The image bundles Chromium so
apply-assist works inside the container; it's ~2 GB for that reason.

> Billing: this calls the **Anthropic API** (pay-as-you-go credits at
> console.anthropic.com), which is separate from a Claude.ai Pro/Max
> subscription. Spend is low (Haiku scoring ≈ cents/scan, Opus generations
> ≈ 5–10¢ each) and visible in the Analytics tab. Models are configurable in
> Settings.

## Run locally (dev)

Requires Node >= 22.9.

```sh
npm install
cp server/.env.example server/.env      # add your ANTHROPIC_API_KEY
npx playwright install chromium         # only needed for Apply Assist
npm run dev                             # server on :3001, client on :5173
```

Open http://localhost:5173. Production-ish without Docker:
`npm run build && npm start` (server serves the built client on :3001).
Apply-assist opens a real browser window on your desktop locally; you can also
run it standalone with `npm run apply -w server -- <jobId>`.

Tests: `npm test -w server`.

## Using it

1. **Profile** — paste your resume/background, Save, then "Generate Structured
   Resume" to parse it into structured JSON (needed for resume tailoring and form prefill).
2. **Sources** — add companies by ATS + board slug, tune discovery keywords,
   locations, and the minimum fit score. The SimplifyJobs GitHub list is always scanned.
3. **Inbox** — "Scan Now" pulls fresh postings, ranks them by Claude fit score,
   and lets you Accept (→ pipeline) or Dismiss. Auto-rescans every `SCAN_INTERVAL_HOURS`.
4. **Pipeline / Job detail** — move a job through stages; generate a cover letter,
   fit analysis, interview prep, or a tailored resume (Download PDF); run a mock
   interview; or launch Apply Assist to prefill the posting's form.
5. **Analytics** — funnel + rates over time, median time-to-response, conversion
   by source, and cumulative Claude API spend. Also pick generation/scoring models
   and see per-run cost estimates in the job detail view.

## Data

SQLite at `server/data/jobops.db` (gitignored; overridable with `JOBOPS_DB_PATH`).
Tables: `profile` (resume text + structured `json_data`), `jobs` (pipeline entries
with a `source`; artifacts in the `ai` JSON column incl. chat + apply reports),
`companies` (watchlist), `postings` (discovery inbox), `settings`, `answers_map`
(learned form answers), `events` (timestamped stage changes → analytics),
`usage_log` (token spend per Claude call).

## API

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/api/profile` | Read/save resume text (+ structured `json_data`) |
| POST | `/api/profile/parse` | Parse resume text into structured JSON |
| GET/POST | `/api/jobs` | List / create jobs |
| PATCH/DELETE | `/api/jobs/:id` | Update / remove a job |
| POST | `/api/jobs/:id/chat` | Mock-interview chat turn |
| POST | `/api/jobs/:id/apply` | Launch Playwright apply-assist |
| POST | `/api/generate` | `{jobId, kind: cover\|fit\|prep\|tailor}` — Claude generation |
| POST | `/api/estimate` | `{jobId, kind}` — token/cost estimate via count_tokens |
| GET/POST | `/api/companies` · PATCH/DELETE `/:id` | Watchlist CRUD |
| GET/PUT | `/api/settings` | Discovery + model settings |
| POST | `/api/scan` | Run a discovery scan |
| GET | `/api/inbox` | Ranked discovered postings |
| POST | `/api/inbox/:id/accept` · `/dismiss` | Triage a posting |
| GET | `/api/config` | Model options + $ rate table |
| GET | `/api/analytics` | Funnel, time-series, by-source, spend |

## Config

Models and score limit are set in-app (Settings) and persist in the DB. Env vars
(root `.env` for Docker, `server/.env` for local) are fallbacks:
`ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `SCORING_MODEL`, `SCORE_LIMIT`,
`SCAN_INTERVAL_HOURS` (0 = manual only), `PORT`, `JOBOPS_DB_PATH`.

## Roadmap

- **Phase 1 — Discovery + inbox** ✅ Greenhouse/Lever/Ashby pollers, GitHub list, dedupe (incl. against pipeline), Claude fit scoring, inbox accept/dismiss.
- **Phase 2 — Resume tailoring** ✅ structured master resume, per-job bullet selection/rewrite, PDF export.
- **Phase 3 — Apply assist** ✅ Playwright prefill, ATS detection + Workday/Taleo fallback, tailored-PDF upload, learned answers map, human-confirm submit.
- **Phase 4 — Practice + analytics** ✅ mock-interview chat, funnel/time-series/by-source analytics, cost controls + spend tracking.
- **Deploy** ✅ one-command Docker (app + noVNC apply-assist browser + persistent volume).

Future: versioned resume artifacts per application, scheduled scans via GitHub
Actions for always-on discovery, remote hosting with single-user auth.
