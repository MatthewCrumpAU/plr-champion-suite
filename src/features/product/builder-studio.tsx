"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, BookImage, ExternalLink, FileText, Hammer, LayoutTemplate, RotateCcw, Save, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { BuildFormat } from "@/lib/ai/tasks";
import { useAITask, useAIStatus } from "@/lib/ai/client";
import { BUILDER_FORMATS, BUILDER_KIND_LABELS, buildFromTemplate, formatInfo, type BuilderKind, type BuiltDocument } from "@/lib/content/builders";
import { markdownToDoc } from "@/lib/doc/parse";
import { splitIntoChapters } from "@/lib/doc/chapters";
import { docToHtml } from "@/lib/doc/html";
import { docWords } from "@/lib/doc/text";
import { useAssets, useBrandKit } from "@/lib/data/hooks";
import { createDocument } from "@/lib/services/documents";
import { getAsset, mutateAssetData } from "@/lib/services/assets";
import { createCoverFor, templateForFormat } from "@/lib/services/covers";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, EmptyState, Field, Input, Label, PageContainer, PageHeader, Textarea } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";
import { AIRunStatus, AIStatusNotice, AIUsageLine, MarkdownView, useBrief } from "@/components/common/ai";
import { SourcePicker, chaptersToMarkdown, type SourceSelection } from "@/components/common/source-picker";
import { DocumentExportMenu } from "@/components/common/doc-export";
import { cn, errorMessage, timeAgo } from "@/lib/utils";

interface BuilderState {
  format: BuildFormat;
  source: SourceSelection;
  title: string;
  audience: string;
  units: number;
  extra: string;
  draft: BuiltDocument | null;
  draftMethod: "template" | "ai" | null;
  opportunity: { scanId: string; oppId: string; name: string } | null;
  savedId: string | null;
}

const storeKey = (kind: BuilderKind, projectId: string) => `plrc.builder.${kind}.${projectId}`;

function initialState(kind: BuilderKind, project: Project): BuilderState {
  const f = BUILDER_FORMATS[kind][0];
  return { format: f.format, source: { documentId: null, chapterIds: [] }, title: "", audience: project.audience ?? "", units: f.defaultUnits, extra: "", draft: null, draftMethod: null, opportunity: null, savedId: null };
}

function useBuilderState(kind: BuilderKind, project: Project) {
  const [s, setS] = React.useState<BuilderState>(() => initialState(kind, project));
  const loaded = React.useRef(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey(kind, project.id));
      if (raw) setS({ ...initialState(kind, project), ...(JSON.parse(raw) as Partial<BuilderState>) });
    } catch {
      /* ignore */
    }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, project.id]);
  React.useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(storeKey(kind, project.id), JSON.stringify(s));
    } catch {
      /* draft persistence is a convenience */
    }
  }, [s, kind, project.id]);
  return [s, setS] as const;
}

