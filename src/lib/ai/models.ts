/**
 * Model catalogue and published list prices (USD per million tokens), used for *estimated* cost display.
 * Prices from Anthropic's pricing page (checked October 2026). Actual billing is whatever Anthropic charges.
 */

export interface AIModelInfo {
  id: string;
  label: string;
  description: string;
  inputPerMTok: number;
  outputPerMTok: number;
  /** Optional higher tier for long prompts. */
  longPrompt?: { thresholdTokens: number; inputPerMTok: number; outputPerMTok: number };
}

export const AI_MODELS: AIModelInfo[] = [
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    description: "Balanced quality and cost. Recommended default for writing.",
    inputPerMTok: 2,
    outputPerMTok: 10,
  },
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    description: "Highest quality for long-form rewriting and rebrands.",
    inputPerMTok: 4,
    outputPerMTok: 20,
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    description: "Fastest and cheapest. Good for names, posts and short copy.",
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    longPrompt: { thresholdTokens: 100_000, inputPerMTok: 0.5, outputPerMTok: 2.5 },
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-5-5";

export function findModel(id: string | null | undefined): AIModelInfo | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

/** Estimated USD cost for a request. Returns null when the model's price is unknown. */
export function estimateCostUsd(modelId: string, inputTokens: number, outputTokens: number): number | null {
  const m = findModel(modelId);
  if (!m) return null;
  let inRate = m.inputPerMTok;
  let outRate = m.outputPerMTok;
  if (m.longPrompt && inputTokens > m.longPrompt.thresholdTokens) {
    inRate = m.longPrompt.inputPerMTok;
    outRate = m.longPrompt.outputPerMTok;
  }
  return (inputTokens * inRate + outputTokens * outRate) / 1_000_000;
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null) return "unknown";
  if (n === 0) return "$0.00";
  if (n < 0.01) return `<$0.01`;
  return `$${n.toFixed(n < 1 ? 3 : 2)}`;
}
