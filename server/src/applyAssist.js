import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import * as db from "./db.js";
import * as claude from "./claude.js";
import { renderResumePdf } from "./resumePdf.js";

// Full-prefill ATSs vs. SPA/iframe-heavy ones we only open for manual completion.
function detectAts(url) {
  const u = url.toLowerCase();
  if (u.includes("greenhouse")) return { name: "greenhouse", supported: true };
  if (u.includes("lever.co")) return { name: "lever", supported: true };
  if (u.includes("ashbyhq")) return { name: "ashby", supported: true };
  if (u.includes("myworkdayjobs") || u.includes("workday")) return { name: "workday", supported: false };
  if (u.includes("taleo")) return { name: "taleo", supported: false };
  return { name: "unknown", supported: true }; // best-effort attempt
}

// Render the tailored resume (or the master structured resume) to a temp PDF.
async function buildResumePdf(job, profile) {
  const tailored = job.ai?.tailor;
  const data = tailored?.basics ? tailored : profile.json_data?.basics ? profile.json_data : null;
  if (!data) return null;
  const settings = db.getSettings();
  const options = {
    template: settings.resume_template,
    primaryColor: settings.resume_color,
    fontFamily: settings.resume_font,
  };
  const out = path.join(os.tmpdir(), `resume-${randomUUID()}.pdf`);
  try {
    await renderResumePdf(data, out, options);
    return out;
  } catch (e) {
    console.error("Resume PDF render failed:", e.message);
    return null;
  }
}

function saveReport(jobId, report) {
  const fresh = db.getJob(jobId);
  if (fresh) db.updateJob(jobId, { ai: { ...fresh.ai, applyReport: { ...report, at: new Date().toISOString() } } });
}

export async function runApplyAssist(jobId) {
  const job = db.getJob(jobId);
  if (!job || !job.link) throw new Error("Job or link not found");

  const profile = db.getProfile();
  const answersMap = db.getAnswers();
  const ats = detectAts(job.link);
  const report = { ats: ats.name, filled: [], uploaded: [], skipped: [], errors: [] };

  console.log(`Starting Apply Assist for ${job.company} — ${job.role} (ATS: ${ats.name})`);
  const browser = await chromium.launch({ headless: false });
  const page = await (await browser.newContext()).newPage();

  try {
    await page.goto(job.link, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(2000);

    if (!ats.supported) {
      report.skipped.push(`${ats.name} forms are multi-step/iframe-based — opened for manual completion, no auto-fill attempted.`);
      console.log(`${ats.name} not auto-fillable. Browser left open for manual completion.`);
      saveReport(jobId, report);
      return;
    }

    const fields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
      return inputs
        .map((i) => {
          let label = "";
          if (i.labels && i.labels.length > 0) label = i.labels[0].innerText;
          else if (i.closest("label")) label = i.closest("label").innerText;
          else {
            const prev = i.previousElementSibling;
            if (prev && prev.tagName !== "INPUT") label = prev.innerText;
            if (!label || label.trim().length === 0) label = i.getAttribute("aria-label") || i.name || i.id;
          }
          let options = [];
          if (i.tagName.toLowerCase() === "select") options = Array.from(i.options).map((o) => o.innerText.trim());
          return {
            id: i.id || undefined,
            name: i.name || undefined,
            type: i.type || i.tagName.toLowerCase(),
            label: label?.trim(),
            options: options.length ? options : undefined,
          };
        })
        .filter((f) => f.label && f.id);
    });

    if (fields.length === 0) {
      report.skipped.push("No labeled form fields with IDs found — opened for manual completion.");
      console.log("No fillable fields found. Browser left open.");
      saveReport(jobId, report);
      return;
    }

    console.log(`Extracted ${fields.length} fields. Requesting AI mapping…`);
    const answers = await claude.answerForm(fields, profile, answersMap);

    for (const ans of answers) {
      if (!ans.value || !ans.id) continue;
      const field = fields.find((f) => f.id === ans.id);
      if (!field || field.type === "file") continue;
      const selector = `[id="${ans.id}"]`;
      try {
        if (field.type === "checkbox" || field.type === "radio") {
          if (["true", "yes", "on"].includes(ans.value.toLowerCase())) await page.check(selector, { force: true });
        } else if (field.type === "select-one" || field.type === "select-multiple") {
          await page.selectOption(selector, { label: ans.value }).catch(() => page.selectOption(selector, ans.value));
        } else {
          await page.fill(selector, ans.value);
        }
        report.filled.push({ label: field.label, value: ans.value });
        if (field.label) db.saveAnswer(field.label, ans.value);
      } catch (e) {
        report.errors.push(`fill ${field.label || ans.id}: ${e.message}`);
      }
    }

    // Upload the tailored resume PDF into any resume/CV file input.
    const pdfPath = await buildResumePdf(job, profile);
    if (pdfPath) {
      const fileFields = fields.filter(
        (f) => f.type === "file" && /resume|cv|attach/i.test(`${f.label || ""} ${f.name || ""} ${f.id}`)
      );
      for (const f of fileFields) {
        try {
          await page.setInputFiles(`[id="${f.id}"]`, pdfPath);
          report.uploaded.push(f.label || f.id);
        } catch (e) {
          report.errors.push(`upload ${f.label || f.id}: ${e.message}`);
        }
      }
    } else {
      report.skipped.push("No structured resume available to attach (generate the tailored resume first).");
    }

    console.log(
      `Auto-fill complete — filled ${report.filled.length}, uploaded ${report.uploaded.length}. Review and submit in the open browser window.`
    );
    saveReport(jobId, report);
    // Browser intentionally left open for the human to review + submit.
  } catch (err) {
    report.errors.push(err.message);
    saveReport(jobId, report);
    console.error("Apply assist error:", err);
  }
}
