"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, FilePlus2, GripVertical, LayoutTemplate, ListTree, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import { OUTLINE_TYPE_LABELS, OUTLINE_UNIT_LABELS, type OutlineData, type OutlineItem, type OutlineType } from "@/lib/models/content";
import { OUTLINE_TYPES } from "@/lib/ai/tasks";
import { DEFAULT_UNITS, outlineFromTemplate, outlineToChapters, outlineToExportDoc, outlineToMarkdown } from "@/lib/content/outline";
import { createAsset } from "@/lib/services/assets";
import { createDocument } from "@/lib/services/documents";
import { parseJsonLoose, useAIStatus, useAITask } from "@/lib/ai/client";
import { exportDocument, DEFAULT_DOC_EXPORT } from "@/lib/export/document";
import { safeFileName, textFile } from "@/lib/export/download";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, NativeSelect, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { AIRunStatus, AIStatusNotice, useBrief } from "@/components/common/ai";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage, uid } from "@/lib/utils";

interface AIOutline {
  title?: string;
  subtitle?: string;
  items?: { title?: string; summary?: string; sections?: string[] }[];
}

function aiToItems(o: AIOutline): OutlineItem[] {
  return (o.items ?? []).filter((i) => i.title).map((i) => ({ id: uid("oi"), title: String(i.title), summary: String(i.summary ?? ""), notes: "", sections: (i.sections ?? []).map((t) => ({ id: uid("os"), title: String(t), notes: "" })) }));
}

