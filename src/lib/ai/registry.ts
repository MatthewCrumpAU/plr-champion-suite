import "server-only";
import { AnthropicProvider } from "./anthropic";
import { TestEchoProvider } from "./test-provider";
import type { AIProvider } from "./provider";
import { AI_MODELS, DEFAULT_MODEL_ID, findModel } from "./models";

const providers: Record<string, AIProvider> = {
  anthropic: new AnthropicProvider(),
};

/** Automated tests only. Never honoured on a Vercel production deployment, even if the variable is set by mistake. */
function testProviderEnabled(): boolean {
  return process.env.PLR_AI_TEST_PROVIDER === "echo" && process.env.VERCEL_ENV !== "production";
}

export function getProvider(): AIProvider {
  // Deterministic, clearly-labelled output so the AI plumbing can be verified without a key.
  if (testProviderEnabled()) return new TestEchoProvider();
  return providers.anthropic;
}

export function serverDefaultModel(): string {
  const env = process.env.PLR_AI_MODEL?.trim();
  return env || DEFAULT_MODEL_ID;
}

/** The browser may request a model from the catalogue (or the configured default); anything else is rejected. */
export function resolveModel(requested: string | null | undefined): string {
  const def = serverDefaultModel();
  if (!requested) return def;
  if (requested === def || findModel(requested)) return requested;
  return def;
}

export function maxOutputTokens(): number {
  const n = Number(process.env.PLR_AI_MAX_OUTPUT_TOKENS ?? 8000);
  return Number.isFinite(n) && n >= 256 ? Math.min(64_000, Math.floor(n)) : 8000;
}

export function aiStatus() {
  const p = getProvider();
  return {
    configured: p.isConfigured(),
    provider: p.id,
    providerLabel: p.label,
    defaultModel: serverDefaultModel(),
    models: AI_MODELS,
    maxOutputTokens: maxOutputTokens(),
    disabledByAdmin: process.env.PLR_AI_DISABLED === "true",
    testMode: testProviderEnabled(),
  };
}
