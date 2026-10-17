"use client";

import * as React from "react";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import { ArrowDownToLine, Check, ClipboardCopy, Plus, Replace, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { useAITask } from "@/lib/ai/client";
import type { Brief } from "@/lib/ai/tasks";
import { WRITER_TRANSFORM_TOOLS } from "@/lib/ai/tasks";
import { markdownToDoc } from "@/lib/doc/parse";
import { docToMarkdown } from "@/lib/doc/markdown";
import { docText, docWords } from "@/lib/doc/text";
import { analyseText } from "@/lib/doc/analysis";
import { applyRules, countMatches, FILLER_PHRASES } from "@/lib/doc/replace";
import { diffText } from "@/lib/doc/diff";
import type { Chapter, ReplacementRule } from "@/lib/models/document";
import { CHAPTER_LABELS, DOCUMENT_ROLE_LABELS, type DocumentRole } from "@/lib/models/document";
import { ASSET_STATUS_LABELS, type AssetStatus } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Badge, Checkbox, Field, Input, NativeSelect, Separator, Switch, Textarea } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm";
import { AIRunStatus, AIStatusNotice, AIUsageLine, MarkdownView } from "@/components/common/ai";
import { cn, plural, uid } from "@/lib/utils";
import type { DocMeta } from "./use-document";
import { findOriginalFor } from "./compare-view";

/* ------------------------------------------------------------------ */
/* AI panel                                                             */
/* ------------------------------------------------------------------ */
const TRANSFORM_LABELS: Record<(typeof WRITER_TRANSFORM_TOOLS)[number], string> = {
  clarity: "Improve clarity",
  expand: "Expand",
  shorten: "Shorten",
  tone: "Change tone",
  audience: "Rewrite for audience",
  examples: "Add examples",
  "action-steps": "Generate action steps",
};

export function AIPanel({ editor, projectId, brief, onBeforeReplace }: { editor: Editor | null; projectId: string; brief: Brief; onBeforeReplace: (label: string) => Promise<void> }) {
  const ai = useAITask("writer.transform");
  const [tool, setTool] = React.useState<(typeof WRITER_TRANSFORM_TOOLS)[number]>("clarity");
  const [tone, setTone] = React.useState("warm, confident and practical");
  const [audience, setAudience] = React.useState(brief.audience ?? "");
  const [extra, setExtra] = React.useState("");
  const [target, setTarget] = React.useState<{ from: number; to: number; whole: boolean } | null>(null);
  const confirm = useConfirm();

  React.useEffect(() => setAudience((a) => a || brief.audience || ""), [brief.audience]);

  const run = () => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const whole = empty;
    let text: string;
    if (whole) text = docToMarkdown(editor.getJSON() as never);
    else {
      const slice = editor.state.doc.cut(from, to);
      text = docToMarkdown(slice.toJSON() as never) || editor.state.doc.textBetween(from, to, "\n\n");
    }
    if (text.trim().length < 20) {
      toast.info("Select at least a sentence, or place the cursor without a selection to work on the whole chapter.");
      return;
    }
    setTarget({ from, to, whole });
    void ai.run({ tool, text, tone, audience, extra, brief }, projectId);
  };

  const apply = async (mode: "replace" | "insert") => {
    if (!editor || !target || !ai.text) return;
    const doc = markdownToDoc(ai.text);
    if (mode === "replace") {
      const ok = await confirm({
        title: target.whole ? "Replace the whole chapter with the AI version?" : "Replace the selected text?",
        description: "A version is saved first, so you can restore the current text from Version history.",
        confirmLabel: "Replace",
      });
      if (!ok) return;
      await onBeforeReplace(`Before AI: ${TRANSFORM_LABELS[tool]}`);
      if (target.whole) editor.chain().focus().setContent(doc, { emitUpdate: true }).run();
      else editor.chain().focus().insertContentAt({ from: target.from, to: target.to }, doc.content).run();
    } else {
      const pos = target.whole ? editor.state.doc.content.size : Math.min(target.to, editor.state.doc.content.size);
      const $pos = editor.state.doc.resolve(pos);
      const after = target.whole ? pos : $pos.after(1);
      editor.chain().focus().insertContentAt(after, doc.content).run();
    }
    toast.success(mode === "replace" ? "Replaced with AI version" : "Inserted below");
    ai.reset();
    setTarget(null);
  };

  return (
    <div className="grid gap-3 p-3">
      <AIStatusNotice compact manualHint="Use Find & replace, Tools and the formatting toolbar to edit manually." />
      <p className="text-xs text-muted-foreground">Select text to work on part of the chapter, or leave nothing selected to work on the whole chapter. You approve every change before it replaces your text.</p>
      <div className="grid grid-cols-2 gap-1.5">
        {WRITER_TRANSFORM_TOOLS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTool(t)}
            className={cn("rounded-lg border px-2.5 py-2 text-left text-[12.5px] font-medium transition", tool === t ? "border-primary bg-primary-soft text-accent-foreground" : "hover:bg-secondary")}
          >
            {TRANSFORM_LABELS[t]}
          </button>
        ))}
      </div>
      {tool === "tone" && (
        <Field label="Tone" htmlFor="ai-tone">
          <Input id="ai-tone" value={tone} onChange={(e) => setTone(e.target.value)} />
        </Field>
      )}
      {tool === "audience" && (
        <Field label="Audience" htmlFor="ai-aud">
          <Input id="ai-aud" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. busy new parents" />
        </Field>
      )}
      <Field label="Extra instructions" htmlFor="ai-extra" optional>
        <Textarea id="ai-extra" value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder="e.g. Keep Australian spelling" />
      </Field>
      <Button onClick={run} disabled={!editor || ai.running} variant="gradient" data-testid="ai-run">
        <Sparkles /> {TRANSFORM_LABELS[tool]}
      </Button>
      <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void ai.retry()} />
      {(ai.text || ai.state === "done") && (
        <div className="grid gap-2 rounded-xl border bg-[#fbfbfd] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">AI suggestion</span>
            {ai.state === "done" && (
              <Button size="icon-xs" variant="ghost" onClick={() => ai.reset()} aria-label="Discard suggestion">
                <X />
              </Button>
            )}
          </div>
          <div className="plr-scroll max-h-80 overflow-y-auto rounded-lg bg-card p-3">
            <MarkdownView markdown={ai.text} className="text-[13.5px]" />
          </div>
          <AIUsageLine result={ai.result} />
          {ai.state === "done" && (
            <div className="flex flex-wrap gap-1.5">
              <Button size="xs" onClick={() => apply("replace")} data-testid="ai-replace">
                <Replace /> Replace {target?.whole ? "chapter" : "selection"}
              </Button>
              <Button size="xs" variant="outline" onClick={() => apply("insert")}>
                <ArrowDownToLine /> Insert below
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(ai.text);
                  toast.success("Copied");
                }}
              >
                <ClipboardCopy /> Copy
              </Button>
            </div>
          )}
        </div>
      )}
      <Separator />
      <p className="text-xs text-muted-foreground">
        Need longer new content? Open the{" "}
        <Link href="/ai-writer" className="font-medium text-primary underline">
          AI Writer
        </Link>{" "}
        to write chapters, articles and more, then save them into this document.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tools panel: replacement rules + clean-up                            */
