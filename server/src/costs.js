// Per-model pricing, US$ per 1M tokens. Keep in sync with current Anthropic tiers.
export const RATES = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

// Models offered in the UI pickers.
export const MODEL_OPTIONS = [
  { id: "claude-opus-4-8", label: "Opus 4.8 — best" },
  { id: "claude-sonnet-5", label: "Sonnet 5 — balanced" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — cheapest" },
];

export function costOf(model, inputTokens = 0, outputTokens = 0) {
  const r = RATES[model] ?? RATES["claude-opus-4-8"];
  return (inputTokens * r.in + outputTokens * r.out) / 1e6;
}
