import Anthropic from "@anthropic-ai/sdk";
import * as db from "./db.js";
import { costOf } from "./costs.js";

const client = new Anthropic();

// Models are configurable in Settings; fall back to env, then a sane default.
const genModel = () =>
  db.getSettings().gen_model || process.env.CLAUDE_MODEL || "claude-opus-4-8";
const scoringModel = () =>
  db.getSettings().scoring_model || process.env.SCORING_MODEL || "claude-haiku-4-5";

// Record real token usage + cost for every Claude call so the UI can show spend.
function logUsage(model, kind, usage) {
  if (!usage) return;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  db.logUsage({ model, kind, input_tokens: input, output_tokens: output, cost: costOf(model, input, output) });
}

const firstText = (response) => response.content.find((b) => b.type === "text")?.text ?? "";

const PROMPTS = {
  cover: (base) =>
    base +
    "Write a tailored, specific cover letter (under 320 words) for this candidate and role. Concrete, confident, no clichés like 'I am writing to express'. Reference real overlaps between the profile and the job description. Never invent experience the profile doesn't contain. Plain text only.",
  fit: (base) =>
    base +
    "Give a fit analysis: 1) Fit score out of 10 with one-line justification. 2) Top 4 strengths to emphasize, each tied to a JD requirement. 3) Top 3 gaps and how to address each in the application or interview. 4) 3 resume bullet rewrites tailored to this JD — rephrase and reorder only, never invent facts. Plain text, concise.",
  prep: (base) =>
    base +
    "Generate interview prep: 6 likely interview questions for this specific role (mix behavioral + technical), and for each, 2-3 bullet talking points drawn from the candidate profile. End with 3 sharp questions the candidate should ask the interviewer. Plain text, concise.",
  tailor: (base) =>
    base +
    "You are an expert resume writer. Given the candidate's master structured resume (in CANDIDATE PROFILE) and the job description, rewrite and select the most relevant bullets for this specific role. Output MUST match the provided JSON schema. Ensure the tailored resume highlights relevant skills and experiences. DO NOT invent facts.",
};

export const KINDS = Object.keys(PROMPTS);

// Rough output-token guesses per kind, for the pre-spend cost estimate only.
const OUTPUT_ESTIMATE = { cover: 500, fit: 750, prep: 900, tailor: 1500 };

export const RESUME_SCHEMA = {
  type: "object",
  properties: {
    basics: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        url: { type: "string" },
        location: { type: "string" },
      },
      required: ["name", "email", "phone", "url", "location"],
      additionalProperties: false,
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          degree: { type: "string" },
          date: { type: "string" },
          gpa: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["institution", "degree", "date", "gpa", "bullets"],
        additionalProperties: false,
      },
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          position: { type: "string" },
          date: { type: "string" },
          location: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["company", "position", "date", "location", "bullets"],
        additionalProperties: false,
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          url: { type: "string" },
          date: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description", "url", "date", "bullets"],
        additionalProperties: false,
      },
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          items: { type: "array", items: { type: "string" } },
        },
        required: ["category", "items"],
        additionalProperties: false,
      },
    },
  },
  required: ["basics", "education", "experience", "projects", "skills"],
  additionalProperties: false,
};

