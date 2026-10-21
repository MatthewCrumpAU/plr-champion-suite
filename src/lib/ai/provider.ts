/**
 * Provider-neutral AI interface. Implementations run on the server only.
 * Add new providers by implementing AIProvider and registering them in ./registry.ts.
 */

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIRequest {
  system: string;
  messages: AIMessage[];
  model: string;
  /** Limit for the visible answer. The provider may add headroom for model thinking. */
  maxTokens: number;
  /** Task id, for logging and the automated-test provider. */
  task?: string;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export type AIStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; usage: AIUsage; model: string; stopReason: string | null }
  | { type: "error"; message: string; retryable: boolean; status?: number };

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  stream(req: AIRequest, signal?: AbortSignal): AsyncIterable<AIStreamEvent>;
}
