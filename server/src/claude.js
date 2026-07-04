import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

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
};

export const KINDS = Object.keys(PROMPTS);

export async function generate(kind, profile, job) {
  const base = `CANDIDATE PROFILE:\n${profile}\n\nCOMPANY: ${job.company}\nROLE: ${job.role}\n\nJOB DESCRIPTION:\n${job.jd || "(not provided)"}\n\n`;
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: PROMPTS[kind](base) }],
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