export async function parseMasterResume(profileText) {
  const model = genModel();
  const prompt = `Parse the following resume/profile text into the required structured JSON format.
Extract all education, experience, projects, and skills. Do not drop any information, just format it correctly.

CANDIDATE PROFILE:
${profileText}`;

  const response = await client.messages.create({
    model,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: RESUME_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  logUsage(model, "parse", response.usage);
  return JSON.parse(firstText(response) || "{}");
}

// Build the generation prompt — shared by generate() and estimate().
function buildGenPrompt(kind, profile, job) {
  const profileString =
    kind === "tailor" && profile.json_data
      ? JSON.stringify(profile.json_data, null, 2)
      : profile.text || profile;
  const base = `CANDIDATE PROFILE:\n${profileString}\n\nCOMPANY: ${job.company}\nROLE: ${job.role}\n\nJOB DESCRIPTION:\n${job.jd || "(not provided)"}\n\n`;
  return PROMPTS[kind](base);
}

export async function generate(kind, profile, job) {
  const model = genModel();
  const isTailor = kind === "tailor";
  const request = {
    model,
    max_tokens: 16000,
    messages: [{ role: "user", content: buildGenPrompt(kind, profile, job) }],
  };
  if (isTailor) {
    request.output_config = { format: { type: "json_schema", schema: RESUME_SCHEMA } };
  } else {
    request.thinking = { type: "adaptive" };
  }

  const response = await client.messages.create(request);
  logUsage(model, kind, response.usage);
  const text = firstText(response);
  return isTailor ? JSON.parse(text || "{}") : text;
}

// Pre-spend estimate: exact input tokens via count_tokens + a typical output guess.
export async function estimate(kind, profile, job) {
  const model = genModel();
  const count = await client.messages.countTokens({
    model,
    messages: [{ role: "user", content: buildGenPrompt(kind, profile, job) }],
  });
  const input = count.input_tokens ?? 0;
  const output = OUTPUT_ESTIMATE[kind] ?? 700;
  return { model, input_tokens: input, est_output_tokens: output, est_cost: costOf(model, input, output) };
}

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "Fit score from 0 (no fit) to 10 (ideal fit)" },
    reason: { type: "string", description: "One sentence justifying the score" },
  },
  required: ["score", "reason"],
  additionalProperties: false,
};

export async function scoreFit(profile, posting, settings) {
  const model = scoringModel();
  const prompt = `You are screening job postings for a candidate. Score how well this posting fits them, 0-10 (0 = no fit, 10 = ideal). Consider role match, seniority (they want internships/early-career), skills overlap, and location preferences.

CANDIDATE PROFILE:
${profile}

LOCATION PREFERENCES: ${settings.locations || "(any)"}

POSTING:
Company: ${posting.company}
Title: ${posting.title}
Location: ${posting.location || "(unspecified)"}
${posting.jd ? `Description:\n${posting.jd.slice(0, 4000)}` : "(no description available — score on title/company/location)"}`;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: SCORE_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  logUsage(model, "score", response.usage);
  const parsed = JSON.parse(firstText(response) || "{}");
  return {
    score: Math.max(0, Math.min(10, Number(parsed.score) || 0)),
    reason: String(parsed.reason ?? "").slice(0, 500),
  };
}

const FORM_ANSWERS_SCHEMA = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          value: { type: "string" },
        },
        required: ["id", "value"],
        additionalProperties: false,
      },
    },
  },
  required: ["answers"],
  additionalProperties: false,
};

export async function answerForm(fields, profile, answersMap) {
  const model = genModel();
  const prompt = `You are an AI assistant helping a candidate fill out a job application form.
I will provide you with the candidate's profile, a map of previously answered questions, and a list of form fields from the current application page.
Your task is to determine the correct value to put in each form field.
For dropdowns, checkboxes, and radio buttons, try to match the expected values.
For checkboxes (like terms of service), output 'true' or 'yes'.
If you don't know the answer and can't deduce it, leave the value empty string.

CANDIDATE PROFILE (JSON):
${JSON.stringify(profile.json_data, null, 2)}

PREVIOUS ANSWERS MAP (JSON):
${JSON.stringify(answersMap, null, 2)}

FORM FIELDS TO ANSWER (JSON):
${JSON.stringify(fields, null, 2)}

Return a JSON array of answers where each object has 'id' (matching the field id) and 'value'.`;

  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    output_config: { format: { type: "json_schema", schema: FORM_ANSWERS_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  logUsage(model, "apply", response.usage);
  const parsed = JSON.parse(firstText(response) || '{"answers":[]}');
  return parsed.answers || [];
}

export async function chat(job, profile, history, newMessage) {
  const model = genModel();
  const profileString = profile.text || JSON.stringify(profile.json_data, null, 2) || "(No profile)";
  const systemPrompt = `You are a strict but encouraging hiring manager for ${job.company} hiring a ${job.role}.
You are conducting a mock interview with a candidate.
Be professional, ask one question at a time (mix behavioral and technical), and provide brief, constructive feedback on their answers before moving to the next question.
Keep your responses concise.

CANDIDATE PROFILE:
${profileString}

JOB DESCRIPTION:
${job.jd || "(not provided)"}`;

  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [...(history || []), { role: "user", content: newMessage }],
  });
  logUsage(model, "chat", response.usage);
  return firstText(response);
}
