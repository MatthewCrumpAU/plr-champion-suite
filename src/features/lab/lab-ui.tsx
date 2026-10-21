"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, FileText, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";
import { useToolHref } from "@/components/common/tool-links";
import { downloadBlob } from "@/lib/export/download";
import { useMemberLive } from "@/lib/membership/hooks";
import { downloadStoredFile } from "@/lib/membership/member-actions";
import { progressId } from "@/lib/lab/store";
import type { ToolRef } from "@/lib/lab/path-templates";
import type { CampaignFile, LabProgress, LabProgressKind } from "@/lib/lab/types";
import { cn, errorMessage, formatBytes } from "@/lib/utils";
import { useMember } from "@/features/membership/member-context";

/**
 * The member whose plan, ticks and notes a Profit Lab page shows. In private testing that's the owner,
 * or the test profile being previewed with "View as" — so the owner can set up and check a member's
 * Profit Path exactly as they'd see it.
 */
export function useLabMember() {
  const m = useMember();
  const account = m.previewAccount ?? m.account;
  return { memberId: account.id, name: account.displayName, account, isOwner: account.role === "owner" };
}

/** Live progress row for one plan, campaign or Build Day (null until something is ticked). */
export function useLabProgress(kind: LabProgressKind, refId: string | null | undefined) {
  const { memberId } = useLabMember();
  return useMemberLive<LabProgress | null>(async (r) => (refId ? ((await r.labProgress.get(progressId(memberId, kind, refId))) ?? null) : null), [memberId, kind, refId ?? ""]);
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner /> {label}
    </div>
  );
}

export function downloadText(content: string, fileName: string, mime = "text/plain") {
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), fileName);
}

/** Resolves a task's tool: "member:x" pages in this membership, studio paths remapped into it where embedded. */
export function useToolLink() {
  const m = useMember();
  const remap = useToolHref();
  return React.useCallback((t: ToolRef) => (t.href.startsWith("member:") ? m.href(t.href.slice(7)) : remap(t.href)), [m, remap]);
}

export function ToolButton({ tool, size = "xs", variant = "outline" }: { tool: ToolRef; size?: "xs" | "sm"; variant?: "outline" | "ghost" | "soft" }) {
  const link = useToolLink();
  return (
    <Button asChild size={size} variant={variant}>
      <Link href={link(tool)}>
        <ExternalLink /> {tool.label}
      </Link>
    </Button>
  );
}

export function CopyButton({ text, label = "Copy", size = "xs", className, testId }: { text: string; label?: string; size?: "xs" | "sm"; className?: string; testId?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      size={size}
      variant="outline"
      className={className}
      data-testid={testId}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy — select the text and copy it instead.");
        }
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
    </Button>
  );
}

/** Circular progress (used for plan, campaign and Build Day completion). */
export function ProgressRing({ value, size = 64, stroke = 6, className, children }: { value: number; size?: number; stroke?: number; className?: string; children?: React.ReactNode }) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v)}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-secondary" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset]" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">{children ?? `${Math.round(v)}%`}</div>
    </div>
  );
}

/** A stored campaign or Build Day file the member can download (logged in My Downloads like other files). */
export function FileRow({ file, locked, label }: { file: Pick<CampaignFile, "fileId" | "name" | "size">; locked?: string | null; label: string }) {
  const m = useMember();
  const { memberId } = useLabMember();
  const [busy, setBusy] = React.useState(false);
  return (
    <li className="flex items-center gap-3 px-3 py-2" data-testid="lab-file">
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file.name}</span>
        <span className="block text-xs text-muted-foreground">{formatBytes(file.size)}</span>
      </span>
      {locked ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> {locked}
        </span>
      ) : (
        <Button
          size="xs"
          variant="outline"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await downloadStoredFile(m.brandId, file.fileId, file.name, memberId, "resource", label);
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Download
        </Button>
      )}
    </li>
  );
}

/** Small "x of y" chip used on cards and section headers. */
export function CountChip({ done, total, className }: { done: number; total: number; className?: string }) {
  const complete = total > 0 && done >= total;
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums", complete ? "bg-success-soft text-success" : "bg-secondary text-secondary-foreground", className)}>{`${done}/${total}`}</span>;
}
