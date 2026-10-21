// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("server-only", () => ({}));

/**
 * Runs the real Anthropic provider and SDK against a local stand-in for the Messages API, so the
 * request body and the handling of Claude 5.x streams (thinking blocks before the text, stop reasons,
 * errors) are checked without an API key or network access.
 */

type Scenario = "thinking-then-text" | "max-tokens-empty" | "refusal" | "bad-request";
let scenario: Scenario = "thinking-then-text";
const bodies: Record<string, unknown>[] = [];
let server: http.Server;

const sse = (events: [string, unknown][]) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");

function streamFor(model: string, s: Scenario) {
  const start: [string, unknown] = ["message_start", { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 12, output_tokens: 1 } } }];
  const thinking: [string, unknown][] = [
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig" } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
  ];
  const text: [string, unknown][] = [
    ["content_block_start", { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Rewritten " } }],
    ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "paragraph." } }],
    ["content_block_stop", { type: "content_block_stop", index: 1 }],
  ];
  const end = (stop: string, out: number): [string, unknown][] => [
    ["message_delta", { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: out } }],
    ["message_stop", { type: "message_stop" }],
  ];
  if (s === "thinking-then-text") return sse([start, ...thinking, ...text, ...end("end_turn", 340)]);
  if (s === "max-tokens-empty") return sse([start, ...thinking, ...end("max_tokens", 2048)]);
  return sse([start, ...end("refusal", 3)]);
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      bodies.push(body);
      if (scenario === "bad-request") {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "temperature: not supported for this model" } }));
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(streamFor(body.model, scenario));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterAll(() => {
  server.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
});

async function run(model: string, maxTokens = 5000) {
  const { AnthropicProvider } = await import("@/lib/ai/anthropic");
  const events = [];
  for await (const ev of new AnthropicProvider().stream({ system: "S", messages: [{ role: "user", content: "Rewrite this." }], model, maxTokens, task: "editor.transform" })) events.push(ev);
  return events;
}

describe("Anthropic provider with Claude 5.x streams", () => {
  it("sends a valid 5.x request and returns only the text after a thinking block", async () => {
    scenario = "thinking-then-text";
    const events = await run("claude-opus-5-5");
    const body = bodies.at(-1)!;
    expect(body).not.toHaveProperty("temperature");
    expect(body).toMatchObject({ model: "claude-opus-5-5", max_tokens: 7500, output_config: { effort: "medium" }, stream: true });
    expect(body.thinking).toBeUndefined();
    expect(events.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text).join("")).toBe("Rewritten paragraph.");
    expect(events.at(-1)).toMatchObject({ type: "done", stopReason: "end_turn", usage: { inputTokens: 12, outputTokens: 340 } });

    await run("claude-sonnet-5-5");
    expect(bodies.at(-1)).toMatchObject({ thinking: { type: "between_tools" }, max_tokens: 6024 });
  });

  it("explains a reply that ran out of tokens before any text", async () => {
    scenario = "max-tokens-empty";
    const events = await run("claude-haiku-5-5");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error", retryable: true });
    expect((events[0] as { message: string }).message).toMatch(/length limit before writing anything/);
  });

  it("explains a declined request", async () => {
    scenario = "refusal";
    const events = await run("claude-sonnet-5-5");
    expect(events[0]).toMatchObject({ type: "error", retryable: false });
    expect((events[0] as { message: string }).message).toMatch(/declined/);
  });

  it("turns an API 400 into a readable error", async () => {
    scenario = "bad-request";
    const events = await run("claude-sonnet-5-5");
    expect(events[0]).toMatchObject({ type: "error", status: 400, retryable: false });
    expect((events[0] as { message: string }).message).toMatch(/Anthropic could not process the request/);
  });
});
