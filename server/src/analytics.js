import * as db from "./db.js";

const APPLIED_STAGES = new Set(["Applied", "Screen", "Interview", "Offer", "Rejected", "Withdrawn"]);
const RESPONSE_STAGES = new Set(["Screen", "Interview", "Offer", "Rejected"]);
const INTERVIEW_STAGES = new Set(["Screen", "Interview", "Offer"]);

const rate = (num, denom) => (denom ? Math.round((num / denom) * 100) : 0);

function weekStart(iso) {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// earliest event timestamp whose to_stage passes `test`
function firstReached(events, test) {
  let best = null;
  for (const e of events) {
    if (e.to_stage && test(e.to_stage) && (!best || e.at < best)) best = e.at;
  }
  return best;
}

export function computeAnalytics() {
  const jobs = db.listJobs();
  const events = db.listEvents();

  const byJob = new Map();
  for (const e of events) {
    if (!byJob.has(e.job_id)) byJob.set(e.job_id, []);
    byJob.get(e.job_id).push(e);
  }

  const milestones = jobs.map((j) => {
    const evs = byJob.get(j.id) ?? [];
    const appliedAt = firstReached(evs, (s) => APPLIED_STAGES.has(s));
    const responseAt = firstReached(evs, (s) => RESPONSE_STAGES.has(s));
    return {
      source: j.source || "manual",
      appliedAt,
      responseAt,
      interviewedAt: firstReached(evs, (s) => INTERVIEW_STAGES.has(s)),
      offeredAt: firstReached(evs, (s) => s === "Offer"),
      responseDays:
        appliedAt && responseAt ? (new Date(responseAt) - new Date(appliedAt)) / 86_400_000 : null,
    };
  });

  const applied = milestones.filter((m) => m.appliedAt);
  const responded = milestones.filter((m) => m.responseAt);
  const interviewed = milestones.filter((m) => m.interviewedAt);
  const offered = milestones.filter((m) => m.offeredAt);

  // Weekly application counts (buckets that actually have data).
  const weekly = {};
  for (const m of applied) {
    const wk = weekStart(m.appliedAt);
    weekly[wk] ??= { week: wk, applied: 0, responded: 0 };
    weekly[wk].applied++;
  }
  for (const m of responded) {
    const wk = weekStart(m.appliedAt ?? m.responseAt);
    weekly[wk] ??= { week: wk, applied: 0, responded: 0 };
    weekly[wk].responded++;
  }
  const timeSeries = Object.values(weekly).sort((a, b) => a.week.localeCompare(b.week));

  // Per-source conversion.
  const sources = {};
  for (const m of milestones) {
    const s = (sources[m.source] ??= { source: m.source, applied: 0, responded: 0, offered: 0 });
    if (m.appliedAt) s.applied++;
    if (m.responseAt) s.responded++;
    if (m.offeredAt) s.offered++;
  }
  const bySource = Object.values(sources)
    .filter((s) => s.applied > 0)
    .sort((a, b) => b.applied - a.applied);

  return {
    funnel: {
      applied: applied.length,
      responded: responded.length,
      interviewed: interviewed.length,
      offered: offered.length,
    },
    rates: {
      response: rate(responded.length, applied.length),
      interview: rate(interviewed.length, applied.length),
      offer: rate(offered.length, applied.length),
    },
    medianResponseDays: median(responded.map((m) => m.responseDays).filter((d) => d != null)),
    timeSeries,
    bySource,
    spend: db.getSpend(),
  };
}
