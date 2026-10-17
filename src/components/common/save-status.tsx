"use client";

import * as React from "react";
import { Check, CircleAlert, Cloud, Loader2 } from "lucide-react";
import { Tooltip } from "@/components/ui/overlays";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export function SaveStatus({ state, lastSavedAt, onRetry, className }: { state: SaveState; lastSavedAt: string | null; onRetry?: () => void; className?: string }) {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const t = setInterval(force, 30_000);
    return () => clearInterval(t);
  }, []);

  if (state === "error") {
    return (
      <button type="button" onClick={onRetry} className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-red-50", className)} data-testid="save-status">
        <CircleAlert className="size-3.5" /> Not saved — retry
      </button>
    );
  }
  const label = state === "saving" ? "Saving…" : state === "unsaved" ? "Unsaved changes" : lastSavedAt ? `Saved ${timeAgo(lastSavedAt)}` : "Saved";
  const icon = state === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : state === "unsaved" ? <Cloud className="size-3.5" /> : <Check className="size-3.5 text-success" />;
  return (
    <Tooltip content={lastSavedAt ? `Saved in this browser · ${formatDateTime(lastSavedAt)}` : "Saved in this browser"}>
      <span className={cn("hidden items-center gap-1.5 whitespace-nowrap px-1 text-xs text-muted-foreground sm:flex", className)} data-testid="save-status" data-state={state}>
        {icon}
        {label}
      </span>
    </Tooltip>
  );
}
