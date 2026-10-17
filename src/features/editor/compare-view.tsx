"use client";

import * as React from "react";
import { Columns2, FileDiff, Undo2 } from "lucide-react";
import type { Chapter } from "@/lib/models/document";
import { docText } from "@/lib/doc/text";
import { docToHtml } from "@/lib/doc/html";
import { diffText, diffToInlineHtml, diffToSideBySide } from "@/lib/doc/diff";
import { Button } from "@/components/ui/button";
import { Badge, Callout, NativeSelect } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function findOriginalFor(chapter: Chapter, index: number, originals: Chapter[]): Chapter | null {
  if (!originals.length) return null;
  return originals.find((o) => o.id === chapter.sourceChapterId) ?? originals[index] ?? null;
}

export function CompareView({ chapter, index, originals, onRestoreOriginal }: { chapter: Chapter; index: number; originals: Chapter[]; onRestoreOriginal: (original: Chapter) => void }) {
  const auto = findOriginalFor(chapter, index, originals);
  const [originalId, setOriginalId] = React.useState<string | null>(auto?.id ?? null);
  const [mode, setMode] = React.useState<"side" | "inline" | "formatted">("side");
  React.useEffect(() => setOriginalId(findOriginalFor(chapter, index, originals)?.id ?? null), [chapter, index, originals]);
  const original = originals.find((o) => o.id === originalId) ?? null;

  const diff = React.useMemo(() => {
    if (!original) return null;
    return diffText(`${original.title}\n\n${docText(original.content)}`, `${chapter.title}\n\n${docText(chapter.content)}`);
  }, [original, chapter]);

  if (!originals.length) {
    return (
      <div className="p-8">
        <Callout tone="neutral" title="No original to compare against">
          This document wasn&apos;t created from an import, so there is no preserved original. Import a PLR file to enable the Original vs Edited view.
        </Callout>
      </div>
    );
  }

  const side = diff ? diffToSideBySide(diff.parts) : null;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="compare-view">
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">Compare with original:</span>
        <NativeSelect value={originalId ?? ""} onChange={(e) => setOriginalId(e.target.value || null)} className="h-8 w-auto max-w-[280px] text-xs" aria-label="Original section">
          <option value="">— choose —</option>
          {originals.map((o, i) => (
            <option key={o.id} value={o.id}>
              {i + 1}. {o.title}
            </option>
          ))}
        </NativeSelect>
        {diff && (
          <div className="flex items-center gap-1.5 text-xs">
            <Badge variant={diff.changePercent > 40 ? "success" : diff.changePercent > 10 ? "default" : "warning"}>{diff.changePercent}% changed</Badge>
            <span className="text-muted-foreground">
              +{diff.addedWords} / −{diff.removedWords} words
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-secondary p-0.5">
          {(
            [
              ["side", "Side by side", Columns2],
              ["inline", "Inline changes", FileDiff],
              ["formatted", "Formatted", Columns2],
            ] as const
          ).map(([m, l, Icon]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium", mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}>
              <Icon className="size-3.5" /> {l}
            </button>
          ))}
        </div>
        {original && (
          <Button size="xs" variant="outline" onClick={() => onRestoreOriginal(original)}>
            <Undo2 /> Use original text
          </Button>
        )}
      </div>
      {!original ? (
        <p className="p-8 text-sm text-muted-foreground">Choose which original section to compare with.</p>
      ) : mode === "inline" ? (
        <div className="plr-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[820px] p-6">
            <div className="rounded-2xl border bg-card p-8">
              <p className="mb-4 text-xs text-muted-foreground">
                <span className="plr-diff-removed px-1">Removed</span> and <span className="plr-diff-added px-1">added</span> words, from the original to your edited version.
              </p>
              <div className="plr-prose whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: diffToInlineHtml(diff!.parts) }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="plr-scroll grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Original (preserved, read-only)</p>
            {mode === "formatted" ? (
              <div className="plr-prose">
                <h2>{original.title}</h2>
                <div dangerouslySetInnerHTML={{ __html: docToHtml(original.content) }} />
              </div>
            ) : (
              <div className="plr-prose whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: side!.left }} />
            )}
          </div>
          <div className="rounded-2xl border border-primary/30 bg-card p-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-primary">Your edited version</p>
            {mode === "formatted" ? (
              <div className="plr-prose">
                <h2>{chapter.title}</h2>
                <div dangerouslySetInnerHTML={{ __html: docToHtml(chapter.content) }} />
              </div>
            ) : (
              <div className="plr-prose whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: side!.right }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