/* ------------------------------------------------------------------ */
export function ToolsPanel({ chapters, rules, onRulesChange, onApply, activeChapterId }: { chapters: Chapter[]; rules: ReplacementRule[]; onRulesChange: (r: ReplacementRule[]) => void; onApply: (next: Chapter[], count: number, scope: string) => Promise<void>; activeChapterId: string | null }) {
  const confirm = useConfirm();
  const counts = React.useMemo(
    () =>
      rules.map((r) => (r.find ? chapters.reduce((n, c) => n + countMatches(c.content, r.find, { caseSensitive: r.caseSensitive, wholeWord: r.wholeWord }) + countMatches({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: c.title }] }] }, r.find, { caseSensitive: r.caseSensitive, wholeWord: r.wholeWord }), 0) : 0)),
    [rules, chapters],
  );
  const fillers = React.useMemo(() => {
    return FILLER_PHRASES.map((p) => ({ phrase: p, count: chapters.reduce((n, c) => n + countMatches(c.content, p, {}), 0) })).filter((f) => f.count > 0 && !rules.some((r) => r.find.toLowerCase() === f.phrase.toLowerCase()));
  }, [chapters, rules]);

  const update = (id: string, patch: Partial<ReplacementRule>) => onRulesChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = (find = "", replace = "") => onRulesChange([...rules, { id: uid("rule"), find, replace, caseSensitive: false, wholeWord: false, enabled: true }]);

  const applyTo = async (scope: "all" | "current") => {
    const active = rules.filter((r) => r.enabled && r.find);
    if (!active.length) return toast.info("Add at least one enabled rule first.");
    let total = 0;
    const next = chapters.map((c) => {
      if (scope === "current" && c.id !== activeChapterId) return c;
      const res = applyRules(c.content, active);
      const titleRes = applyRules({ type: "doc", content: [{ type: "paragraph", content: c.title ? [{ type: "text", text: c.title }] : [] }] }, active);
      total += res.count + titleRes.count;
      return { ...c, content: res.doc, title: docText(titleRes.doc) || c.title };
    });
    if (!total) return toast.info("No matches found for the enabled rules.");
    const ok = await confirm({ title: `Apply ${plural(total, "replacement")}?`, description: `A version is saved first, so you can undo this from Version history.`, confirmLabel: "Apply replacements" });
    if (!ok) return;
    await onApply(next, total, scope === "all" ? "all chapters" : "this chapter");
  };

  return (
    <div className="grid gap-4 p-3">
      <div>
        <p className="text-sm font-semibold">Rebrand replacements</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Swap old names, authors, URLs and phrases across the whole document in one step. Matches keep their capitalisation.</p>
      </div>
      <div className="grid gap-2">
        {rules.map((r, i) => (
          <div key={r.id} className={cn("grid gap-1.5 rounded-lg border p-2", !r.enabled && "opacity-60")}>
            <div className="flex items-center gap-1.5">
              <Input value={r.find} onChange={(e) => update(r.id, { find: e.target.value })} placeholder="Find" className="h-8 text-[13px]" aria-label="Find text" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input value={r.replace} onChange={(e) => update(r.id, { replace: e.target.value })} placeholder="Replace (blank = remove)" className="h-8 text-[13px]" aria-label="Replace with" />
            </div>
            <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
              <label className="flex items-center gap-1.5">
                <Checkbox checked={r.caseSensitive} onCheckedChange={(v) => update(r.id, { caseSensitive: !!v })} /> Case
              </label>
              <label className="flex items-center gap-1.5">
                <Checkbox checked={r.wholeWord} onCheckedChange={(v) => update(r.id, { wholeWord: !!v })} /> Whole word
              </label>
              <label className="flex items-center gap-1.5">
                <Switch checked={r.enabled} onCheckedChange={(v) => update(r.id, { enabled: v })} className="scale-75" /> On
              </label>
              <Badge variant={counts[i] ? "default" : "secondary"} className="ml-auto">
                {counts[i]} found
              </Badge>
              <Button size="icon-xs" variant="ghost" className="size-6" onClick={() => onRulesChange(rules.filter((x) => x.id !== r.id))} aria-label="Delete rule">
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => add()} data-testid="add-rule">
          <Plus /> Add rule
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => applyTo("all")} data-testid="apply-rules">
          <Wand2 /> Apply to all chapters
        </Button>
        <Button size="sm" variant="ghost" onClick={() => applyTo("current")}>
          This chapter only
        </Button>
      </div>
      <Separator />
      <div>
        <p className="text-sm font-semibold">Dated filler phrases</p>
        {fillers.length ? (
          <ul className="mt-2 grid gap-1">
            {fillers.map((f) => (
              <li key={f.phrase} className="flex items-center gap-2 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate">“{f.phrase.trim()}”</span>
                <Badge variant="warning">{f.count}×</Badge>
                <Button size="xs" variant="ghost" onClick={() => add(f.phrase, "")}>
                  <Plus /> Rule
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 text-success" /> No common filler phrases found.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Details panel                                                        */
/* ------------------------------------------------------------------ */
export const DOC_FORMATS = ["ebook", "report", "guide", "workbook", "checklist", "course", "mini-course", "email-course", "challenge", "membership-module", "toolkit", "lead-magnet", "bonus", "article", "other"];

export function DetailsPanel({
  title,
  onTitle,
  status,
  onStatus,
  meta,
  onMeta,
  isMain,
  onMakeMain,
  authorSuggestion,
}: {
  title: string;
  onTitle: (t: string) => void;
  status: AssetStatus;
  onStatus: (s: AssetStatus) => void;
  meta: DocMeta;
  onMeta: (p: Partial<DocMeta>) => void;
  isMain: boolean;
  onMakeMain: () => void;
  authorSuggestion?: string;
}) {
  return (
    <div className="grid gap-3 p-3">
      <Field label="Document title" htmlFor="d-title">
        <Input id="d-title" value={title} onChange={(e) => onTitle(e.target.value)} data-testid="doc-title-input" />
      </Field>
      <Field label="Subtitle" htmlFor="d-sub" optional>
        <Input id="d-sub" value={meta.subtitle} onChange={(e) => onMeta({ subtitle: e.target.value })} />
      </Field>
      <Field label="Author / company" htmlFor="d-author" optional hint={authorSuggestion && !meta.author ? <button type="button" className="text-primary underline" onClick={() => onMeta({ author: authorSuggestion })}>Use brand kit author: {authorSuggestion}</button> : undefined}>
        <Input id="d-author" value={meta.author} onChange={(e) => onMeta({ author: e.target.value })} />
      </Field>
      <Field label="Description" htmlFor="d-desc" optional>
        <Textarea id="d-desc" value={meta.description} onChange={(e) => onMeta({ description: e.target.value })} rows={3} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Format" htmlFor="d-format">
          <NativeSelect id="d-format" value={meta.format} onChange={(e) => onMeta({ format: e.target.value })}>
            {DOC_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f.replace(/-/g, " ")}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Sections are called" htmlFor="d-label">
          <NativeSelect id="d-label" value={meta.chapterLabel} onChange={(e) => onMeta({ chapterLabel: e.target.value })}>
            {CHAPTER_LABELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Role in project" htmlFor="d-role">
          <NativeSelect id="d-role" value={meta.role} onChange={(e) => onMeta({ role: e.target.value as DocumentRole })}>
            {Object.entries(DOCUMENT_ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Status" htmlFor="d-status">
          <NativeSelect id="d-status" value={status} onChange={(e) => onStatus(e.target.value as AssetStatus)}>
            {Object.entries(ASSET_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Planned price" htmlFor="d-price" optional hint="Used by the Product Portfolio and Funnel Planner.">
        <Input id="d-price" type="number" min={0} step="0.01" value={meta.price ?? ""} onChange={(e) => onMeta({ price: e.target.value === "" ? null : Number(e.target.value) })} />
      </Field>
      <Separator />
      {isMain ? (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" /> This is the project&apos;s main document.
        </p>
      ) : (
        <Button size="sm" variant="outline" onClick={onMakeMain}>
          Set as project&apos;s main document
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Analysis panel                                                       */
/* ------------------------------------------------------------------ */
export function AnalysisPanel({ chapters, originals, activeId }: { chapters: Chapter[]; originals: Chapter[]; activeId: string | null }) {
  const active = chapters.find((c) => c.id === activeId);
  const all = React.useMemo(() => analyseText(chapters.map((c) => docText(c.content)).join("\n\n")), [chapters]);
  const current = React.useMemo(() => (active ? analyseText(docText(active.content)) : null), [active]);
  const changes = React.useMemo(
    () =>
      originals.length
        ? chapters.map((c, i) => {
            const o = findOriginalFor(c, i, originals);
            return { id: c.id, title: c.title, pct: o ? diffText(docText(o.content), docText(c.content)).changePercent : null };
          })
        : [],
    [chapters, originals],
  );
  const Stat = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => (
    <div className="rounded-lg border bg-card p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
      {hint && <p className="text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
  return (
    <div className="grid gap-4 p-3">
      {current && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">This chapter</p>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Words" value={current.words.toLocaleString()} hint={`${current.readingMinutes} min read`} />
            <Stat label="Readability" value={current.readingEase} hint={current.readingLevel} />
            <Stat label="Avg sentence" value={`${current.avgSentenceLength} words`} hint={`${current.longSentences} long (28+ words)`} />
            <Stat label="Passive voice hints" value={current.passiveHints} hint="Heuristic — check manually" />
          </div>
        </div>
      )}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Whole document</p>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Words" value={all.words.toLocaleString()} hint={`${all.readingMinutes} min read`} />
          <Stat label="Readability" value={all.readingEase} hint={all.readingLevel} />
          <Stat label="Approved" value={`${chapters.filter((c) => c.approved).length}/${chapters.length}`} />
          <Stat label="Filler phrases" value={all.fillers.reduce((n, f) => n + f.count, 0)} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Readability uses the Flesch Reading Ease formula (60+ is plain English).</p>
      </div>
      {changes.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Changed from original</p>
          <ul className="grid gap-1.5">
            {changes.map((c) => (
              <li key={c.id} className="grid gap-1">
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate">{c.title}</span>
                  <span className="tabular-nums text-muted-foreground">{c.pct == null ? "new" : `${c.pct}%`}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className={cn("h-full rounded-full", (c.pct ?? 100) >= 40 ? "bg-success" : (c.pct ?? 0) >= 15 ? "bg-primary" : "bg-amber-400")} style={{ width: `${c.pct ?? 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">Share of words that differ from the imported original. Some marketplaces expect substantial changes to PLR — check your licence.</p>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Total: {plural(docWords({ type: "doc", content: chapters.flatMap((c) => c.content.content) }), "word")}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Notes panel                                                          */
/* ------------------------------------------------------------------ */
export function NotesPanel({ docNotes, onDocNotes, chapter, onChapterNotes, label }: { docNotes: string; onDocNotes: (v: string) => void; chapter: Chapter | null; onChapterNotes: (v: string) => void; label: string }) {
  return (
    <div className="grid gap-3 p-3">
      <Field label="Document notes" htmlFor="n-doc" hint="Private notes. Not included in exports.">
        <Textarea id="n-doc" value={docNotes} onChange={(e) => onDocNotes(e.target.value)} rows={7} />
      </Field>
      {chapter && (
        <Field label={`Notes for “${chapter.title}”`} htmlFor="n-ch">
          <Textarea id="n-ch" value={chapter.notes} onChange={(e) => onChapterNotes(e.target.value)} rows={7} placeholder={`Ideas, sources or to-dos for this ${label.toLowerCase()}`} />
        </Field>
      )}
    </div>
  );
}
