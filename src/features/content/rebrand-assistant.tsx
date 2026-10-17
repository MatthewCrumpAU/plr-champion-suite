"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CheckCheck, ChevronLeft, ChevronRight, FileText, Pencil, Plus, RefreshCw, Sparkles, Square, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { RebrandProposal, RebrandSessionData } from "@/lib/models/content";
import type { Chapter } from "@/lib/models/document";
import { useAssets, useBrandKits } from "@/lib/data/hooks";
import { createAsset, getAsset } from "@/lib/services/assets";
import { fillerRules, proposalFromAI, proposeWithRules, rebrandBrief, saveRebrand, suggestRules } from "@/lib/services/rebrand";
import { runAITask, useAIStatus, AIError } from "@/lib/ai/client";
import { countMatches } from "@/lib/doc/replace";
import { docText, docWords } from "@/lib/doc/text";
import { docToMarkdown } from "@/lib/doc/markdown";
import { diffText, diffToSideBySide } from "@/lib/doc/diff";
import { deepClone, errorMessage, nowIso, plural, uid, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, CardContent, CardHeader, CardTitle, Checkbox, Field, Input, NativeSelect, Progress, Switch, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { AIStatusNotice } from "@/components/common/ai";
import { RichEditor } from "@/components/common/rich-editor";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import type { AssetEditor } from "@/features/common/use-asset-editor";

const STEPS = ["Source", "New brand", "Replacements", "Review proposals", "Save"];

function Stepper({ step, onStep, maxStep }: { step: number; onStep: (n: number) => void; maxStep: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Rebrand steps">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={i > maxStep}
            onClick={() => onStep(i)}
            className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40", i === step ? "border-primary bg-primary text-white" : i < step ? "border-primary/30 bg-primary-soft text-accent-foreground" : "bg-card")}
          >
            <span className={cn("flex size-4 items-center justify-center rounded-full text-[10px]", i === step ? "bg-white/25" : "bg-black/5")}>{i < step ? <Check className="size-3" /> : i + 1}</span>
            {s}
          </button>
          {i < STEPS.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground" />}
        </li>
      ))}
    </ol>
  );
}

function ProposalCompare({ chapter, proposal }: { chapter: Chapter; proposal: RebrandProposal }) {
  const { left, right, pct } = React.useMemo(() => {
    const d = diffText(`${chapter.title}\n\n${docText(chapter.content)}`, `${proposal.proposedTitle}\n\n${docText(proposal.proposedContent)}`);
    return { ...diffToSideBySide(d.parts), pct: d.changePercent };
  }, [chapter, proposal]);
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        About {pct}% different · {plural(proposal.replacements, "rule replacement")} · method: {proposal.method === "ai" ? "AI rewrite + rules" : proposal.method === "manual" ? "edited by you" : "replacement rules"}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current</p>
          <div className="plr-prose whitespace-pre-wrap text-[14px]" dangerouslySetInnerHTML={{ __html: left }} />
        </div>
        <div className="rounded-xl border border-primary/30 bg-card p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">Proposed</p>
          <div className="plr-prose whitespace-pre-wrap text-[14px]" dangerouslySetInnerHTML={{ __html: right }} />
        </div>
      </div>
    </div>
  );
}

