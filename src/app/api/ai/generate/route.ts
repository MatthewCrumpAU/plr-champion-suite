import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AIGenerateBody, TaskSchemas, type AITaskId } from "@/lib/ai/tasks";
import { buildPrompt } from "@/lib/ai/prompts";
import { getProvider, maxOutputTokens, resolveModel } from "@/lib/ai/registry";
import type { AIStreamEvent } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BODY_BYTES = 600_000;

function errorResponse(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * POST { task, input, model? } → NDJSON stream of AIStreamEvent lines.
 * The request is validated against the task's schema and the prompt is built on the server.
 */
export async function POST(req: NextRequest) {
  const provider = getProvider();
  if (!provider.isConfigured()) {
    return errorResponse(503, "AI is not configured. Add ANTHROPIC_API_KEY to the server environment to enable AI features.");
  }

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return errorResponse(413, "Request is too large. Select less source text.");

  let body: z.infer<typeof AIGenerateBody>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return errorResponse(413, "Request is too large. Select less source text.");
    body = AIGenerateBody.parse(JSON.parse(raw));
  } catch (e) {
    return errorResponse(400, "Invalid request.", e instanceof z.ZodError ? e.issues : undefined);
  }

  const task = body.task as AITaskId;
  const schema = TaskSchemas[task];
  const parsed = schema.safeParse(body.input ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(400, first?.message ?? "Invalid input.", parsed.error.issues);
  }

  const model = resolveModel(body.model);
  const prompt = buildPrompt(task, parsed.data as never, maxOutputTokens());
  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: AIStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      try {
        for await (const ev of provider.stream(
          { system: prompt.system, messages: [{ role: "user", content: prompt.user }], model, maxTokens: prompt.maxTokens, task },
          abort.signal,
        )) {
          send(ev);
          if (ev.type === "error" || ev.type === "done") break;
        }
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "AI request failed.", retryable: true });
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      "X-PLR-Model": model,
    },
  });
}
