"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, ClipboardPaste, FileText, FileUp, FolderPlus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import { ACCEPTED_IMPORT, ACCEPTED_LABEL, importFile, plainTextToHtml, type ImportResult } from "@/lib/import";
import { splitIntoChapters, SPLIT_STRATEGY_LABELS, type SplitStrategy } from "@/lib/doc/chapters";
import { htmlToDoc } from "@/lib/doc/parse";
import { promotePseudoHeadings } from "@/lib/doc/chapters";
import { docToHtml } from "@/lib/doc/html";
import { docWords } from "@/lib/doc/text";
import { createDocumentFromImport, findProjectsWithFingerprint } from "@/lib/services/documents";
import { createProject } from "@/lib/services/projects";
import { setActiveProjectId } from "@/lib/data/hooks";
import { cn, errorMessage, sha256Hex } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Field, Input, NativeSelect, Spinner, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { FileDrop } from "@/components/common/file-drop";

type Stage = { kind: "choose" } | { kind: "paste" } | { kind: "reading"; message: string } | { kind: "preview"; result: ImportResult } | { kind: "error"; message: string };

export function ImportDialog({ open, onOpenChange, project, initialFile }: { open: boolean; onOpenChange: (o: boolean) => void; project: Project | null; initialFile?: File | null }) {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>({ kind: "choose" });
  const [strategy, setStrategy] = React.useState<SplitStrategy>("auto");
  const [title, setTitle] = React.useState("");
  const [selected, setSelected] = React.useState(0);
  const [destination, setDestination] = React.useState<"current" | "new">("current");
  const [pasteText, setPasteText] = React.useState("");
  const [duplicates, setDuplicates] = React.useState<Project[]>([]);
  const [saving, setSaving] = React.useState(false);

  const reset = React.useCallback(() => {
    setStage({ kind: "choose" });
    setStrategy("auto");
    setTitle("");
    setSelected(0);
    setPasteText("");
    setDuplicates([]);
    setDestination(project ? "current" : "new");
  }, [project]);

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const read = React.useCallback(async (file: File) => {
    setStage({ kind: "reading", message: "Reading file…" });
    try {
      const result = await importFile(file, (message) => setStage({ kind: "reading", message }));
      setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim());
      setDuplicates(await findProjectsWithFingerprint(result.fingerprint));
      setStage({ kind: "preview", result });
    } catch (err) {
      setStage({ kind: "error", message: errorMessage(err) });
    }
  }, []);

  React.useEffect(() => {
    if (open && initialFile) void read(initialFile);
  }, [open, initialFile, read]);

  const readPaste = async () => {
    const text = pasteText.trim();
    if (!text) return;
    const looksHtml = /<\/?(p|h[1-6]|ul|ol|li|div|strong|em)\b/i.test(text);
    const doc = promotePseudoHeadings(htmlToDoc(looksHtml ? text : plainTextToHtml(text)));
    const blob = new Blob([text], { type: "text/plain" });
    const result: ImportResult = { fileName: "Pasted text", format: "paste", doc, wordCount: docWords(doc), pageCount: null, warnings: [], empty: docWords(doc) === 0, fingerprint: await sha256Hex(text), blob, documentTitle: null };
    setTitle("Pasted document");
    setDuplicates(await findProjectsWithFingerprint(result.fingerprint));
    setStage({ kind: "preview", result });
  };

  const split = React.useMemo(() => (stage.kind === "preview" ? splitIntoChapters(stage.result.doc, strategy) : null), [stage, strategy]);
  React.useEffect(() => {
    if (split?.documentTitle) setTitle((t) => t || split.documentTitle!);
    setSelected(0);
  }, [split]);

  async function confirmImport() {
    if (stage.kind !== "preview" || !split) return;
    setSaving(true);
    try {
      let projectId = project?.id;
      if (destination === "new" || !projectId) {
        const p = await createProject({ name: title || stage.result.fileName, productType: "ebook", stage: "editing" });
        projectId = p.id;
        setActiveProjectId(p.id);
      }
      const asset = await createDocumentFromImport({ projectId, result: stage.result, title: title.trim() || stage.result.fileName, chapters: split.chapters });
      toast.success(`Imported ${split.chapters.length} chapter${split.chapters.length === 1 ? "" : "s"}`);
      onOpenChange(false);
      router.push(`/editor?id=${asset.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const preview = stage.kind === "preview" ? stage.result : null;
  const chapter = split?.chapters[selected];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("gap-0 p-0", preview ? "max-w-6xl" : "max-w-xl")}>
        <DialogHeader className="border-b p-5">
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="size-5 text-primary" /> Import PLR content
          </DialogTitle>
          <DialogDescription>
            {preview ? "Check the detected chapters before importing. The original is preserved unchanged for comparison." : `Import a ${ACCEPTED_LABEL} file. Nothing is uploaded — files are read in your browser.`}
          </DialogDescription>
        </DialogHeader>

        {stage.kind === "choose" && (
          <div className="grid gap-3 p-5">
            <FileDrop accept={ACCEPTED_IMPORT} onFiles={(f) => void read(f[0])} title="Drop your PLR file here, or click to browse" hint={`${ACCEPTED_LABEL} · up to 60 MB`} testId="import-drop" />
            <Button variant="ghost" onClick={() => setStage({ kind: "paste" })}>
              <ClipboardPaste /> Paste text instead
            </Button>
          </div>
        )}

        {stage.kind === "paste" && (
          <div className="grid gap-3 p-5">
            <Textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={12} placeholder="Paste your content here. Lines like “Chapter 1: …” become chapters." autoFocus aria-label="Pasted content" />
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStage({ kind: "choose" })}>
                Back
              </Button>
              <Button onClick={() => void readPaste()} disabled={!pasteText.trim()}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {stage.kind === "reading" && (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Spinner /> {stage.message}
          </div>
        )}

        {stage.kind === "error" && (
          <div className="grid gap-4 p-5">
            <Callout tone="danger" icon={<CircleAlert />} title="This file could not be imported">
              {stage.message}
            </Callout>
            <Button variant="outline" onClick={() => setStage({ kind: "choose" })}>
              Try another file
            </Button>
          </div>
        )}

        {preview && split && (
          <>
            <div className="grid max-h-[68dvh] min-h-0 lg:grid-cols-[340px_1fr]">
              <div className="plr-scroll grid min-w-0 content-start gap-4 overflow-y-auto overflow-x-hidden border-b p-5 lg:border-b-0 lg:border-r">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant="secondary">
                    <FileText /> {preview.fileName}
                  </Badge>
                  <Badge variant="outline">{preview.format.toUpperCase()}</Badge>
                  {preview.pageCount != null && <Badge variant="outline">{preview.pageCount} pages</Badge>}
                  <Badge variant="outline">{preview.wordCount.toLocaleString()} words</Badge>
                </div>
                {preview.warnings.map((w, i) => (
                  <Callout key={i} tone={preview.empty ? "danger" : "warning"} icon={<TriangleAlert />}>
                    {w}
                  </Callout>
                ))}
                {duplicates.length > 0 && (
                  <Callout tone="warning" icon={<TriangleAlert />} title="You've imported this exact file before">
                    Found in: {duplicates.map((d) => d.name).join(", ")}. You can still import it again.
                  </Callout>
                )}
                {!preview.empty && (
                  <>
                    <Field label="Document title" htmlFor="imp-title">
                      <Input id="imp-title" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="import-title" />
                    </Field>
                    <Field label="Split into chapters" htmlFor="imp-split" hint={`Using: ${SPLIT_STRATEGY_LABELS[split.strategyUsed]}`}>
                      <NativeSelect id="imp-split" value={strategy} onChange={(e) => setStrategy(e.target.value as SplitStrategy)}>
                        {(Object.keys(SPLIT_STRATEGY_LABELS) as SplitStrategy[]).map((s) => (
                          <option key={s} value={s}>
                            {SPLIT_STRATEGY_LABELS[s]}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <div>
                      <p className="mb-1.5 text-[13px] font-medium">
                        {split.chapters.length} chapter{split.chapters.length === 1 ? "" : "s"} detected
                      </p>
                      <ul className="grid gap-0.5" data-testid="import-chapters">
                        {split.chapters.map((c, i) => (
                          <li key={i}>
                            <button type="button" onClick={() => setSelected(i)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]", i === selected ? "bg-primary-soft font-medium" : "hover:bg-secondary")}>
                              <span className="w-5 shrink-0 text-right text-[11px] text-muted-foreground">{i + 1}</span>
                              <span className="min-w-0 flex-1 truncate">{c.title}</span>
                              <span className="text-[11px] text-muted-foreground">{docWords(c.content).toLocaleString()}w</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {project && (
                      <Field label="Save to">
                        <div className="grid gap-1.5 text-sm">
                          <label className="flex items-center gap-2">
                            <input type="radio" checked={destination === "current"} onChange={() => setDestination("current")} className="accent-[var(--primary)]" /> Current project: <span className="truncate font-medium">{project.name}</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" checked={destination === "new"} onChange={() => setDestination("new")} className="accent-[var(--primary)]" /> A new project
                          </label>
                        </div>
                      </Field>
                    )}
                  </>
                )}
              </div>
              <div className="plr-scroll min-h-[300px] overflow-y-auto bg-background p-5">
                {chapter && !preview.empty ? (
                  <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Preview · chapter {selected + 1}</p>
                    <h2 className="mb-4 text-2xl font-bold tracking-tight">{chapter.title}</h2>
                    <div className="plr-prose" dangerouslySetInnerHTML={{ __html: docToHtml(chapter.content) }} />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nothing to preview.</div>
                )}
              </div>
            </div>
            <DialogFooter className="border-t p-4">
              <Button variant="ghost" onClick={() => setStage({ kind: "choose" })}>
                Choose another file
              </Button>
              <Button onClick={() => void confirmImport()} loading={saving} disabled={preview.empty} data-testid="confirm-import">
                {destination === "new" || !project ? <FolderPlus /> : <FileUp />} Import {split.chapters.length} chapter{split.chapters.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
