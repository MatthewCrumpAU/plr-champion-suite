"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, CircleAlert, RotateCcw, Sparkles, Square } from "lucide-react";
import { useAIStatus, type AIError, type AIResult } from "@/lib/ai/client";
import { formatUsd } from "@/lib/ai/models";
import type { Brief } from "@/lib/ai/tasks";
import { markdownToHtml, sanitizeHtml } from "@/lib/doc/parse";
import { useBrandKit, useProject } from "@/lib/data/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** Notice shown wherever AI is optional: explains manual mode when no key is configured. */
export function AIStatusNotice({ manualHint, className, compact }: { manualHint?: React.ReactNode; className?: string; compact?: boolean }) {
  const { status, loading } = useAIStatus();
  if (loading || status?.configured) return null;
  return (
    <Callout tone="neutral" icon={<Bot />} title={compact ? "AI is off" : "AI is off — manual mode"} className={className}>
      {manualHint ?? "Everything here works with templates and your own edits."} To enable AI, add <code className="font-mono text-[12px]">ANTHROPIC_API_KEY</code> to the server environment.{" "}
      <Link href="/settings#ai" className="font-medium underline">
        AI settings
      </Link>
    </Callout>
  );
}

export function AIBadge() {
  return (
    <Badge variant="ai">
      <Sparkles /> AI
    </Badge>
  );
}

/** Renders streamed Markdown output safely. */
export function MarkdownView({ markdown, className }: { markdown: string; className?: string }) {
  const html = React.useMemo(() => sanitizeHtml(markdownToHtml(markdown)), [markdown]);
  return <div className={cn("plr-prose", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function AIUsageLine({ result }: { result: AIResult | null }) {
  if (!result) return null;
  return (
    <p className="text-[11px] text-muted-foreground" data-testid="ai-usage">
      {result.model} · {result.usage.inputTokens.toLocaleString()} in / {result.usage.outputTokens.toLocaleString()} out tokens · est. {formatUsd(result.costUsd)}
      {result.stopReason === "max_tokens" && <span className="ml-1 text-amber-700">· output reached the length limit</span>}
    </p>
  );
}

export function AIRunStatus({ running, error, onCancel, onRetry, label = "Generating…" }: { running: boolean; error: AIError | null; onCancel?: () => void; onRetry?: () => void; label?: string }) {
  if (running) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
        <Spinner /> <span className="flex-1">{label}</span>
        {onCancel && (
          <Button size="xs" variant="ghost" onClick={onCancel}>
            <Square /> Stop
          </Button>
        )}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span className="flex-1">{error.message}</span>
        {onRetry && error.retryable && (
          <Button size="xs" variant="outline" onClick={onRetry}>
            <RotateCcw /> Retry
          </Button>
        )}
      </div>
    );
  }
  return null;
}

/** Builds the product brief sent with AI requests from the project, its brand kit and any overrides. */
export function useBrief(projectId: string | null | undefined, overrides: Partial<Brief> = {}): Brief {
  const { data: project } = useProject(projectId);
  const { data: kit } = useBrandKit(project?.brandKitId);
  return React.useMemo(
    () => ({
      productName: project?.name?.replace(/^SAMPLE\s*[—-]\s*/i, "") ?? "",
      niche: project?.niche ?? "",
      audience: project?.audience || kit?.audience || "",
      voice: kit?.voice ?? "",
      author: kit?.authorName ?? "",
      positioning: kit?.positioning ?? "",
      description: project?.description ?? "",
      price: project?.plannedPrice != null ? `$${project.plannedPrice}` : "",
      website: kit?.website ?? "",
      ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, kit, JSON.stringify(overrides)],
  );
}
