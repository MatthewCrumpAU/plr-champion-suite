import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIRequest, AIStreamEvent } from "./provider";
import { anthropicParams } from "./request-params";

function friendlyError(err: unknown): { message: string; retryable: boolean; status?: number } {
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    if (status === 401) return { message: "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in your environment settings.", retryable: false, status };
    if (status === 403) return { message: "This API key does not have permission for the selected model.", retryable: false, status };
    if (status === 404) return { message: "The selected model was not found for this API key. Choose another model in Settings.", retryable: false, status };
    if (status === 400) return { message: `Anthropic could not process the request: ${err.message}`, retryable: false, status };
    if (status === 413) return { message: "The request was too large. Select less source text and try again.", retryable: false, status };
    if (status === 429) return { message: "Rate limit reached on your Anthropic account. Wait a moment and retry.", retryable: true, status };
    if (status === 529 || (status ?? 0) >= 500) return { message: "Anthropic is temporarily overloaded or unavailable. Retry in a few seconds.", retryable: true, status };
    return { message: err.message, retryable: false, status };
  }
  if (err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message))) return { message: "Request cancelled.", retryable: true };
  return { message: err instanceof Error ? err.message : "Unknown AI error.", retryable: true };
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly label = "Anthropic (Claude)";

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY && process.env.PLR_AI_DISABLED !== "true";
  }

  async *stream(req: AIRequest, signal?: AbortSignal): AsyncIterable<AIStreamEvent> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 240_000 });
    try {
      // Sampling parameters, thinking and effort follow the Claude 5.x rules — see request-params.ts.
      const stream = client.messages.stream(
        anthropicParams(req),
        { signal },
      );
      let chars = 0;
      // Thinking blocks (always present on Opus 5.5, often on Haiku 5.5) are skipped: only text reaches the app.
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          chars += event.delta.text.length;
          yield { type: "delta", text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      if (!chars && final.stop_reason === "refusal") {
        yield { type: "error", message: "Claude declined this request. Rephrase it or choose different source text.", retryable: false };
        return;
      }
      if (!chars && final.stop_reason === "max_tokens") {
        yield { type: "error", message: "The model reached its length limit before writing anything. Try again, choose a shorter piece of text, or raise PLR_AI_MAX_OUTPUT_TOKENS.", retryable: true };
        return;
      }
      yield {
        type: "done",
        model: final.model,
        stopReason: final.stop_reason ?? null,
        usage: { inputTokens: final.usage.input_tokens ?? 0, outputTokens: final.usage.output_tokens ?? 0 },
      };
    } catch (err) {
      yield { type: "error", ...friendlyError(err) };
    }
  }
}
