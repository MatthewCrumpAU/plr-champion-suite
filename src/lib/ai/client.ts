"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { getRepos } from "@/lib/data";
import { nowIso, uid } from "@/lib/utils";
import { loadSettings } from "@/lib/services/settings";
import { estimateCostUsd, type AIModelInfo } from "./models";
import type { AIStreamEvent, AIUsage } from "./provider";
import type { AITaskId, AITaskInput } from "./tasks";

export interface AIStatus {
  configured: boolean;
  provider: string;
  providerLabel: string;
  defaultModel: string;
  models: AIModelInfo[];
  maxOutputTokens: number;
  disabledByAdmin: boolean;
  testMode?: boolean;
}

let statusCache: AIStatus | null = null;
let statusPromise: Promise<AIStatus> | null = null;
const listeners = new Set<(s: AIStatus) => void>();

const OFFLINE: AIStatus = { configured: false, provider: "anthropic", providerLabel: "Anthropic (Claude)", defaultModel: "", models: [], maxOutputTokens: 0, disabledByAdmin: false };

export function fetchAIStatus(force = false): Promise<AIStatus> {
  if (statusCache && !force) return Promise.resolve(statusCache);
  if (statusPromise && !force) return statusPromise;
  statusPromise = apiFetch("/api/ai/status")
    .then((r) => (r.ok ? (r.json() as Promise<AIStatus>) : OFFLINE))
    .catch(() => OFFLINE)
    .then((s) => {
      statusCache = s;
      statusPromise = null;
      listeners.forEach((l) => l(s));
      return s;
    });
  return statusPromise;
}

export function useAIStatus() {
  const [status, setStatus] = useState<AIStatus | null>(statusCache);
  useEffect(() => {
    listeners.add(setStatus);
    fetchAIStatus().then(setStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);
  return { status, loading: status === null, configured: !!status?.configured, refresh: () => fetchAIStatus(true) };
}

export interface AIResult {
  text: string;
  model: string;
  usage: AIUsage;
  costUsd: number | null;
  stopReason: string | null;
}

export class AIError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = "AIError";
    this.retryable = retryable;
  }
}

/** Runs an AI task on the server and streams the text back. */
export async function runAITask<T extends AITaskId>(
  task: T,
  input: AITaskInput<T>,
  opts: { signal?: AbortSignal; onDelta?: (fullText: string, delta: string) => void; projectId?: string | null; model?: string | null } = {},
): Promise<AIResult> {
  const settings = await loadSettings().catch(() => null);
  const model = opts.model ?? settings?.aiModel ?? undefined;
  const res = await apiFetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, input, model }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new AIError((body as { error?: string }).error ?? `AI request failed (${res.status}).`, res.status >= 500 && res.status !== 503);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let done: Extract<AIStreamEvent, { type: "done" }> | null = null;
  let error: Extract<AIStreamEvent, { type: "error" }> | null = null;

  const handle = (line: string) => {
    if (!line.trim()) return;
    let ev: AIStreamEvent;
    try {
      ev = JSON.parse(line) as AIStreamEvent;
    } catch {
      return;
    }
    if (ev.type === "delta") {
      text += ev.text;
      opts.onDelta?.(text, ev.text);
    } else if (ev.type === "done") done = ev;
    else if (ev.type === "error") error = ev;
  };

  try {
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    }
    handle(buf);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new AIError("Cancelled.", true);
    throw new AIError("The connection to the AI service was interrupted. Retry to continue.", true);
  }

  const modelUsed = (done as { model?: string } | null)?.model ?? res.headers.get("X-PLR-Model") ?? model ?? "unknown";
  const usage: AIUsage = (done as { usage?: AIUsage } | null)?.usage ?? { inputTokens: 0, outputTokens: 0 };
  const costUsd = estimateCostUsd(modelUsed, usage.inputTokens, usage.outputTokens);

  try {
    await getRepos().aiUsage.add({ id: uid("ai"), task, model: modelUsed, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd, projectId: opts.projectId ?? null, ok: !error, createdAt: nowIso() });
  } catch {
    /* usage log is best-effort */
  }

  if (error) {
    const e = error as Extract<AIStreamEvent, { type: "error" }>;
    throw new AIError(e.message, e.retryable);
  }
  if (!done) throw new AIError("The AI response ended unexpectedly. Retry to try again.", true);
  return { text, model: modelUsed, usage, costUsd, stopReason: (done as { stopReason: string | null }).stopReason };
}

export type AIRunState = "idle" | "running" | "done" | "error";

/** React helper around runAITask with streaming text, cancel and retry. */
export function useAITask<T extends AITaskId>(task: T) {
  const [state, setState] = useState<AIRunState>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<AIError | null>(null);
  const [result, setResult] = useState<AIResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastInput = useRef<{ input: AITaskInput<T>; projectId?: string | null } | null>(null);

  const run = useCallback(
    async (input: AITaskInput<T>, projectId?: string | null): Promise<AIResult | null> => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      lastInput.current = { input, projectId };
      setState("running");
      setText("");
      setError(null);
      setResult(null);
      try {
        const r = await runAITask(task, input, { signal: ac.signal, projectId, onDelta: (full) => setText(full) });
        if (ac.signal.aborted) return null;
        setResult(r);
        setText(r.text);
        setState("done");
        return r;
      } catch (e) {
        const err = e instanceof AIError ? e : new AIError(e instanceof Error ? e.message : String(e), true);
        if (ac.signal.aborted) {
          setState("idle");
          return null;
        }
        setError(err);
        setState("error");
        return null;
      }
    },
    [task],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState("idle");
  }, []);

  const retry = useCallback(() => (lastInput.current ? run(lastInput.current.input, lastInput.current.projectId) : Promise.resolve(null)), [run]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState("idle");
    setText("");
    setError(null);
    setResult(null);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { state, running: state === "running", text, error, result, run, cancel, retry, reset };
}

/** Extracts and parses the first JSON value from a model response (tolerates code fences and stray text). */
export function parseJsonLoose<T = unknown>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(t) as T;
  } catch {
    /* fall through */
  }
  const start = t.search(/[[{]/);
  if (start >= 0) {
    const open = t[start];
    const close = open === "[" ? "]" : "}";
    const end = t.lastIndexOf(close);
    if (end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
  }
  throw new AIError("The AI response was not in the expected format. Retry to generate again.", true);
}
