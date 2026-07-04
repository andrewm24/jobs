import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "./api.js";
import { pdf } from "@react-pdf/renderer";
import ResumePDF from "./ResumePDF.jsx";

/* ============================================================
   JOB OPS — Application Command Center
   Flight-ops styling: paper #EDF0F3, ink #0F1D2E, intl orange #E8500A
   ============================================================ */

const STAGES = ["Saved", "Applied", "Screen", "Interview", "Offer"];
const TERMINAL = ["Rejected", "Withdrawn"];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  --paper: #EDF0F3;
  --card: #FFFFFF;
  --ink: #0F1D2E;
  --ink-soft: #45566B;
  --line: #C9D2DC;
  --orange: #E8500A;
  --orange-soft: #FDEAE0;
  --steel: #3E6285;
  --green: #1F7A47;
  --green-soft: #E2F2E9;
  --red: #B3261E;
}
* { box-sizing: border-box; margin: 0; }
.jo-root {
  min-height: 100vh; background: var(--paper); color: var(--ink);
  font-family: 'IBM Plex Sans', sans-serif; font-size: 15px; line-height: 1.5;
}
.jo-wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px 80px; }

/* Header */
.jo-header {
  border-bottom: 2px solid var(--ink); padding: 28px 0 16px;
  display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px;
}
.jo-eyebrow {
  font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--orange); font-weight: 500;
}
.jo-title {
  font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 30px;
  letter-spacing: -0.01em; line-height: 1.1;
}
.jo-header-meta { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-soft); text-align: right; }

/* Tabs */
.jo-tabs { display: flex; gap: 4px; margin: 18px 0 24px; border-bottom: 1px solid var(--line); }
.jo-tab {
  background: none; border: none; padding: 10px 16px; cursor: pointer;
  font-family: 'IBM Plex Mono', monospace; font-size: 13px; letter-spacing: 0.06em;
  color: var(--ink-soft); border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.jo-tab:hover { color: var(--ink); }
.jo-tab.active { color: var(--ink); border-bottom-color: var(--orange); font-weight: 500; }
.jo-tab:focus-visible { outline: 2px solid var(--steel); outline-offset: 2px; }

/* Stats strip */
.jo-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); margin-bottom: 24px; }
.jo-stat { background: var(--card); padding: 14px 16px; }
.jo-stat-n { font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 700; }
.jo-stat-l { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); }

/* Cards */
.jo-card { background: var(--card); border: 1px solid var(--line); padding: 20px; margin-bottom: 14px; }
.jo-card-h { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.jo-company { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; }
.jo-role { color: var(--ink-soft); font-size: 14px; }

/* Pipeline rail — signature element */
.jo-rail { display: flex; align-items: center; margin: 16px 0 4px; }
.jo-rail-node { display: flex; align-items: center; flex: 1; min-width: 0; }
.jo-rail-dot {
  width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line);
  background: var(--card); flex-shrink: 0; cursor: pointer; padding: 0;
}
.jo-rail-dot.done { background: var(--ink); border-color: var(--ink); }
.jo-rail-dot.current { background: var(--orange); border-color: var(--orange); box-shadow: 0 0 0 4px var(--orange-soft); }
.jo-rail-dot:focus-visible { outline: 2px solid var(--steel); outline-offset: 3px; }
.jo-rail-line { height: 2px; background: var(--line); flex: 1; }
.jo-rail-line.done { background: var(--ink); }
.jo-rail-labels { display: flex; margin-top: 6px; }
.jo-rail-label {
  flex: 1; font-family: 'IBM Plex Mono', monospace; font-size: 10px;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft);
}
.jo-rail-label.current { color: var(--orange); font-weight: 500; }

/* Buttons */
.jo-btn {
  font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.06em;
  padding: 9px 16px; border: 1px solid var(--ink); background: var(--ink); color: #fff;
  cursor: pointer; text-transform: uppercase;
}
.jo-btn:hover { background: #23344a; }
.jo-btn:disabled { opacity: 0.45; cursor: wait; }
.jo-btn.ghost { background: transparent; color: var(--ink); }
.jo-btn.ghost:hover { background: var(--paper); }
.jo-btn.accent { background: var(--orange); border-color: var(--orange); }
.jo-btn.accent:hover { background: #c94408; }
.jo-btn.danger { background: transparent; border-color: var(--red); color: var(--red); }
.jo-btn.sm { padding: 6px 12px; font-size: 11px; }
.jo-btn:focus-visible { outline: 2px solid var(--steel); outline-offset: 2px; }

/* Inputs */
.jo-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); display: block; margin: 14px 0 5px; }
.jo-input, .jo-textarea {
  width: 100%; border: 1px solid var(--line); background: var(--card); padding: 10px 12px;
  font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: var(--ink);
}
.jo-textarea { min-height: 140px; resize: vertical; font-size: 13px; }
.jo-input:focus, .jo-textarea:focus { outline: none; border-color: var(--steel); box-shadow: 0 0 0 2px #3E628533; }

/* Badges */
.jo-badge { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border: 1px solid var(--line); color: var(--ink-soft); }
.jo-badge.offer { background: var(--green-soft); color: var(--green); border-color: var(--green); }
.jo-badge.dead { color: var(--red); border-color: var(--red); }

/* AI output */
.jo-output {
  background: var(--paper); border: 1px solid var(--line); border-left: 3px solid var(--orange);
  padding: 16px 18px; margin-top: 12px; white-space: pre-wrap; font-size: 13.5px; line-height: 1.65;
}
.jo-output-h { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; }
.jo-output-title { font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; }
.jo-spin { display: inline-block; animation: jospin 1s linear infinite; }
@keyframes jospin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .jo-spin { animation: none; } }

