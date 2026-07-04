import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";
// Scoring runs on every discovered posting, so it defaults to the cheap, fast tier.
const SCORING_MODEL = process.env.SCORING_MODEL || "claude-haiku-4-5";

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
  const prompt = `Parse the following resume/profile text into the required structured JSON format. 
Extract all education, experience, projects, and skills. Do not drop any information, just format it correctly.

CANDIDATE PROFILE:
${profileText}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: RESUME_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  
  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

export async function generate(kind, profile, job) {
  const isTailor = kind === "tailor";
  // If tailoring, pass the structured JSON as the profile string
  const profileString = isTailor && profile.json_data 
    ? JSON.stringify(profile.json_data, null, 2) 
    : (profile.text || profile);
    
  const base = `CANDIDATE PROFILE:\n${profileString}\n\nCOMPANY: ${job.company}\nROLE: ${job.role}\n\nJOB DESCRIPTION:\n${job.jd || "(not provided)"}\n\n`;
  
  const request = {
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: "user", content: PROMPTS[kind](base) }],
  };

  if (isTailor) {
    request.output_config = { format: { type: "json_schema", schema: RESUME_SCHEMA } };
  } else {
    request.thinking = { type: "adaptive" };
  }

  const response = await client.messages.create(request);
  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  
  if (isTailor) {
    return JSON.parse(text); // Return parsed JSON for tailor
  }
  
  return text;
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
    model: SCORING_MODEL,
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: SCORE_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  const parsed = JSON.parse(text);
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
          value: { type: "string" }
        },
        required: ["id", "value"],
        additionalProperties: false
      }
    }
  },
  required: ["answers"],
  additionalProperties: false
};

export async function answerForm(fields, profile, answersMap) {
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
    model: MODEL,
    max_tokens: 4000,
    output_config: { format: { type: "json_schema", schema: FORM_ANSWERS_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "{\"answers\":[]}";
  const parsed = JSON.parse(text);
  return parsed.answers || [];
}

export async function chat(job, profile, history, newMessage) {
  const profileString = profile.text || JSON.stringify(profile.json_data, null, 2) || "(No profile)";
  const systemPrompt = `You are a strict but encouraging hiring manager for ${job.company} hiring a ${job.role}.
You are conducting a mock interview with a candidate.
Be professional, ask one question at a time (mix behavioral and technical), and provide brief, constructive feedback on their answers before moving to the next question.
Keep your responses concise.

CANDIDATE PROFILE:
${profileString}

JOB DESCRIPTION:
${job.jd || "(not provided)"}`;

  const messages = [...(history || []), { role: "user", content: newMessage }];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: messages,
  });
  
  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  return text;
}