function DraftPreview({ draft }: { draft: BuiltDocument }) {
  const [open, setOpen] = React.useState(0);
  return (
    <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
      <ol className="plr-scroll grid max-h-[60vh] content-start gap-0.5 overflow-y-auto" data-testid="draft-chapters">
        {draft.chapters.map((c, i) => (
          <li key={i}>
            <button type="button" onClick={() => setOpen(i)} className={cn("flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px]", open === i ? "bg-primary-soft font-medium text-primary" : "hover:bg-secondary")}>
              <span className="w-4 shrink-0 text-right text-[11px] text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1">{c.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="plr-scroll max-h-[60vh] overflow-y-auto rounded-lg border bg-white px-6 py-5">
        <h2 className="mb-3 text-xl font-semibold">{draft.chapters[open]?.title}</h2>
        <div className="plr-doc plr-prose text-[14.5px]" dangerouslySetInnerHTML={{ __html: docToHtml(draft.chapters[open]?.content) }} />
      </div>
    </div>
  );
}

function BuiltList({ kind, project, highlightId }: { kind: BuilderKind; project: Project; highlightId: string | null }) {
  const { data: docs } = useAssets<"document">(project.id, "document");
  const { data: kit } = useBrandKit(project.brandKitId);
  const router = useRouter();
  const role = BUILDER_KIND_LABELS[kind].role;
  const list = (docs ?? []).filter((d) => d.data.role === role);
  const noun = BUILDER_KIND_LABELS[kind].noun;
  if (!list.length) return null;
  return (
    <section className="mt-8 grid gap-3">
      <h2 className="text-base font-semibold">
        Your {noun === "bonus" ? "bonuses" : `${noun}s`} in {project.name}
      </h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="built-list">
        {list.map((d) => (
          <Card key={d.id} className={cn("grid gap-3 p-4", highlightId === d.id && "border-primary ring-2 ring-primary/20")}>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{d.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatInfo(kind, d.data.builder?.format ?? d.data.format).label} · {d.data.chapters.length} {d.data.chapterLabel.toLowerCase()}s · {d.data.chapters.reduce((n, c) => n + docWords(c.content), 0).toLocaleString()} words
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {d.data.builder?.generatedWith === "ai" ? "AI draft" : "Template draft"} · updated {timeAgo(d.updatedAt)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href={`/editor?id=${d.id}`}>
                  <ExternalLink /> Open in editor
                </Link>
              </Button>
              <DocumentExportMenu projectId={project.id} assetId={d.id} getDocument={() => ({ title: d.title, subtitle: d.data.subtitle, author: d.data.author || kit?.authorName, chapters: d.data.chapters })} />
              <Tooltip content="Create a matching cover in Cover Creator">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const c = await createCoverFor(project.id, { title: d.title, subtitle: d.data.subtitle, templateId: templateForFormat(d.data.builder?.format ?? d.data.format), sourceAssetId: d.id });
                      router.push(`/covers?id=${c.id}`);
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  <BookImage /> Cover
                </Button>
              </Tooltip>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function BuilderStudio({ kind, project, description }: { kind: BuilderKind; project: Project; description: string }) {
  const [s, setS] = useBuilderState(kind, project);
  const set = (patch: Partial<BuilderState>) => setS((x) => ({ ...x, ...patch }));
  const { data: docs } = useAssets<"document">(project.id, "document");
  const { configured } = useAIStatus();
  const ai = useAITask("product.build");
  const brief = useBrief(project.id);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [saving, setSaving] = React.useState(false);
  const labels = BUILDER_KIND_LABELS[kind];
  const info = formatInfo(kind, s.format);
  const formats = BUILDER_FORMATS[kind];
  const sourceDoc = docs?.find((d) => d.id === s.source.documentId) ?? null;
  const chosen = sourceDoc ? sourceDoc.data.chapters.filter((c) => s.source.chapterIds.includes(c.id)) : [];
  const approved = sourceDoc?.data.chapters.filter((c) => c.approved) ?? [];
  const suggestedTitle = sourceDoc ? `${sourceDoc.title.replace(/\s+—.*$/, "")} ${info.label}` : "";

  const buildTemplate = React.useCallback(
    (state: BuilderState, chapters: { id: string; title: string; content: BuiltDocument["chapters"][number]["content"] }[], title: string) => {
      const draft = buildFromTemplate({ kind, format: state.format, title, audience: state.audience, units: state.units, author: brief.author, sources: chapters });
      return draft;
    },
    [kind, brief.author],
  );

  // Hand-off from the Opportunity Scanner: ?scan=<assetId>&opp=<opportunityId>
  const handled = React.useRef<string | null>(null);
  React.useEffect(() => {
    const scanId = params.get("scan");
    const oppId = params.get("opp");
    if (!scanId || !oppId || !docs || handled.current === `${scanId}:${oppId}`) return;
    handled.current = `${scanId}:${oppId}`;
    (async () => {
      const scan = await getAsset<"opportunity-scan">(scanId);
      const opp = scan?.data.opportunities.find((o) => o.id === oppId);
      const doc = docs.find((d) => d.id === scan?.data.documentId);
      if (!scan || !opp || !doc) {
        toast.error("That opportunity could not be found — its scan or source document may have been deleted.");
        router.replace(pathname);
        return;
      }
      const format = (formats.some((f) => f.format === opp.format) ? opp.format : formats[0].format) as BuildFormat;
      const chapterIds = opp.sourceChapterIds.filter((id) => doc.data.chapters.some((c) => c.id === id));
      const ids = chapterIds.length ? chapterIds : doc.data.chapters.map((c) => c.id);
      const f = formatInfo(kind, format);
      const next: BuilderState = { ...s, format, source: { documentId: doc.id, chapterIds: ids }, title: opp.name, units: Math.min(f.defaultUnits, Math.max(3, ids.length)), opportunity: { scanId, oppId, name: opp.name }, savedId: null, draft: null, draftMethod: null };
      try {
        next.draft = buildTemplate(next, doc.data.chapters.filter((c) => ids.includes(c.id)), opp.name);
        next.draftMethod = "template";
      } catch (e) {
        toast.error(errorMessage(e));
      }
      setS(next);
      router.replace(pathname);
      toast.success(`Draft ready: ${opp.name}`);
    })();
  }, [params, docs, formats, kind, pathname, router, s, setS, buildTemplate]);

  const runTemplate = () => {
    if (!chosen.length) return toast.error("Select at least one source chapter.");
    try {
      const title = s.title.trim() || suggestedTitle || "Untitled";
      set({ draft: buildTemplate(s, chosen, title), draftMethod: "template", savedId: null, title });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const runAI = async () => {
    if (!chosen.length) return toast.error("Select at least one source chapter.");
    const title = s.title.trim() || suggestedTitle || "Untitled";
    set({ title });
    const r = await ai.run({ format: s.format, title, audience: s.audience, units: s.units, sourceText: chaptersToMarkdown(chosen, 80_000), extra: s.extra, brief }, project.id);
    if (!r) return;
    const split = splitIntoChapters(markdownToDoc(r.text), "h2");
    set({ draft: { title: split.documentTitle || title, subtitle: `${info.label}${s.audience ? ` for ${s.audience}` : ""}`, chapters: split.chapters }, draftMethod: "ai", savedId: null });
  };

  const save = async () => {
    if (!s.draft) return;
    setSaving(true);
    try {
      const doc = await createDocument(project.id, {
        title: s.draft.title || s.title,
        subtitle: s.draft.subtitle,
        role: labels.role,
        format: s.format,
        chapterLabel: info.chapterLabel,
        chapters: s.draft.chapters,
        sourceAssetIds: s.source.documentId ? [s.source.documentId] : [],
        builder: { kind, format: s.format, sourceDocumentId: s.source.documentId, sourceChapterIds: s.source.chapterIds, generatedWith: s.draftMethod ?? "template", opportunityId: s.opportunity?.oppId ?? null },
      });
      if (s.opportunity) {
        const { scanId, oppId } = s.opportunity;
        await mutateAssetData<"opportunity-scan">(scanId, (d) => ({ ...d, opportunities: d.opportunities.map((o) => (o.id === oppId ? { ...o, builtAssetId: doc.id } : o)) })).catch(() => undefined);
      }
      set({ savedId: doc.id });
      toast.success(`Saved “${doc.title}” as a ${labels.noun}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer width="wide">
      <PageHeader eyebrow="Product Studio" title={labels.tool} description={description} />
      {s.opportunity && (
        <Callout tone="info" className="mb-4" title={`From the Opportunity Scanner: ${s.opportunity.name}`}>
          Format, title and source chapters were pre-filled from the opportunity. Price and rating there are estimates only.{" "}
          <Link href={`/opportunities?id=${s.opportunity.scanId}`} className="font-medium underline">
            Back to the scan
          </Link>
        </Callout>
      )}
      <div className="grid gap-5 xl:grid-cols-[400px_1fr]">
        <div className="grid content-start gap-5">
          <Card className="grid gap-3 p-4">
            <Label>Format</Label>
            <div className="grid grid-cols-2 gap-2" data-testid="builder-formats">
              {formats.map((f) => (
                <button
                  key={f.format}
                  type="button"
                  onClick={() => set({ format: f.format, units: f.defaultUnits })}
                  className={cn("grid gap-0.5 rounded-lg border p-2.5 text-left transition", s.format === f.format ? "border-primary bg-primary-soft" : "hover:border-primary/50")}
                  data-testid={`format-${f.format}`}
                >
                  <span className="text-[13px] font-semibold">{f.label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">{f.description}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card className="grid gap-4 p-4">
            {!docs?.length ? (
              <EmptyState icon={<FileText />} title="No source documents yet" description="Import a PLR product in the PLR Editor first, then build from its chapters." action={<Button asChild><Link href="/editor">Open PLR Editor</Link></Button>} />
            ) : (
              <>
                <SourcePicker projectId={project.id} value={s.source} onChange={(v) => set({ source: v })} maxHeight={220} />
                {approved.length > 0 && (
                  <Button size="xs" variant="ghost" className="-mt-2 justify-self-start" onClick={() => set({ source: { ...s.source, chapterIds: approved.map((c) => c.id) } })}>
                    <BadgeCheck /> Use approved chapters only ({approved.length})
                  </Button>
                )}
              </>
            )}
            <Field label="Title" htmlFor="b-title">
              <Input id="b-title" value={s.title} onChange={(e) => set({ title: e.target.value })} placeholder={suggestedTitle || "e.g. The Calm Focus Workbook"} data-testid="builder-title" />
            </Field>
            <Field label="Audience" htmlFor="b-aud" optional>
              <Input id="b-aud" value={s.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Who it's for" />
            </Field>
            <Field label={`Number of ${info.unitLabel}`} htmlFor="b-units" hint="Chapters are grouped (or split at their sub-headings) to reach this number.">
              <Input id="b-units" type="number" min={1} max={30} value={s.units} onChange={(e) => set({ units: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })} className="w-28" data-testid="builder-units" />
            </Field>
            <Field label="Extra instructions for AI" htmlFor="b-extra" optional>
              <Textarea id="b-extra" rows={2} value={s.extra} onChange={(e) => set({ extra: e.target.value })} placeholder="e.g. Use Australian spelling. Keep each part under 400 words." />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={runTemplate} disabled={!chosen.length} data-testid="builder-template">
                <LayoutTemplate /> Build from template
              </Button>
              <Tooltip content={configured ? "Rewrite the selected chapters into this format with Claude" : "Configure AI in Settings to enable"}>
                <span>
                  <Button variant="gradient" className="w-full" onClick={() => void runAI()} disabled={!configured || !chosen.length || ai.running} data-testid="builder-ai">
                    <Sparkles /> Generate with AI
                  </Button>
                </span>
              </Tooltip>
            </div>
            <AIStatusNotice compact manualHint="Template builds restructure your selected chapters into the chosen format instantly." />
          </Card>
        </div>

        <Card className="grid min-w-0 content-start gap-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Hammer className="size-4 text-primary" />
            <h2 className="font-semibold">Draft</h2>
            {s.draft && <Badge variant={s.draftMethod === "ai" ? "ai" : "secondary"}>{s.draftMethod === "ai" ? "AI draft" : "Template draft"}</Badge>}
            {s.draft && (
              <span className="text-xs text-muted-foreground">
                {s.draft.chapters.length} parts · {s.draft.chapters.reduce((n, c) => n + docWords(c.content), 0).toLocaleString()} words
              </span>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {s.draft && !s.savedId && (
                <Button variant="ghost" size="sm" onClick={() => set({ draft: null, draftMethod: null })}>
                  <RotateCcw /> Discard
                </Button>
              )}
              {s.draft && !s.savedId && (
                <Button size="sm" onClick={() => void save()} loading={saving} data-testid="builder-save">
                  <Save /> Save as {labels.noun}
                </Button>
              )}
              {s.savedId && (
                <Button size="sm" asChild data-testid="builder-open">
                  <Link href={`/editor?id=${s.savedId}`}>
                    <ExternalLink /> Open in PLR Editor
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void ai.retry()} label="Writing your draft…" />
          {ai.running && ai.text && (
            <div className="plr-scroll max-h-[60vh] overflow-y-auto rounded-lg border bg-white p-5">
              <MarkdownView markdown={ai.text} />
            </div>
          )}
          {!ai.running && s.draft ? (
            <>
              {s.savedId ? (
                <Callout tone="success" title="Saved">
                  This {labels.noun} is now its own document in the project. Edit, rebrand, export or make a cover for it from the list below.
                </Callout>
              ) : s.draftMethod === "template" ? (
                <Callout tone="info">Template drafts reuse the source&apos;s own wording in a new structure. Before selling, rewrite it in your voice (PLR Editor, Rebrand Assistant or AI Writer) and check your licence allows derivative products.</Callout>
              ) : (
                <Callout tone="info">AI drafts can contain mistakes. Review every section before you publish.</Callout>
              )}
              <DraftPreview draft={s.draft} />
              {s.draftMethod === "ai" && <AIUsageLine result={ai.result} />}
            </>
          ) : (
            !ai.running && (
              <EmptyState
                icon={<Wand2 />}
                title="No draft yet"
                description={`Choose a format and source chapters, then build a draft. Nothing is saved until you click “Save as ${labels.noun}”.`}
              />
            )
          )}
        </Card>
      </div>
      <BuiltList kind={kind} project={project} highlightId={s.savedId} />
    </PageContainer>
  );
}

