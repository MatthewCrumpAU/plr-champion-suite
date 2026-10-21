// @vitest-environment node
import { describe, expect, it } from "vitest";
import { anthropicParams, effortFor, isClaude5x, thinkingHeadroom } from "@/lib/ai/request-params";
import { AI_MODELS } from "@/lib/ai/models";

const req = (model: string, maxTokens = 5000, task = "editor.transform") => ({ system: "S", messages: [{ role: "user" as const, content: "Hi" }], model, maxTokens, task });

describe("Anthropic request parameters", () => {
  it("never sends sampling parameters to any catalogue model", () => {
    for (const m of AI_MODELS) {
      const p = anthropicParams(req(m.id)) as unknown as Record<string, unknown>;
      expect(p).not.toHaveProperty("temperature");
      expect(p).not.toHaveProperty("top_p");
      expect(p).not.toHaveProperty("top_k");
    }
  });

  it("turns off up-front thinking on Sonnet 5.5 and keeps a small margin", () => {
    const p = anthropicParams(req("claude-sonnet-5-5"));
    expect(p.thinking).toEqual({ type: "between_tools" });
    expect(p.output_config).toEqual({ effort: "medium" });
    expect(p.max_tokens).toBe(5000 + 1024);
  });

  it("leaves thinking on (it can't be disabled) on Opus 5.5 and Haiku 5.5 but adds headroom", () => {
    for (const model of ["claude-opus-5-5", "claude-haiku-5-5"]) {
      const p = anthropicParams(req(model, 6000));
      expect(p.thinking).toBeUndefined();
      expect(p.output_config).toEqual({ effort: "medium" });
      expect(p.max_tokens).toBe(9000);
    }
    expect(thinkingHeadroom("claude-opus-5-5", 32)).toBe(2048);
    expect(thinkingHeadroom("claude-opus-5-5", 64_000)).toBe(16_000);
  });

  it("uses low effort for short answers and the connection test", () => {
    expect(effortFor({ maxTokens: 32, task: "test.ping" })).toBe("low");
    expect(effortFor({ maxTokens: 2000, task: "marketing.names" })).toBe("low");
    expect(effortFor({ maxTokens: 7000, task: "editor.transform" })).toBe("medium");
    const ping = anthropicParams(req("claude-sonnet-5-5", 32, "test.ping"));
    expect(ping.output_config).toEqual({ effort: "low" });
    expect(ping.max_tokens).toBeGreaterThanOrEqual(1024);
  });

  it("sends a plain request to older or unknown models", () => {
    expect(isClaude5x("claude-sonnet-4-6")).toBe(false);
    const p = anthropicParams(req("claude-sonnet-4-6"));
    expect(p).toEqual({ model: "claude-sonnet-4-6", max_tokens: 5000, system: "S", messages: [{ role: "user", content: "Hi" }] });
    expect(isClaude5x("claude-opus-5-5-20260901")).toBe(true);
    expect(isClaude5x("claude-sonnet-5")).toBe(true);
  });

  it("never ends on an assistant message (prefill is rejected)", () => {
    const p = anthropicParams({ ...req("claude-opus-5-5"), messages: [{ role: "user", content: "Write" }, { role: "assistant", content: "Sure:" }] });
    expect(p.messages.at(-1)!.role).toBe("user");
  });
});
