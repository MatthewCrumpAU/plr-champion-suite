"use client";

import * as React from "react";
import type { Asset } from "@/lib/data/types";
import { useAssets } from "@/lib/data/hooks";
import { docToMarkdown } from "@/lib/doc/markdown";
import { docWords } from "@/lib/doc/text";
import type { Chapter } from "@/lib/models/document";
import { Checkbox, NativeSelect } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface SourceSelection {
  documentId: string | null;
  chapterIds: string[];
}

export function selectedChapters(docs: Asset<"document">[] | undefined, sel: SourceSelection): Chapter[] {
  const d = docs?.find((x) => x.id === sel.documentId);
  if (!d) return [];
  return d.data.chapters.filter((c) => sel.chapterIds.includes(c.id));
}

export function chaptersToMarkdown(chapters: Chapter[], maxChars = 60_000): string {
  let out = "";
  for (const c of chapters) {
    const block = `## ${c.title}\n\n${docToMarkdown(c.content)}\n\n`;
    if (out.length + block.length > maxChars) {
      out += block.slice(0, Math.max(0, maxChars - out.length));
      break;
    }
    out += block;
  }
  return out.trim();
}

/** Pick a project document and some of its chapters as source material. */
export function SourcePicker({
  projectId,
  value,
  onChange,
  maxHeight = 260,
  allowNone = false,
  label = "Source material",
  defaultAll = true,
}: {
  projectId: string;
  value: SourceSelection;
  onChange: (v: SourceSelection) => void;
  maxHeight?: number;
  allowNone?: boolean;
  label?: string;
  defaultAll?: boolean;
}) {
  const { data: docs } = useAssets(projectId, "document");
  const doc = docs?.find((d) => d.id === value.documentId) ?? null;

  // Default to the main/first document with all chapters selected.
  React.useEffect(() => {
    if (!docs?.length || value.documentId || allowNone) return;
    const main = docs.find((d) => d.data.role === "main") ?? docs[0];
    onChange({ documentId: main.id, chapterIds: defaultAll ? main.data.chapters.map((c) => c.id) : [] });
  }, [docs, value.documentId, allowNone, onChange, defaultAll]);

  const words = doc ? doc.data.chapters.filter((c) => value.chapterIds.includes(c.id)).reduce((n, c) => n + docWords(c.content), 0) : 0;
  const all = doc ? doc.data.chapters.every((c) => value.chapterIds.includes(c.id)) : false;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">{label}</span>
        {doc && (
          <button type="button" className="text-xs font-medium text-primary" onClick={() => onChange({ ...value, chapterIds: all ? [] : doc.data.chapters.map((c) => c.id) })}>
            {all ? "Select none" : "Select all"}
          </button>
        )}
      </div>
      <NativeSelect
        value={value.documentId ?? ""}
        onChange={(e) => {
          const d = docs?.find((x) => x.id === e.target.value);
          onChange({ documentId: d?.id ?? null, chapterIds: d && defaultAll ? d.data.chapters.map((c) => c.id) : [] });
        }}
        aria-label="Source document"
      >
        {allowNone && <option value="">No source document</option>}
        {!docs?.length && <option value="">No documents in this project yet</option>}
        {docs?.map((d) => (
          <option key={d.id} value={d.id}>
            {d.title} ({d.data.chapters.length})
          </option>
        ))}
      </NativeSelect>
      {doc && (
        <>
          <ul className="plr-scroll grid gap-0.5 overflow-y-auto rounded-lg border p-1" style={{ maxHeight }} data-testid="source-chapters">
            {doc.data.chapters.map((c, i) => {
              const checked = value.chapterIds.includes(c.id);
              return (
                <li key={c.id}>
                  <label className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px]", checked ? "bg-primary-soft/60" : "hover:bg-secondary")}>
                    <Checkbox checked={checked} onCheckedChange={(v) => onChange({ ...value, chapterIds: v ? [...value.chapterIds, c.id] : value.chapterIds.filter((x) => x !== c.id) })} />
                    <span className="w-5 text-right text-[11px] text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="text-[11px] text-muted-foreground">{docWords(c.content).toLocaleString()}w</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            {value.chapterIds.length} selected · {words.toLocaleString()} words
          </p>
        </>
      )}
    </div>
  );
}
