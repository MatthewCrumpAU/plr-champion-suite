import type { AIRequest } from "./provider";

/**
 * Builds the Anthropic Messages API parameters for a request, following the rules of the current
 * Claude 5.x models (checked against Anthropic's migration guides, October 2026):
 *
 * - `temperature`, `top_p` and `top_k` are never sent. Claude Sonnet 5.5, Opus 5.5 and Haiku 5.5
 *   return a 400 error for any non-default value.
 * - No assistant prefill (rejected by all three): requests always end with the user's message.
 * - Thinking is on by default and counts towards `max_tokens`. The studio's tasks are plain writing
 *   with no tools, so: on Sonnet 5.5 up-front thinking is turned off (`between_tools`); on Opus 5.5
 *   (thinking can't be turned off) and Haiku 5.5 a modest `effort` keeps thinking short; and every
 *   request gets headroom on top of the visible-text limit so thinking can't crowd out the answer.
 * - Older or unrecognised models get a plain request without the 5.x-only fields.
 *
 * Thinking tokens are billed as output tokens; the usage Anthropic returns already includes them,
 * so the estimated cost shown in the app stays accurate.
 */

export type Effort = "low" | "medium" | "high";

export interface AnthropicParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  thinking?: { type: "between_tools" };
  output_config?: { effort: Effort };
}

/** Claude 5.x model ids (Sonnet, Opus, Haiku, Fable, Mythos), including dated snapshots. */
const MODEL_5X = /^claude-(sonnet|opus|haiku|fable|mythos)-5(?:[-.]\d+)?(?:-\d{8})?$/;
const SONNET_5_5 = /^claude-sonnet-5-5(?:-\d{8})?$/;

export function isClaude5x(model: string): boolean {
  return MODEL_5X.test(model.trim());
}

/** Short answers (names, posts, the connection test) need little reasoning; long-form writing gets a bit more. */
export function effortFor(req: Pick<AIRequest, "maxTokens" | "task">): Effort {
  if (req.task === "test.ping" || req.maxTokens <= 2500) return "low";
  return "medium";
}

/** Extra output allowance for thinking, on top of the visible-text limit the task asked for. */
export function thinkingHeadroom(model: string, maxTokens: number): number {
  if (!isClaude5x(model)) return 0;
  // Sonnet 5.5 with up-front thinking off still gets a small margin.
  if (SONNET_5_5.test(model)) return 1024;
  return Math.min(16_000, Math.max(2048, Math.round(maxTokens * 0.5)));
}

export function anthropicParams(req: AIRequest): AnthropicParams {
  const model = req.model.trim();
  // Never end on an assistant turn (prefill is rejected): drop trailing assistant messages.
  const messages = [...req.messages];
  while (messages.length && messages[messages.length - 1].role === "assistant") messages.pop();
  const params: AnthropicParams = {
    model,
    max_tokens: req.maxTokens + thinkingHeadroom(model, req.maxTokens),
    system: req.system,
    messages,
  };
  if (isClaude5x(model)) {
    params.output_config = { effort: effortFor(req) };
    if (SONNET_5_5.test(model)) params.thinking = { type: "between_tools" };
  }
  return params;
}
