import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIRequest, AIStreamEvent } from "./provider";

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
      const stream = client.messages.stream(
        {
          model: req.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: req.messages,
          ...(req.temperature != null ? { temperature: req.temperature } : {}),
        },
        { signal },
      );
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "delta", text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
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