function RebrandEditor({ editor, project }: { editor: AssetEditor<"rebrand-session">; project: Project }) {
  const data = editor.data!;
  const { data: docs } = useAssets(project.id, "document");
  const { data: kits } = useBrandKits();
  const { configured } = useAIStatus();
  const source = docs?.find((d) => d.id === data.sourceDocumentId) ?? null;
  const [selected, setSelected] = React.useState<string | null>(null);
  const [aiRun, setAiRun] = React.useState<{ done: number; total: number } | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const [editing, setEditing] = React.useState<RebrandProposal | null>(null);
  const editedDoc = React.useRef<RebrandProposal["proposedContent"] | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [saveOpts, setSaveOpts] = React.useState({ target: "asset" as "asset" | "version", applyProjectName: false, linkBrandKit: true });
  const [saving, setSaving] = React.useState(false);

  const set = (p: Partial<RebrandSessionData>) => editor.patch(p);
  const setCfg = (p: Partial<RebrandSessionData["config"]>) => editor.update((d) => ({ ...d, config: { ...d.config, ...p } }));
  const step = data.step;
  const goto = (n: number) => set({ step: Math.max(0, Math.min(4, n)) });

  // Default the source to the main document.
  React.useEffect(() => {
    if (!data.sourceDocumentId && docs?.length) {
      const main = docs.find((d) => d.id === project.mainDocumentId) ?? docs[0];
      editor.update((d) => ({ ...d, sourceDocumentId: main.id, config: { ...d.config, originalName: d.config.originalName || main.title, originalAuthor: d.config.originalAuthor || main.data.author, niche: d.config.niche || project.niche, audience: d.config.audience || project.audience } }));
    }
  }, [docs, data.sourceDocumentId, project, editor]);

  const chapters = React.useMemo(() => source?.data.chapters ?? [], [source]);
  const proposalFor = (id: string) => data.proposals.find((p) => p.chapterId === id) ?? null;
  const upsert = (p: RebrandProposal) => editor.update((d) => ({ ...d, proposals: [...d.proposals.filter((x) => x.chapterId !== p.chapterId), p] }));
  const setStatus = (chapterId: string, status: RebrandProposal["status"]) => editor.update((d) => ({ ...d, proposals: d.proposals.map((p) => (p.chapterId === chapterId ? { ...p, status } : p)) }));

  const applyKit = (kitId: string) => {
    const k = kits?.find((x) => x.id === kitId);
    if (!k) return setCfg({ brandKitId: null });
    setCfg({
      brandKitId: k.id,
      author: k.authorName || data.config.author,
      voice: k.voice || data.config.voice,
      positioning: k.positioning || data.config.positioning,
      audience: k.audience || data.config.audience,
      colors: { primary: k.colors.primary, secondary: k.colors.secondary, accent: k.colors.accent },
    });
    toast.success(`Applied “${k.name}”`);
  };

  const isAccepted = (id: string) => editor.getData()?.proposals.some((p) => p.chapterId === id && p.status === "accepted");
  const generateRules = (ids?: string[]) => {
    // "All" skips chapters you've already accepted; regenerate a single chapter explicitly to replace it.
    const list = chapters.filter((c) => (ids ? ids.includes(c.id) : !isAccepted(c.id)));
    if (!list.length) return toast.info("Every chapter is already accepted. Select a chapter and use Rules or Regenerate to redo it.");
    editor.update((d) => {
      const others = d.proposals.filter((p) => !list.some((c) => c.id === p.chapterId));
      return { ...d, proposals: [...others, ...list.map((c) => proposeWithRules(c, d.rules))], step: Math.max(d.step, 3) };
    });
    toast.success(`Created ${plural(list.length, "proposal")} using your replacement rules`);
  };

  const generateAI = async (ids?: string[]) => {
    const list = chapters.filter((c) => (ids ? ids.includes(c.id) : !isAccepted(c.id)));
    if (!list.length) return toast.info("Every chapter is already accepted. Select a chapter and use Regenerate to redo it.");
    const ac = new AbortController();
    abortRef.current = ac;
    setAiRun({ done: 0, total: list.length });
    const brief = rebrandBrief(data.config);
    let failures = 0;
    for (const [i, c] of list.entries()) {
      if (ac.signal.aborted) break;
      try {
        const r = await runAITask("rebrand.rewrite", { chapterTitle: c.title, text: docToMarkdown(c.content), level: data.aiLevel, brief }, { signal: ac.signal, projectId: project.id });
        upsert(proposalFromAI(c, r.text, editor.getData()?.rules ?? data.rules));
      } catch (e) {
        if (ac.signal.aborted) break;
        failures++;
        const fallback = proposeWithRules(c, data.rules);
        upsert({ ...fallback, error: e instanceof AIError ? e.message : errorMessage(e) });
      }
      setAiRun({ done: i + 1, total: list.length });
    }
    setAiRun(null);
    abortRef.current = null;
    set({ step: Math.max(editor.getData()?.step ?? 3, 3) });
    if (failures) toast.error(`${failures} chapter(s) could not be rewritten by AI; rule-based proposals were used instead. Use Regenerate to retry.`);
    else if (!ac.signal.aborted) toast.success("AI proposals ready to review");
  };

  const counts = React.useMemo(() => {
    const p = data.proposals.filter((x) => chapters.some((c) => c.id === x.chapterId));
    return { accepted: p.filter((x) => x.status === "accepted").length, rejected: p.filter((x) => x.status === "rejected").length, pending: chapters.length - p.filter((x) => x.status !== "pending").length, generated: p.length };
  }, [data.proposals, chapters]);

  const selectedChapter = chapters.find((c) => c.id === selected) ?? chapters.find((c) => proposalFor(c.id)) ?? null;
  const selectedProposal = selectedChapter ? proposalFor(selectedChapter.id) : null;

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Stepper step={step} onStep={goto} maxStep={source ? 4 : 0} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Choose the product to rebrand</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!docs?.length ? (
              <Callout tone="warning" title="No documents yet">
                Import your PLR product in the{" "}
                <Link href="/editor" className="font-medium underline">
                  PLR Editor
                </Link>{" "}
                first.
              </Callout>
            ) : (
              <Field label="Source document" htmlFor="rb-src">
                <NativeSelect
                  id="rb-src"
                  value={data.sourceDocumentId ?? ""}
                  onChange={(e) => {
                    const d = docs.find((x) => x.id === e.target.value);
                    editor.update((s) => ({ ...s, sourceDocumentId: d?.id ?? null, proposals: [], config: { ...s.config, originalName: d?.title ?? s.config.originalName, originalAuthor: d?.data.author ?? s.config.originalAuthor } }));
                  }}
                >
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {source && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">
                  <FileText /> {source.data.chapters.length} chapters
                </Badge>
                <Badge variant="secondary">{source.data.chapters.reduce((n, c) => n + docWords(c.content), 0).toLocaleString()} words</Badge>
                {source.data.original && <Badge variant="outline">Original preserved</Badge>}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => goto(1)} disabled={!source}>
                Next: new brand <ChevronRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Describe the new brand</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Start from a brand kit" htmlFor="rb-kit" optional hint="Fills author, voice, positioning, audience and colours.">
              <NativeSelect id="rb-kit" value={data.config.brandKitId ?? ""} onChange={(e) => applyKit(e.target.value)}>
                <option value="">No brand kit</option>
                {kits?.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Original product name" htmlFor="rb-on" hint="Text to replace throughout the content.">
                <Input id="rb-on" value={data.config.originalName} onChange={(e) => setCfg({ originalName: e.target.value })} />
              </Field>
              <Field label="New product name" htmlFor="rb-nn">
                <Input id="rb-nn" value={data.config.newName} onChange={(e) => setCfg({ newName: e.target.value })} data-testid="rb-new-name" />
              </Field>
              <Field label="Original author / brand" htmlFor="rb-oa" optional>
                <Input id="rb-oa" value={data.config.originalAuthor} onChange={(e) => setCfg({ originalAuthor: e.target.value })} />
              </Field>
              <Field label="New author or company" htmlFor="rb-au" optional>
                <Input id="rb-au" value={data.config.author} onChange={(e) => setCfg({ author: e.target.value })} />
              </Field>
              <Field label="Subtitle" htmlFor="rb-sub" optional>
                <Input id="rb-sub" value={data.config.subtitle} onChange={(e) => setCfg({ subtitle: e.target.value })} />
              </Field>
              <Field label="New target niche" htmlFor="rb-ni">
                <Input id="rb-ni" value={data.config.niche} onChange={(e) => setCfg({ niche: e.target.value })} />
              </Field>
              <Field label="New audience" htmlFor="rb-aud">
                <Input id="rb-aud" value={data.config.audience} onChange={(e) => setCfg({ audience: e.target.value })} />
              </Field>
              <Field label="Main promise" htmlFor="rb-pr">
                <Input id="rb-pr" value={data.config.promise} onChange={(e) => setCfg({ promise: e.target.value })} placeholder="The result readers work towards" />
              </Field>
            </div>
            <Field label="Brand voice" htmlFor="rb-voice">
              <Input id="rb-voice" value={data.config.voice} onChange={(e) => setCfg({ voice: e.target.value })} placeholder="e.g. Calm, practical, encouraging. No hype." />
            </Field>
            <Field label="Product positioning" htmlFor="rb-pos" optional>
              <Textarea id="rb-pos" value={data.config.positioning} onChange={(e) => setCfg({ positioning: e.target.value })} rows={2} placeholder="How it's different from other products on this topic" />
            </Field>
            <div>
              <p className="mb-2 text-[13px] font-medium">Product colours</p>
              <div className="flex flex-wrap gap-4">
                {(["primary", "secondary", "accent"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm capitalize">
                    <input type="color" value={data.config.colors[k]} onChange={(e) => setCfg({ colors: { ...data.config.colors, [k]: e.target.value } })} className="size-9 cursor-pointer rounded-md border" />
                    {k} <span className="font-mono text-xs text-muted-foreground">{data.config.colors[k]}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Used by Cover Creator, Mockups and Sales Pages when you choose this rebrand&apos;s colours.</p>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => goto(0)}>
                <ChevronLeft /> Back
              </Button>
              <Button
                onClick={() => {
                  editor.update((d) => ({ ...d, rules: suggestRules(d.config, d.rules), step: 2 }));
                }}
                disabled={!data.config.newName.trim()}
              >
                Next: replacements <ChevronRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && source && (
        <Card>
          <CardHeader>
            <CardTitle>3. Replacement rules</CardTitle>
            <p className="text-sm text-muted-foreground">Rules swap names, authors and phrases everywhere. They run on every proposal, including AI rewrites.</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.rules.map((r) => {
              const n = source.data.chapters.reduce((t, c) => t + countMatches(c.content, r.find, { caseSensitive: r.caseSensitive, wholeWord: r.wholeWord }), 0);
              const upd = (p: Partial<typeof r>) => editor.update((d) => ({ ...d, rules: d.rules.map((x) => (x.id === r.id ? { ...x, ...p } : x)) }));
              return (
                <div key={r.id} className={cn("grid items-center gap-2 rounded-lg border p-2 md:grid-cols-[1fr_auto_1fr_auto]", !r.enabled && "opacity-60")}>
                  <Input value={r.find} onChange={(e) => upd({ find: e.target.value })} placeholder="Find" className="h-8" aria-label="Find" />
                  <span className="hidden text-muted-foreground md:block">→</span>
                  <Input value={r.replace} onChange={(e) => upd({ replace: e.target.value })} placeholder="Replace with (blank removes)" className="h-8" aria-label="Replace" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1">
                      <Checkbox checked={r.wholeWord} onCheckedChange={(v) => upd({ wholeWord: !!v })} /> Whole word
                    </label>
                    <Switch checked={r.enabled} onCheckedChange={(v) => upd({ enabled: v })} aria-label="Enabled" />
                    <Badge variant={n ? "default" : "secondary"}>{n} found</Badge>
                    <Button size="icon-xs" variant="ghost" onClick={() => editor.update((d) => ({ ...d, rules: d.rules.filter((x) => x.id !== r.id) }))} aria-label="Delete rule">
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => editor.update((d) => ({ ...d, rules: [...d.rules, { id: uid("rule"), find: "", replace: "", caseSensitive: false, wholeWord: false, enabled: true }] }))}>
                <Plus /> Add rule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => editor.update((d) => ({ ...d, rules: fillerRules(d.rules) }))}>
                <Wand2 /> Add dated-filler removal rules
              </Button>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => goto(1)}>
                <ChevronLeft /> Back
              </Button>
              <Button onClick={() => goto(3)}>
                Next: proposals <ChevronRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && source && (
        <div className="grid gap-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 pt-5">
              <Button onClick={() => generateRules()} variant="outline" data-testid="rb-generate-rules">
                <Wand2 /> Propose with rules
              </Button>
              <div className="flex items-center gap-2">
                <NativeSelect value={data.aiLevel} onChange={(e) => set({ aiLevel: e.target.value as RebrandSessionData["aiLevel"] })} className="h-9 w-auto" aria-label="AI rewrite depth">
                  <option value="light">Light AI rewrite</option>
                  <option value="moderate">Moderate AI rewrite</option>
                  <option value="full">Full AI rewrite</option>
                </NativeSelect>
                <Button variant="gradient" onClick={() => void generateAI()} disabled={!configured || !!aiRun} data-testid="rb-generate-ai">
                  <Sparkles /> Rewrite with AI
                </Button>
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <Badge variant="success">{counts.accepted} accepted</Badge>
                <Badge variant="destructive">{counts.rejected} rejected</Badge>
                <Badge variant="secondary">{counts.pending} to review</Badge>
              </div>
              {aiRun && (
                <div className="flex w-full items-center gap-3">
                  <Progress value={(aiRun.done / aiRun.total) * 100} className="flex-1" />
                  <span className="text-xs text-muted-foreground">
                    {aiRun.done}/{aiRun.total} chapters
                  </span>
                  <Button size="xs" variant="ghost" onClick={() => abortRef.current?.abort()}>
                    <Square /> Stop
                  </Button>
                </div>
              )}
              <AIStatusNotice compact manualHint="Rule-based proposals and manual edits work without AI." className="w-full" />
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <Card className="h-fit min-w-0 overflow-hidden p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chapters</span>
                <div className="flex gap-1">
                  <Button size="xs" variant="ghost" disabled={!counts.generated} onClick={() => editor.update((d) => ({ ...d, proposals: d.proposals.map((p) => ({ ...p, status: "accepted" })) }))} data-testid="rb-accept-all">
                    <CheckCheck /> Accept all
                  </Button>
                </div>
              </div>
              <ul className="grid min-w-0 grid-cols-1 gap-0.5" data-testid="rb-proposals">
                {chapters.map((c, i) => {
                  const p = proposalFor(c.id);
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => setSelected(c.id)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px]", selectedChapter?.id === c.id ? "bg-primary-soft" : "hover:bg-secondary")}>
                        <span className="w-4 text-right text-[11px] text-muted-foreground">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{p?.proposedTitle ?? c.title}</span>
                        {!p ? <Badge variant="outline">none</Badge> : p.status === "accepted" ? <Badge variant="success">✓</Badge> : p.status === "rejected" ? <Badge variant="destructive">✕</Badge> : <Badge variant="warning">review</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <div className="grid content-start gap-3">
              {selectedChapter && selectedProposal ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="mr-auto text-sm font-semibold">{selectedChapter.title}</h3>
                    <Button size="sm" variant={selectedProposal.status === "accepted" ? "default" : "outline"} onClick={() => setStatus(selectedChapter.id, "accepted")} data-testid="rb-accept">
                      <Check /> Accept
                    </Button>
                    <Button size="sm" variant={selectedProposal.status === "rejected" ? "destructive" : "outline"} onClick={() => setStatus(selectedChapter.id, "rejected")}>
                      <X /> Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => generateRules([selectedChapter.id])}>
                      <RefreshCw /> Rules
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!configured || !!aiRun} onClick={() => void generateAI([selectedChapter.id])}>
                      <Sparkles /> Regenerate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        editedDoc.current = selectedProposal.proposedContent;
                        setEditTitle(selectedProposal.proposedTitle);
                        setEditing(selectedProposal);
                      }}
                    >
                      <Pencil /> Edit
                    </Button>
                  </div>
                  {selectedProposal.error && (
                    <Callout tone="warning" title="AI rewrite failed for this chapter">
                      {selectedProposal.error} A rule-based proposal is shown instead.
                    </Callout>
                  )}
                  <ProposalCompare chapter={selectedChapter} proposal={selectedProposal} />
                </>
              ) : (
                <Card className="flex min-h-64 items-center justify-center p-8 text-center text-sm text-muted-foreground">Generate proposals, then select a chapter to compare and accept or reject it.</Card>
              )}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => goto(2)}>
                  <ChevronLeft /> Back
                </Button>
                <Button onClick={() => goto(4)} disabled={!counts.accepted}>
                  Next: save <ChevronRight />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 4 && source && (
        <Card>
          <CardHeader>
            <CardTitle>5. Save the rebranded product</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="success">{counts.accepted} accepted</Badge>
              <Badge variant="destructive">{counts.rejected} rejected</Badge>
              {counts.pending > 0 && <Badge variant="warning">{counts.pending} not reviewed (kept unchanged)</Badge>}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {(
                [
                  ["asset", "Save as a separate rebranded document", "Keeps the current document untouched and adds a new “Rebranded version” document to the project."],
                  ["version", "Update the current document", "Saves the current text as a version first, then applies the accepted changes to it."],
                ] as const
              ).map(([v, t, d]) => (
                <button key={v} type="button" onClick={() => setSaveOpts((o) => ({ ...o, target: v }))} className={cn("rounded-xl border p-4 text-left transition", saveOpts.target === v ? "border-primary bg-primary-soft" : "hover:bg-secondary")}>
                  <p className="text-sm font-semibold">{t}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{d}</p>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={saveOpts.applyProjectName} onCheckedChange={(v) => setSaveOpts((o) => ({ ...o, applyProjectName: !!v }))} /> Rename the project to “{data.config.newName || "new name"}”
            </label>
            {data.config.brandKitId && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={saveOpts.linkBrandKit} onCheckedChange={(v) => setSaveOpts((o) => ({ ...o, linkBrandKit: !!v }))} /> Link the selected brand kit to this project
              </label>
            )}
            {data.resultDocumentId && (
              <Callout tone="success" title="Saved">
                Last saved {data.savedAt ? new Date(data.savedAt).toLocaleString() : ""}.{" "}
                <Link href={`/editor?id=${data.resultDocumentId}`} className="font-medium underline">
                  Open the rebranded document
                </Link>
              </Callout>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => goto(3)}>
                <ChevronLeft /> Back
              </Button>
              <Button
                loading={saving}
                data-testid="rb-save"
                onClick={async () => {
                  setSaving(true);
                  try {
                    await editor.save();
                    // Use the stored session (not possibly-stale component state) so accepted proposals are included.
                    const fresh = await getAsset<"rebrand-session">(editor.asset!.id);
                    if (!fresh) throw new Error("This rebrand session no longer exists.");
                    const r = await saveRebrand(fresh, saveOpts);
                    editor.reload();
                    toast.success(`Saved ${plural(r.accepted, "rebranded chapter")}`, { action: { label: "Open", onClick: () => window.location.assign(`/editor?id=${r.documentId}`) } });
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <Check /> Save rebrand
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit proposal</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label="Proposed title" />
              <RichEditor content={editing.proposedContent} resetKey={editing.chapterId + editing.generatedAt} onChange={(d) => (editedDoc.current = d)} className="max-h-[60vh]" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editing) upsert({ ...editing, proposedTitle: editTitle.trim() || editing.proposedTitle, proposedContent: deepClone(editedDoc.current ?? editing.proposedContent), method: "manual", status: "accepted", generatedAt: nowIso() });
                setEditing(null);
              }}
            >
              Save &amp; accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RebrandAssistant({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="rebrand-session"
      tool="Rebrand Assistant"
      eyebrow="Content Studio"
      icon={<Wand2 />}
      description="A guided rebrand: set the new name, niche, audience, voice and colours, review proposed edits next to the original, accept or reject each chapter, then save as a version or a separate product."
      createLabel="New rebrand"
      onCreate={async () => (await createAsset(project.id, "rebrand-session", { title: `Rebrand — ${new Date().toLocaleDateString()}` })).id}
      itemMeta={(a) => `${a.data.config.newName || "New name not set"} · step ${a.data.step + 1} of 5`}
      renderEditor={(editor) => <RebrandEditor editor={editor} project={project} />}
    />
  );
}
