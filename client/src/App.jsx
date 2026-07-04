import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "./api.js";

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

/* ---------------- Job Detail ---------------- */
function JobDetail({ job, profile, onUpdate, onDelete, onBack }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const runAI = async (kind) => {
    if (!profile.trim()) {
      alert("Add your background in the Profile tab first — the AI needs it to tailor output.");
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
  ];

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
        </div>
        {error && <div className="jo-error">{error}</div>}

        {outputs.map((o) =>
          job.ai && job.ai[o.key] ? (
            <div key={o.key}>
              <div className="jo-output-h">
                <span className="jo-output-title" style={{ color: "var(--orange)" }}>{o.label}</span>
                <button className="jo-btn sm ghost" onClick={() => copy(job.ai[o.key])}>Copy</button>
              </div>
              <div className="jo-output">{job.ai[o.key]}</div>
            </div>
          ) : null
        )}
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

/* ---------------- App ---------------- */
export default function App() {
  const [state, setState] = useState({ profile: "", jobs: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("pipeline");
  const [openId, setOpenId] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const timers = useRef({});

  useEffect(() => {
    Promise.all([api.getProfile(), api.getJobs()])
      .then(([profile, jobs]) => setState({ profile, jobs }))
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

  const setProfile = (profile) => {
    setState((s) => ({ ...s, profile }));
    debounce("profile", () => api.saveProfile(profile).catch(console.error));
  };

  const saveProfileNow = async () => {
    clearTimeout(timers.current["profile"]);
    try {
      await api.saveProfile(state.profile);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } catch (e) {
      alert("Save failed: " + e.message);
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
          {[["pipeline", "PIPELINE"], ["add", "+ ADD JOB"], ["profile", "PROFILE"]].map(([k, l]) => (
            <button key={k} className={"jo-tab " + (tab === k && !openJob ? "active" : "")} onClick={() => { setTab(k); setOpenId(null); }}>{l}</button>
          ))}
        </nav>

        {openJob ? (
          <JobDetail job={openJob} profile={state.profile} onUpdate={updateJob} onDelete={deleteJob} onBack={() => setOpenId(null)} />
        ) : tab === "profile" ? (
          <div className="jo-card">
            <div className="jo-output-title">Your background — written once, used everywhere</div>
            <p className="jo-note">Paste your resume text, key projects, skills, and anything you want emphasized. Every cover letter, fit analysis, and interview prep is generated from this.</p>
            <label className="jo-label">Profile / Resume Text</label>
            <textarea className="jo-textarea" style={{ minHeight: 320 }} value={state.profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder={"Example:\nComputer Engineering @ UMD, GPA 3.69\nSystems Engineering Intern @ Booz Allen Hamilton\nGround Station Lead, UMD Satellite Development Program — Python telemetry decoding, real-time visualization, packet parsing\nSkills: Python, MATLAB, C, Firebase, PCB design…"} />
            <div className="jo-row" style={{ alignItems: "center" }}>
              <button className="jo-btn" onClick={saveProfileNow}>Save Profile</button>
              {savedFlash && <span className="jo-saved-flash">✓ Saved</span>}
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
