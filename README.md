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
server/   Express API — SQLite persistence (node:sqlite) + Claude
  src/claude.js          generation, fit scoring, form answers, mock-interview chat
  src/discovery/ats.js   Greenhouse / Lever / Ashby public job-board adapters
  src/discovery/github.js SimplifyJobs internship-list fetcher
  src/discovery/scan.js  prefilter + dedupe + fit-scoring orchestration
  src/applyAssist.js     Playwright form prefill (headed, human submits)
```

The Anthropic API key lives only on the server. The frontend talks to `/api/*`;
all prompts are built server-side.

## Setup

Requires Node >= 22.9.

```sh
npm install
cp server/.env.example server/.env      # add your ANTHROPIC_API_KEY
npx playwright install chromium         # only needed for Apply Assist (Phase 3)
npm run dev                             # server on :3001, client on :5173
```

Open http://localhost:5173.

Production-ish: `npm run build && npm start` — the server serves the built client on :3001.

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
5. **Analytics** — response / interview / offer funnel across your applications.

## Data

SQLite at `server/data/jobops.db` (gitignored). Tables: `profile` (resume text +
structured `json_data`), `jobs` (pipeline entries; generated artifacts in the `ai`
JSON column, including mock-interview `chat` history), `companies` (watchlist),
`postings` (discovery inbox), `settings`, `answers_map` (learned form answers).

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
| GET/POST | `/api/companies` · PATCH/DELETE `/:id` | Watchlist CRUD |
| GET/PUT | `/api/settings` | Discovery settings |
| POST | `/api/scan` | Run a discovery scan |
| GET | `/api/inbox` | Ranked discovered postings |
| POST | `/api/inbox/:id/accept` · `/dismiss` | Triage a posting |

## Config (server/.env)

`ANTHROPIC_API_KEY`, `CLAUDE_MODEL` (default `claude-opus-4-8`),
`SCORING_MODEL` (default `claude-haiku-4-5`), `SCORE_LIMIT` (postings scored per
scan), `SCAN_INTERVAL_HOURS` (0 = manual only), `PORT`.

## Roadmap

- **Phase 1 — Discovery + inbox** ✅ Greenhouse/Lever/Ashby pollers, GitHub list, dedupe, Claude fit scoring, inbox accept/dismiss.
- **Phase 2 — Resume tailoring** ✅ structured master resume, per-job bullet selection/rewrite, PDF export.
- **Phase 3 — Apply assist** ✅ Playwright prefill, learned answers map, human-confirm submit.
- **Phase 4 — Practice + analytics** ✅ mock-interview chat per job, response-rate funnel.

Future: versioned resume artifacts, per-source conversion analytics, scheduled
scans via GitHub Actions for always-on discovery.