/* ------------------------------------------------------------------ */
/* Create dialog                                                        */
/* ------------------------------------------------------------------ */
function OutlineCreateDialog({ project, open, onOpenChange, onCreated }: { project: Project; open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [form, setForm] = React.useState({ type: "ebook" as OutlineType, topic: "", audience: project.audience, promise: "", units: DEFAULT_UNITS.ebook, sections: 3 });
  const ai = useAITask("outline.create");
  const { configured } = useAIStatus();
  const brief = useBrief(project.id);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) ai.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function create(items: OutlineItem[], generatedWith: OutlineData["generatedWith"], title?: string, subtitle?: string) {
    setBusy(true);
    try {
      const a = await createAsset(project.id, "outline", {
        title: title || `${form.topic || "Untitled"} — ${OUTLINE_TYPE_LABELS[form.type]} outline`,
        data: { type: form.type, topic: form.topic, audience: form.audience, promise: form.promise, subtitle: subtitle ?? "", items, generatedWith },
      });
      onOpenChange(false);
      onCreated(a.id);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New outline</DialogTitle>
          <DialogDescription>Start from a proven structure, or let AI draft one when it&apos;s configured. You can edit everything afterwards.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Format" htmlFor="o-type">
            <NativeSelect id="o-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as OutlineType, units: DEFAULT_UNITS[e.target.value as OutlineType] }))} data-testid="outline-type">
              {OUTLINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {OUTLINE_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Topic" htmlFor="o-topic">
            <Input id="o-topic" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} placeholder="e.g. Productive remote work" data-testid="outline-topic" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audience" htmlFor="o-aud" optional>
              <Input id="o-aud" value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))} />
            </Field>
            <Field label="Promise / outcome" htmlFor="o-pr" optional>
              <Input id="o-pr" value={form.promise} onChange={(e) => setForm((f) => ({ ...f, promise: e.target.value }))} />
            </Field>
            <Field label={`Number of ${OUTLINE_UNIT_LABELS[form.type].toLowerCase()}s`} htmlFor="o-units">
              <Input id="o-units" type="number" min={1} max={60} value={form.units} onChange={(e) => setForm((f) => ({ ...f, units: Math.max(1, Math.min(60, Number(e.target.value) || 1)) }))} />
            </Field>
            <Field label="Sections each" htmlFor="o-secs">
              <Input id="o-secs" type="number" min={0} max={12} value={form.sections} onChange={(e) => setForm((f) => ({ ...f, sections: Math.max(0, Math.min(12, Number(e.target.value) || 0)) }))} />
            </Field>
          </div>
          <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void ai.retry()} label="Drafting outline…" />
          <AIStatusNotice compact manualHint="Templates give you a complete, editable structure." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => void create(outlineFromTemplate(form.type, form.topic.trim(), form.units, form.sections), "template")} loading={busy && !ai.running} data-testid="outline-from-template">
            <LayoutTemplate /> Build from template
          </Button>
          <Button
            variant="gradient"
            disabled={!configured || ai.running || !form.topic.trim()}
            onClick={async () => {
              const r = await ai.run({ type: form.type, topic: form.topic, audience: form.audience, promise: form.promise, units: form.units, sectionsPerUnit: form.sections, brief }, project.id);
              if (!r) return;
              try {
                const o = parseJsonLoose<AIOutline>(r.text);
                const items = aiToItems(o);
                if (!items.length) throw new Error("The AI returned an empty outline. Retry or use a template.");
                await create(items, "ai", o.title, o.subtitle);
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          >
            <Sparkles /> Generate with AI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */
function ItemCard({ item, index, unit, onChange, onDelete, onMove, total }: { item: OutlineItem; index: number; unit: string; onChange: (it: OutlineItem) => void; onDelete: () => void; onMove: (d: -1 | 1) => void; total: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const setSection = (id: string, p: Partial<OutlineItem["sections"][number]>) => onChange({ ...item, sections: item.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("rounded-xl border bg-card", isDragging && "z-10 shadow-xl")} data-testid="outline-item">
      <div className="flex items-start gap-2 p-3">
        <button type="button" className="mt-1.5 cursor-grab text-muted-foreground/60 active:cursor-grabbing" aria-label="Drag to reorder" {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
        <span className="mt-1.5 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-primary">
          {unit} {index + 1}
        </span>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Input value={item.title} onChange={(e) => onChange({ ...item, title: e.target.value })} className="h-8 font-semibold" aria-label={`${unit} title`} />
          <Input value={item.summary} onChange={(e) => onChange({ ...item, summary: e.target.value })} className="h-8 text-[13px]" placeholder="One-sentence summary" aria-label="Summary" />
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button size="icon-xs" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
            <ArrowUp />
          </Button>
          <Button size="icon-xs" variant="ghost" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down">
            <ArrowDown />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={onDelete} aria-label={`Delete ${unit}`}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <ul className="grid gap-1 border-t bg-secondary/30 px-3 py-2 pl-12">
        {item.sections.map((s, j) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span className="w-6 text-right text-[11px] text-muted-foreground">
              {index + 1}.{j + 1}
            </span>
            <Input value={s.title} onChange={(e) => setSection(s.id, { title: e.target.value })} className="h-7 flex-1 bg-card text-[13px]" aria-label="Section title" />
            <Input value={s.notes} onChange={(e) => setSection(s.id, { notes: e.target.value })} className="hidden h-7 flex-1 bg-card text-[12px] md:block" placeholder="Notes" aria-label="Section notes" />
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={j === 0}
              onClick={() => {
                const next = [...item.sections];
                [next[j - 1], next[j]] = [next[j], next[j - 1]];
                onChange({ ...item, sections: next });
              }}
              aria-label="Move section up"
            >
              <ArrowUp />
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={() => onChange({ ...item, sections: item.sections.filter((x) => x.id !== s.id) })} aria-label="Remove section">
              <X />
            </Button>
          </li>
        ))}
        <li>
          <Button size="xs" variant="ghost" onClick={() => onChange({ ...item, sections: [...item.sections, { id: uid("os"), title: "New section", notes: "" }] })}>
            <Plus /> Section
          </Button>
        </li>
      </ul>
    </li>
  );
}

function OutlineEditor({ editor, project }: { editor: AssetEditor<"outline">; project: Project }) {
  const d = editor.data!;
  const router = useRouter();
  const confirm = useConfirm();
  const ai = useAITask("outline.create");
  const { configured } = useAIStatus();
  const brief = useBrief(project.id);
  const unit = OUTLINE_UNIT_LABELS[d.type];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const setItems = (items: OutlineItem[]) => editor.patch({ items });
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = d.items.findIndex((i) => i.id === e.active.id);
    const to = d.items.findIndex((i) => i.id === e.over!.id);
    setItems(arrayMove(d.items, from, to));
  };
  const sectionsTotal = d.items.reduce((n, i) => n + i.sections.length, 0);

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
      <div className="grid content-start gap-4">
        <Card className="grid gap-3 p-4">
          <Field label="Format" htmlFor="oe-type">
            <NativeSelect id="oe-type" value={d.type} onChange={(e) => editor.patch({ type: e.target.value as OutlineType })}>
              {OUTLINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {OUTLINE_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Subtitle" htmlFor="oe-sub" optional>
            <Input id="oe-sub" value={d.subtitle} onChange={(e) => editor.patch({ subtitle: e.target.value })} />
          </Field>
          <Field label="Topic" htmlFor="oe-topic">
            <Input id="oe-topic" value={d.topic} onChange={(e) => editor.patch({ topic: e.target.value })} />
          </Field>
          <Field label="Audience" htmlFor="oe-aud" optional>
            <Input id="oe-aud" value={d.audience} onChange={(e) => editor.patch({ audience: e.target.value })} />
          </Field>
          <Field label="Promise" htmlFor="oe-pr" optional>
            <Textarea id="oe-pr" value={d.promise} onChange={(e) => editor.patch({ promise: e.target.value })} rows={2} />
          </Field>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="secondary">
              {d.items.length} {unit.toLowerCase()}s
            </Badge>
            <Badge variant="secondary">{sectionsTotal} sections</Badge>
            <Badge variant={d.generatedWith === "ai" ? "ai" : "outline"}>{d.generatedWith === "ai" ? "AI draft" : d.generatedWith === "template" ? "From template" : "Manual"}</Badge>
          </div>
        </Card>
        <Card className="grid gap-2 p-4">
          <p className="text-sm font-semibold">Turn into a document</p>
          <p className="text-xs text-muted-foreground">Creates a document with one {unit.toLowerCase()} per item, section headings and writing prompts — ready to write in the PLR Editor or AI Writer.</p>
          <Button
            onClick={async () => {
              await editor.save();
              const a = await createDocument(project.id, { title: editor.title.replace(/\s*—\s*.*outline$/i, "") || d.topic || "Untitled", chapters: outlineToChapters(d), role: "draft", format: d.type, chapterLabel: unit, subtitle: d.subtitle, sourceAssetIds: [editor.asset!.id] });
              editor.patch({ documentId: a.id });
              toast.success("Document created from outline");
              router.push(`/editor?id=${a.id}`);
            }}
            data-testid="outline-to-doc"
          >
            <FilePlus2 /> Create document
          </Button>
          {d.documentId && (
            <Button variant="ghost" size="sm" onClick={() => router.push(`/editor?id=${d.documentId}`)}>
              Open the linked document
            </Button>
          )}
        </Card>
        <Card className="grid gap-2 p-4">
          <p className="text-sm font-semibold">Rebuild outline</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (d.items.length && !(await confirm({ title: "Replace with a fresh template?", description: "Your current outline is saved as a version first.", confirmLabel: "Replace" }))) return;
                await editor.snapshot("Before rebuilding outline", "pre-apply");
                editor.patch({ items: outlineFromTemplate(d.type, d.topic, Math.max(1, d.items.length || DEFAULT_UNITS[d.type]), 3), generatedWith: "template" });
              }}
            >
              <LayoutTemplate /> Template
            </Button>
            <Button
              size="sm"
              variant="gradient"
              disabled={!configured || ai.running || !d.topic}
              onClick={async () => {
                if (d.items.length && !(await confirm({ title: "Replace with an AI-drafted outline?", description: "Your current outline is saved as a version first.", confirmLabel: "Generate" }))) return;
                const r = await ai.run({ type: d.type, topic: d.topic, audience: d.audience, promise: d.promise, units: Math.max(1, d.items.length || DEFAULT_UNITS[d.type]), sectionsPerUnit: 3, brief }, project.id);
                if (!r) return;
                try {
                  const items = aiToItems(parseJsonLoose<AIOutline>(r.text));
                  if (!items.length) throw new Error("Empty outline returned.");
                  await editor.snapshot("Before AI outline", "pre-ai");
                  editor.patch({ items, generatedWith: "ai" });
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              <Sparkles /> AI
            </Button>
          </div>
          <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} />
        </Card>
      </div>
      <div className="grid content-start gap-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={d.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ol className="grid gap-3">
              {d.items.map((it, i) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  index={i}
                  total={d.items.length}
                  unit={unit}
                  onChange={(next) => setItems(d.items.map((x) => (x.id === it.id ? next : x)))}
                  onDelete={() => setItems(d.items.filter((x) => x.id !== it.id))}
                  onMove={(dir) => setItems(arrayMove(d.items, i, i + dir))}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
        <Button variant="outline" onClick={() => setItems([...d.items, { id: uid("oi"), title: `New ${unit.toLowerCase()}`, summary: "", notes: "", sections: [] }])} data-testid="outline-add-item">
          <Plus /> Add {unit.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}

export function OutlineGenerator({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="outline"
      tool="Outline Generator"
      eyebrow="Content Studio"
      icon={<ListTree />}
      description="Editable outlines for ebooks, reports, guides, workbooks, courses, email courses, challenges and membership lessons — from structured templates or AI. Reorder, edit and export, or turn an outline into a document."
      createLabel="New outline"
      createDialog={(p) => <OutlineCreateDialog project={project} {...p} />}
      itemMeta={(a) => `${OUTLINE_TYPE_LABELS[a.data.type]} · ${a.data.items.length} ${OUTLINE_UNIT_LABELS[a.data.type].toLowerCase()}s`}
      renderEditor={(editor) => <OutlineEditor editor={editor} project={project} />}
      versionText={(data) => outlineToMarkdown(data as OutlineData, "Outline")}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "md", label: "Markdown (.md)", run: () => textFile(outlineToMarkdown(editor.getData()!, editor.title), safeFileName(editor.title, "md"), "text/markdown") },
            { id: "docx", label: "Word (.docx)", run: () => exportDocument(outlineToExportDoc(editor.getData()!, editor.title), "docx", { ...DEFAULT_DOC_EXPORT, toc: false, titlePage: false }) },
            { id: "pdf", label: "PDF (.pdf)", run: () => exportDocument(outlineToExportDoc(editor.getData()!, editor.title), "pdf", { ...DEFAULT_DOC_EXPORT, toc: false, titlePage: false }) },
            { id: "json", label: "JSON (.json)", run: () => textFile(JSON.stringify({ title: editor.title, ...editor.getData() }, null, 2), safeFileName(editor.title, "json"), "application/json") },
          ]}
        />
      )}
    />
  );
}