.jo-empty { text-align: center; padding: 60px 20px; color: var(--ink-soft); }
.jo-empty-h { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
.jo-back { background: none; border: none; cursor: pointer; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--steel); padding: 0; margin-bottom: 16px; letter-spacing: 0.06em; }
.jo-back:hover { text-decoration: underline; }
.jo-note { font-size: 12px; color: var(--ink-soft); margin-top: 8px; }
.jo-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
.jo-saved-flash { color: var(--green); font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
.jo-error { color: var(--red); font-size: 13px; margin-top: 10px; }
`;

/* ---------------- Pipeline Rail ---------------- */
function Rail({ status, onSet }) {
  const idx = STAGES.indexOf(status);
  return (
    <div>
      <div className="jo-rail">
        {STAGES.map((s, i) => (
          <div className="jo-rail-node" key={s} style={{ flex: i === STAGES.length - 1 ? "0 0 auto" : 1 }}>
            <button
              className={"jo-rail-dot " + (i < idx ? "done" : i === idx ? "current" : "")}
              title={s}
              aria-label={"Set stage: " + s}
              onClick={() => onSet(s)}
            />
            {i < STAGES.length - 1 && <div className={"jo-rail-line " + (i < idx ? "done" : "")} />}
          </div>
        ))}
      </div>
      <div className="jo-rail-labels">
        {STAGES.map((s, i) => (
          <span key={s} className={"jo-rail-label " + (i === idx ? "current" : "")} style={{ flex: i === STAGES.length - 1 ? "0 0 auto" : 1 }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Inbox ---------------- */
const scoreColor = (s) => (s >= 8 ? "var(--green)" : s >= 6 ? "var(--ink)" : "var(--red)");

function Inbox({ postings, scanBusy, scanSummary, onScan, onAccept, onDismiss }) {
  return (
    <div>
      <div className="jo-card">
        <div className="jo-card-h">
          <div style={{ maxWidth: 640 }}>
            <div className="jo-output-title">Discovery inbox</div>
            <p className="jo-note">
              Fresh postings from your watchlist and the SimplifyJobs internship list, ranked by
              Claude fit score against your profile. Accept moves a posting into your pipeline.
            </p>
          </div>
          <button className="jo-btn accent" disabled={scanBusy} onClick={onScan}>
            {scanBusy ? <span><span className="jo-spin">◐</span> Scanning…</span> : "Scan Now"}
          </button>
        </div>
        {scanSummary && <p className="jo-note">{scanSummary}</p>}
      </div>

      {postings.length === 0 ? (
        <div className="jo-empty">
          <div className="jo-empty-h">Inbox zero</div>
          <p>Run a scan to pull fresh postings. Add companies in the Sources tab to widen the net.</p>
        </div>
      ) : (
        postings.map((p) => (
          <div className="jo-card" key={p.id}>
            <div className="jo-card-h">
              <div>
                <div className="jo-company">{p.company}</div>
                <div className="jo-role">{p.title}{p.location ? ` · ${p.location}` : ""}</div>
                {p.reason && <p className="jo-note">{p.reason}</p>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {p.score != null
                  ? <span className="jo-badge" style={{ color: scoreColor(p.score), borderColor: scoreColor(p.score) }}>Fit {p.score}/10</span>
                  : <span className="jo-badge">Unscored</span>}
                <span className="jo-badge">{p.source}</span>
              </div>
            </div>
            <div className="jo-row">
              <button className="jo-btn sm accent" onClick={() => onAccept(p)}>Accept → Pipeline</button>
              <button className="jo-btn sm ghost" onClick={() => onDismiss(p)}>Dismiss</button>
              {p.url && (
                <a className="jo-btn sm ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                  href={p.url} target="_blank" rel="noreferrer">View Posting ↗</a>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ---------------- Sources ---------------- */
function Sources({ companies, settings, models = [], onAddCompany, onToggleCompany, onDeleteCompany, onSaveSettings }) {
  const [name, setName] = useState("");
  const [ats, setAts] = useState("greenhouse");
  const [slug, setSlug] = useState("");
  const [local, setLocal] = useState(settings);
  const [flash, setFlash] = useState(false);
  useEffect(() => setLocal(settings), [settings]);

  const set = (key) => (e) => setLocal((l) => ({ ...l, [key]: e.target.value }));
  const submit = () => {
    if (!name.trim() || !slug.trim()) return;
    onAddCompany({ name: name.trim(), ats, slug: slug.trim() });
    setName(""); setSlug("");
  };
  const save = async () => {
    await onSaveSettings(local);
    setFlash(true);
    setTimeout(() => setFlash(false), 1600);
  };

  return (
    <div>
      <div className="jo-card">
        <div className="jo-output-title">Company watchlist</div>
        <p className="jo-note">
          Polled directly from each company's public ATS job board. The slug is the board name in
          the URL — greenhouse: boards.greenhouse.io/&lt;slug&gt; · lever: jobs.lever.co/&lt;slug&gt; ·
          ashby: jobs.ashbyhq.com/&lt;slug&gt;. The SimplifyJobs GitHub list is always scanned, so an
          empty watchlist still finds internships.
        </p>
        {companies.map((c) => (
          <div key={c.id} className="jo-row" style={{ alignItems: "center", justifyContent: "space-between", opacity: c.active ? 1 : 0.5 }}>
            <span>
              <strong>{c.name}</strong>{" "}
              <span className="jo-badge">{c.ats}</span>{" "}
              <span className="jo-note" style={{ display: "inline" }}>{c.slug}</span>
            </span>
            <span style={{ display: "flex", gap: 6 }}>
              <button className="jo-btn sm ghost" onClick={() => onToggleCompany(c)}>{c.active ? "Pause" : "Resume"}</button>
              <button className="jo-btn sm danger" onClick={() => onDeleteCompany(c.id)}>Remove</button>
            </span>
          </div>
        ))}
        <label className="jo-label">Add company</label>
        <div className="jo-row" style={{ marginTop: 0 }}>
          <input className="jo-input" style={{ flex: 2, minWidth: 140 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" />
          <select className="jo-input" style={{ flex: 1, minWidth: 130 }} value={ats} onChange={(e) => setAts(e.target.value)}>
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
            <option value="ashby">Ashby</option>
          </select>
          <input className="jo-input" style={{ flex: 2, minWidth: 140 }} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="board slug" />
          <button className="jo-btn" disabled={!name.trim() || !slug.trim()} onClick={submit}>Add</button>
        </div>
      </div>

      <div className="jo-card">
        <div className="jo-output-title">Discovery settings</div>
        <label className="jo-label">Title must contain one of (comma-separated)</label>
        <input className="jo-input" value={local.include_keywords ?? ""} onChange={set("include_keywords")} placeholder="intern, co-op" />
        <label className="jo-label">Exclude titles containing</label>
        <input className="jo-input" value={local.exclude_keywords ?? ""} onChange={set("exclude_keywords")} placeholder="unpaid, senior, staff, phd" />
        <label className="jo-label">Locations (comma-separated · blank = anywhere · remote always passes)</label>
        <input className="jo-input" value={local.locations ?? ""} onChange={set("locations")} placeholder="e.g. Maryland, Washington DC, New York" />
        <label className="jo-label">Minimum fit score to surface (0–10)</label>
        <input className="jo-input" value={local.min_score ?? ""} onChange={set("min_score")} placeholder="6" />
        <label className="jo-label">GitHub list lookback (days)</label>
        <input className="jo-input" value={local.github_days ?? ""} onChange={set("github_days")} placeholder="14" />
        <label className="jo-label">Max postings scored per scan</label>
        <input className="jo-input" value={local.score_limit ?? ""} onChange={set("score_limit")} placeholder="40" />
        <div className="jo-row" style={{ marginTop: 0, gap: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="jo-label">Generation model (cover / fit / prep / tailor / chat)</label>
            <select className="jo-input" value={local.gen_model ?? ""} onChange={set("gen_model")}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="jo-label">Fit-scoring model (runs per posting — keep cheap)</label>
            <select className="jo-input" value={local.scoring_model ?? ""} onChange={set("scoring_model")}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div className="jo-row" style={{ alignItems: "center" }}>
          <button className="jo-btn" onClick={save}>Save Settings</button>
          {flash && <span className="jo-saved-flash">✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Job Detail ---------------- */
function JobDetail({ job, profile, rates, genModel, onUpdate, onDelete, onBack }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMsg, setChatMsg] = useState("");

  // Rough, free client-side estimate (chars/4) so you see cost before spending.
  const estCost = (kind) => {
    const rate = rates?.[genModel] || rates?.["claude-opus-4-8"] || { in: 5, out: 25 };
    const profileChars = (profile?.text?.length || 0) + JSON.stringify(profile?.json_data || {}).length;
    const inTok = (profileChars + (job.jd?.length || 0) + 400) / 4;
    const outTok = { cover: 500, fit: 750, prep: 900, tailor: 1500 }[kind] || 700;
    return (inTok * rate.in + outTok * rate.out) / 1e6;
  };

  const handleChat = async () => {
    if (!chatMsg.trim()) return;
    setChatBusy(true);
    const msg = chatMsg.trim();
    setChatMsg("");
    try {
      const newHistory = await api.sendChat(job.id, msg);
      onUpdate({ ...job, ai: { ...job.ai, chat: newHistory } }, { persisted: true });
    } catch(e) {
      alert("Chat failed: " + e.message);
    }
    setChatBusy(false);
  };

  const outputText = (v) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

  const runAI = async (kind) => {
    if (!profile?.text?.trim()) {
      alert("Add your background in the Profile tab first — the AI needs it to tailor output.");
      return;
    }
    if (kind === "tailor" && !(profile.json_data && Object.keys(profile.json_data).length)) {
      alert("Generate the structured resume first (Profile tab → Generate Structured Resume) — tailoring needs it.");
      return;
    }
    setBusy(kind);
    setError("");
    try {
      const updated = await api.generate(job.id, kind);
      onUpdate(updated, { persisted: true });
    } catch (e) {
      setError("Generation failed — " + e.message);
    }
    setBusy("");
  };

  const copy = (text) => navigator.clipboard && navigator.clipboard.writeText(text);

  const outputs = [
    { key: "cover", label: "Cover Letter", btn: "Generate Cover Letter" },
    { key: "fit", label: "Fit Analysis + Resume Bullets", btn: "Analyze Fit" },
    { key: "prep", label: "Interview Prep", btn: "Prep Interview" },
    { key: "tailor", label: "Tailored Resume", btn: "Tailor Resume" },
  ];

  const handleDownloadPDF = async (jsonString, company) => {
    try {
      let data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      const blob = await pdf(<ResumePDF data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Resume_${company.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("PDF Generation failed: " + e.message);
    }
  };

  return (
    <div>
      <button className="jo-back" onClick={onBack}>← Back to pipeline</button>
      <div className="jo-card">
        <div className="jo-card-h">
          <div>
            <div className="jo-company">{job.company}</div>
            <div className="jo-role">{job.role}</div>
            {job.link && <div className="jo-note"><a href={job.link} target="_blank" rel="noreferrer" style={{ color: "var(--steel)" }}>Job posting ↗</a></div>}
          </div>
          <div className="jo-row" style={{ marginTop: 0 }}>
            <button className="jo-btn sm ghost" onClick={() => onUpdate({ ...job, status: "Rejected" })}>Mark Rejected</button>
            <button className="jo-btn sm danger" onClick={() => { if (confirm("Delete this job?")) onDelete(job.id); }}>Delete</button>
          </div>
        </div>
        {TERMINAL.includes(job.status)
          ? <div style={{ marginTop: 14 }}><span className="jo-badge dead">{job.status}</span> <button className="jo-btn sm ghost" style={{ marginLeft: 8 }} onClick={() => onUpdate({ ...job, status: "Applied" })}>Reopen</button></div>
          : <Rail status={job.status} onSet={(s) => onUpdate({ ...job, status: s })} />}

        <label className="jo-label">Job Description</label>
        <textarea className="jo-textarea" value={job.jd || ""} placeholder="Paste the full job description here — everything the AI generates is tailored against it."
          onChange={(e) => onUpdate({ ...job, jd: e.target.value })} />

        <label className="jo-label">Notes</label>
        <textarea className="jo-textarea" style={{ minHeight: 70 }} value={job.notes || ""} placeholder="Recruiter names, deadlines, referral contacts…"
          onChange={(e) => onUpdate({ ...job, notes: e.target.value })} />

        <div className="jo-row">
          {outputs.map((o) => (
            <button key={o.key} className="jo-btn accent" disabled={!!busy} onClick={() => runAI(o.key)}>
              {busy === o.key ? <span><span className="jo-spin">◐</span> Working…</span> : o.btn}
            </button>
          ))}
          {job.link && (
            <button className="jo-btn accent" disabled={busy === "apply"} style={{ background: "var(--steel)", borderColor: "var(--steel)" }} onClick={async () => {
              setBusy("apply");
              try {
                await api.autoApply(job.id);
              } catch(e) {
                setError("Auto-Apply failed: " + e.message);
              }
              setBusy("");
            }}>
              {busy === "apply" ? <span><span className="jo-spin">◐</span> Starting…</span> : "Auto-Apply (Playwright)"}
            </button>
          )}
        </div>
        <div className="jo-note">
          Est. per run (approx): {outputs.map((o) => `${o.key} ~$${estCost(o.key).toFixed(3)}`).join(" · ")}
          {genModel ? ` · model ${genModel}` : ""}
        </div>
        {error && <div className="jo-error">{error}</div>}

        {job.ai?.applyReport && (
          <div style={{ marginTop: 12 }}>
            <div className="jo-output-title" style={{ color: "var(--steel)" }}>Last apply-assist run · {job.ai.applyReport.ats}</div>
            <div className="jo-output" style={{ borderLeftColor: "var(--steel)" }}>
              Filled {job.ai.applyReport.filled.length} field(s){job.ai.applyReport.uploaded.length ? `, attached resume to ${job.ai.applyReport.uploaded.length} upload(s)` : ""}.
              {job.ai.applyReport.filled.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12 }}>{job.ai.applyReport.filled.map((f) => f.label).join(" · ")}</div>
              )}
              {job.ai.applyReport.skipped.map((s, i) => <div key={i} className="jo-note">• {s}</div>)}
              {job.ai.applyReport.errors.map((e, i) => <div key={i} className="jo-error" style={{ fontSize: 12 }}>• {e}</div>)}
            </div>
          </div>
        )}

        {outputs.map((o) =>
          job.ai && job.ai[o.key] ? (
            <div key={o.key}>
              <div className="jo-output-h">
                <span className="jo-output-title" style={{ color: "var(--orange)" }}>{o.label}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="jo-btn sm ghost" onClick={() => copy(outputText(job.ai[o.key]))}>Copy</button>
                  {o.key === "tailor" && (
                    <button className="jo-btn sm accent" onClick={() => handleDownloadPDF(job.ai[o.key], job.company)}>Download PDF</button>
                  )}
                </div>
              </div>
              {o.key === "tailor" ? (
                <div className="jo-output">
                  ✓ Tailored resume generated for {job.company}. Use “Download PDF” to export it, or Copy for the raw JSON.
                </div>
              ) : (
                <div className="jo-output">{outputText(job.ai[o.key])}</div>
              )}
            </div>
          ) : null
        )}

        <div style={{ marginTop: 24, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <div className="jo-output-title">Mock Interview</div>
          <p className="jo-note">Chat with an AI hiring manager to practice for this role.</p>
          <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid var(--line)", padding: 12, marginTop: 8, background: "var(--paper)", display: "flex", flexDirection: "column", gap: 8 }}>
            {(job.ai?.chat || []).map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", background: msg.role === "user" ? "var(--card)" : "var(--card)", padding: "8px 12px", borderRadius: 4, maxWidth: "85%", border: msg.role === "user" ? "1px solid var(--orange)" : "1px solid var(--line)", borderLeft: msg.role === "assistant" ? "3px solid var(--orange)" : undefined }}>
                <div style={{ fontSize: 10, color: "var(--ink-soft)", marginBottom: 2, textTransform: "uppercase", fontWeight: 500 }}>{msg.role === "user" ? "You" : "Interviewer"}</div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{msg.content}</div>
              </div>
            ))}
            {chatBusy && <div style={{ alignSelf: "flex-start", padding: "8px 12px", color: "var(--ink-soft)" }}><span className="jo-spin">◐</span> Typing...</div>}
            {(job.ai?.chat || []).length === 0 && !chatBusy && <div style={{ color: "var(--ink-soft)", textAlign: "center", padding: 20 }}>No messages yet. Send a message to start!</div>}
          </div>
          <div className="jo-row" style={{ marginTop: 8, flexWrap: "nowrap" }}>
            <input className="jo-input" style={{ flex: 1 }} value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }} placeholder="Type your response..." />
            <button className="jo-btn accent" disabled={!chatMsg.trim() || chatBusy} onClick={handleChat}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Add Job ---------------- */
function AddJob({ onAdd }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [link, setLink] = useState("");
  const [jd, setJd] = useState("");
  const submit = () => {
    if (!company.trim() || !role.trim()) return;
    onAdd({
      id: Date.now().toString(36),
      company: company.trim(), role: role.trim(), link: link.trim(), jd,
      status: "Saved", created: new Date().toISOString(), notes: "", ai: {},
    });
    setCompany(""); setRole(""); setLink(""); setJd("");
  };
  return (
    <div className="jo-card">
      <div className="jo-output-title">Log a new target</div>
      <label className="jo-label">Company *</label>
      <input className="jo-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Northrop Grumman" />
      <label className="jo-label">Role *</label>
      <input className="jo-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Systems Engineering Intern" />
      <label className="jo-label">Posting URL</label>
      <input className="jo-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
      <label className="jo-label">Job Description (paste now or later)</label>
      <textarea className="jo-textarea" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full JD…" />
      <div className="jo-row">
        <button className="jo-btn" onClick={submit} disabled={!company.trim() || !role.trim()}>Add to Pipeline</button>
      </div>
    </div>
  );
}

/* ---------------- Analytics ---------------- */
const metric = (n, label, sub, color) => (
  <div style={{ flex: 1, minWidth: 160, padding: 16, background: "var(--paper)", border: "1px solid var(--line)" }}>
    <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color }}>{n}</div>
    <div style={{ fontSize: 12, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
    {sub && <div className="jo-note">{sub}</div>}
  </div>
);

function Analytics() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.getAnalytics().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="jo-card"><div className="jo-error">Couldn't load analytics: {err}</div></div>;
  if (!data) return <div className="jo-card">Loading analytics…</div>;

  const { funnel, rates, medianResponseDays, timeSeries, bySource, spend } = data;
  const money = (n) => `$${(n ?? 0).toFixed(2)}`;
  const maxWeek = Math.max(1, ...timeSeries.map((w) => w.applied));

  return (
    <div>
      <div className="jo-card">
        <div className="jo-output-title">Funnel</div>
        <p className="jo-note">Based on timestamped stage changes — moves through your pipeline over time.</p>
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          {metric(funnel.applied, "Applications", null, "var(--ink)")}
          {metric(`${rates.response}%`, "Response Rate", `${funnel.responded} heard back`, "var(--steel)")}
          {metric(`${rates.interview}%`, "Interview Rate", `${funnel.interviewed} screens/interviews`, "var(--orange)")}
          {metric(`${rates.offer}%`, "Offer Rate", `${funnel.offered} offers`, "var(--green)")}
          {metric(medianResponseDays == null ? "—" : `${medianResponseDays.toFixed(0)}d`, "Median Time to Response", null, "var(--ink)")}
        </div>
      </div>

      <div className="jo-card">
        <div className="jo-output-title">Applications per week</div>
        {timeSeries.length === 0 ? (
          <p className="jo-note">No applications yet. Move a job past “Saved” to start tracking.</p>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 140, marginTop: 16 }}>
            {timeSeries.map((w) => (
              <div key={w.week} style={{ flex: 1, textAlign: "center", minWidth: 24 }}>
                <div title={`${w.applied} applied, ${w.responded} responded`}
                  style={{ height: `${(w.applied / maxWeek) * 110}px`, background: "var(--orange)", borderRadius: "2px 2px 0 0" }} />
                <div style={{ fontSize: 9, color: "var(--ink-soft)", marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>{w.week.slice(5)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="jo-card">
        <div className="jo-output-title">Conversion by source</div>
        {bySource.length === 0 ? (
          <p className="jo-note">No application sources tracked yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-soft)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <th style={{ padding: "6px 8px" }}>Source</th>
                <th style={{ padding: "6px 8px" }}>Applied</th>
                <th style={{ padding: "6px 8px" }}>Responded</th>
                <th style={{ padding: "6px 8px" }}>Offers</th>
                <th style={{ padding: "6px 8px" }}>Resp. rate</th>
              </tr>
            </thead>
            <tbody>
              {bySource.map((s) => (
                <tr key={s.source} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 8px" }}>{s.source}</td>
                  <td style={{ padding: "6px 8px" }}>{s.applied}</td>
                  <td style={{ padding: "6px 8px" }}>{s.responded}</td>
                  <td style={{ padding: "6px 8px" }}>{s.offered}</td>
                  <td style={{ padding: "6px 8px" }}>{s.applied ? Math.round((s.responded / s.applied) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="jo-card">
        <div className="jo-output-title">Claude API spend</div>
        <p className="jo-note">Metered Anthropic API usage (separate from any Claude.ai subscription).</p>
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          {metric(money(spend.allTime), "All-time spend", `${spend.allTimeTokens.toLocaleString()} tokens`, "var(--ink)")}
          {metric(money(spend.last24h), "Last 24h", null, "var(--steel)")}
        </div>
      </div>
    </div>
  );
}

/* ---------------- App ---------------- */
export default function App() {
  const [state, setState] = useState({ profile: { text: "", json_data: {} }, jobs: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("pipeline");
  const [openId, setOpenId] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [settings, setSettings] = useState({});
  const [scanBusy, setScanBusy] = useState(false);
  const [scanSummary, setScanSummary] = useState("");
  const [parseBusy, setParseBusy] = useState(false);
  const [parseFlash, setParseFlash] = useState(false);
  const [config, setConfig] = useState({ models: [], rates: {} });
  const timers = useRef({});

  useEffect(() => {
    Promise.all([
      api.getProfile(), api.getJobs(), api.getInbox(), api.getCompanies(), api.getSettings(), api.getConfig(),
    ])
      .then(([profile, jobs, postings, comps, setts, cfg]) => {
        setState({ profile, jobs });
        setInbox(postings);
        setCompanies(comps);
        setSettings(setts);
        setConfig(cfg);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  const debounce = useCallback((key, fn, ms = 600) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  }, []);

  const updateJob = (job, { persisted = false } = {}) => {
    setState((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === job.id ? job : j)) }));
    if (!persisted) {
      const { id, company, role, link, jd, notes, status, ai } = job;
      debounce(`job:${id}`, () =>
        api.patchJob(id, { company, role, link, jd, notes, status, ai }).catch(console.error)
      );
    }
  };

  const addJob = async (job) => {
    setState((s) => ({ ...s, jobs: [job, ...s.jobs] }));
    setTab("pipeline");
    try {
      await api.addJob(job);
    } catch (e) {
      alert("Failed to save job: " + e.message);
      setState((s) => ({ ...s, jobs: s.jobs.filter((j) => j.id !== job.id) }));
    }
  };

  const deleteJob = (id) => {
    setState((s) => ({ ...s, jobs: s.jobs.filter((j) => j.id !== id) }));
    setOpenId(null);
    api.deleteJob(id).catch(console.error);
  };

  const setProfileText = (text) => {
    setState((s) => ({ ...s, profile: { ...s.profile, text } }));
    debounce("profile", () => api.saveProfile(text).catch(console.error));
  };

  const saveProfileNow = async () => {
    clearTimeout(timers.current["profile"]);
    try {
      await api.saveProfile(state.profile.text);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } catch (e) {
      alert("Save failed: " + e.message);
    }
  };

  const handleParseProfile = async () => {
    setParseBusy(true);
    try {
      const updated = await api.parseProfile();
      setState((s) => ({ ...s, profile: updated }));
      setParseFlash(true);
      setTimeout(() => setParseFlash(false), 1600);
    } catch (e) {
      alert("Parse failed: " + e.message);
    }
    setParseBusy(false);
  };

  const handleScan = async () => {
    setScanBusy(true);
    setScanSummary("");
    try {
      const r = await api.scan();
      const bits = [`${r.fetched} fetched`, `${r.new} new`, `${r.scored} scored`];
      if (r.belowThreshold) bits.push(`${r.belowThreshold} below threshold`);
      let msg = `Last scan: ${bits.join(", ")}.`;
      for (const extra of [...(r.notes ?? []), ...(r.errors ?? [])]) msg += ` ${extra}.`;
      setScanSummary(msg);
      setInbox(await api.getInbox());
    } catch (e) {
      setScanSummary("Scan failed: " + e.message);
    }
    setScanBusy(false);
  };

  const acceptPosting = async (p) => {
    setInbox((x) => x.filter((i) => i.id !== p.id));
    try {
      const job = await api.acceptPosting(p.id);
      setState((s) => ({ ...s, jobs: [job, ...s.jobs] }));
    } catch (e) {
      alert("Accept failed: " + e.message);
      setInbox(await api.getInbox());
    }
  };

  const dismissPosting = (p) => {
    setInbox((x) => x.filter((i) => i.id !== p.id));
    api.dismissPosting(p.id).catch(console.error);
  };

  const addCompany = async (company) => {
    try {
      const created = await api.addCompany(company);
      setCompanies((c) => [...c, { ...created, active: true }]);
    } catch (e) {
      alert("Failed to add company: " + e.message);
    }
  };

  const toggleCompany = (c) => {
    setCompanies((list) => list.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    api.setCompanyActive(c.id, !c.active).catch(console.error);
  };

  const removeCompany = (id) => {
    setCompanies((list) => list.filter((x) => x.id !== id));
    api.deleteCompany(id).catch(console.error);
  };

  const saveSettings = async (next) => {
    try {
      setSettings(await api.saveSettings(next));
      setInbox(await api.getInbox()); // min_score may have changed
    } catch (e) {
      alert("Failed to save settings: " + e.message);
    }
  };

  const counts = STAGES.reduce((a, s) => ({ ...a, [s]: state.jobs.filter((j) => j.status === s).length }), {});
  const dead = state.jobs.filter((j) => TERMINAL.includes(j.status)).length;
  const openJob = state.jobs.find((j) => j.id === openId);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }).toUpperCase();

  if (!loaded) return <div className="jo-root"><style>{css}</style><div className="jo-wrap" style={{ paddingTop: 60 }}>Loading…</div></div>;

  return (
    <div className="jo-root">
      <style>{css}</style>
      <div className="jo-wrap">
        <header className="jo-header">
          <div>
            <div className="jo-eyebrow">Application Ops · Flight Plan</div>
            <h1 className="jo-title">Job Ops Center</h1>
          </div>
          <div className="jo-header-meta">
            {today}<br />{state.jobs.length} TARGETS TRACKED
          </div>
        </header>

        {loadError && <div className="jo-error">Couldn't reach the server: {loadError}. Is it running on port 3001?</div>}

        <nav className="jo-tabs">
          {[
            ["pipeline", "PIPELINE"],
            ["inbox", inbox.length ? `INBOX (${inbox.length})` : "INBOX"],
            ["analytics", "ANALYTICS"],
            ["add", "+ ADD JOB"],
            ["profile", "PROFILE"],
            ["sources", "SOURCES"],
          ].map(([k, l]) => (
            <button key={k} className={"jo-tab " + (tab === k && !openJob ? "active" : "")} onClick={() => { setTab(k); setOpenId(null); }}>{l}</button>
          ))}
        </nav>

        {openJob ? (
          <JobDetail job={openJob} profile={state.profile} rates={config.rates} genModel={settings.gen_model}
            onUpdate={updateJob} onDelete={deleteJob} onBack={() => setOpenId(null)} />
        ) : tab === "inbox" ? (
          <Inbox postings={inbox} scanBusy={scanBusy} scanSummary={scanSummary}
            onScan={handleScan} onAccept={acceptPosting} onDismiss={dismissPosting} />
        ) : tab === "analytics" ? (
          <Analytics />
        ) : tab === "sources" ? (
          <Sources companies={companies} settings={settings} models={config.models} onAddCompany={addCompany}
            onToggleCompany={toggleCompany} onDeleteCompany={removeCompany} onSaveSettings={saveSettings} />
        ) : tab === "profile" ? (
          <div className="jo-card">
            <div className="jo-output-title">Your background — written once, used everywhere</div>
            <p className="jo-note">Paste your resume text, key projects, skills, and anything you want emphasized. Every cover letter, fit analysis, and interview prep is generated from this.</p>
            <label className="jo-label">Profile / Resume Text</label>
            <textarea className="jo-textarea" style={{ minHeight: 320 }} value={state.profile.text}
              onChange={(e) => setProfileText(e.target.value)}
              placeholder={"Example:\nComputer Engineering @ UMD, GPA 3.69\nSystems Engineering Intern @ Booz Allen Hamilton\nGround Station Lead, UMD Satellite Development Program — Python telemetry decoding, real-time visualization, packet parsing\nSkills: Python, MATLAB, C, Firebase, PCB design…"} />
            <div className="jo-row" style={{ alignItems: "center" }}>
              <button className="jo-btn" onClick={saveProfileNow}>Save Profile</button>
              {savedFlash && <span className="jo-saved-flash">✓ Saved</span>}
              <button className="jo-btn accent" disabled={parseBusy} onClick={handleParseProfile}>
                {parseBusy ? <span><span className="jo-spin">◐</span> Parsing…</span> : "Generate Structured Resume"}
              </button>
              {parseFlash && <span className="jo-saved-flash">✓ Structured data ready</span>}
            </div>
          </div>
        ) : tab === "add" ? (
          <AddJob onAdd={addJob} />
        ) : (
          <div>
            <div className="jo-stats">
              {STAGES.map((s) => (
                <div className="jo-stat" key={s}><div className="jo-stat-n">{counts[s]}</div><div className="jo-stat-l">{s}</div></div>
              ))}
              <div className="jo-stat"><div className="jo-stat-n" style={{ color: "var(--red)" }}>{dead}</div><div className="jo-stat-l">Closed</div></div>
            </div>

            {state.jobs.length === 0 ? (
              <div className="jo-empty">
                <div className="jo-empty-h">No targets on the board</div>
                <p>Add your first job, paste the description, and generate a tailored cover letter in one click.</p>
                <div className="jo-row" style={{ justifyContent: "center" }}>
                  <button className="jo-btn accent" onClick={() => setTab("add")}>+ Add First Job</button>
                </div>
              </div>
            ) : (
              state.jobs.map((j) => (
                <div className="jo-card" key={j.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(j.id)}>
                  <div className="jo-card-h">
                    <div>
                      <div className="jo-company">{j.company}</div>
                      <div className="jo-role">{j.role}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {j.status === "Offer" && <span className="jo-badge offer">Offer</span>}
                      {TERMINAL.includes(j.status) && <span className="jo-badge dead">{j.status}</span>}
                      {j.ai && (j.ai.cover || j.ai.fit || j.ai.prep) && <span className="jo-badge">AI ✓</span>}
                      <span className="jo-badge">{new Date(j.created).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {!TERMINAL.includes(j.status) && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Rail status={j.status} onSet={(s) => updateJob({ ...j, status: s })} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
