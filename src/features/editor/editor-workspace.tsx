"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { ArrowLeft, BarChart3, ChevronDown, Columns2, Eye, FileText, History, NotebookPen, PanelLeft, PanelRight, Plus, Settings2, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import { editorExtensions } from "@/lib/editor/extensions";
import { SearchHighlight } from "@/lib/editor/search";
import { replaceInDoc } from "@/lib/doc/replace";
import { docText, docWords } from "@/lib/doc/text";
import { docToHtml } from "@/lib/doc/html";
import type { PMDoc } from "@/lib/doc/types";
import { DOCUMENT_ROLE_LABELS, normalizeDocumentData, type Chapter, type DocumentData } from "@/lib/models/document";
import { useAssets, useBrandKit } from "@/lib/data/hooks";
import { updateProject } from "@/lib/services/projects";
import { deepClone, plural } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, Spinner } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Sheet, SheetContent, SheetTitle, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { SaveStatus } from "@/components/common/save-status";
import { VersionHistoryDialog } from "@/components/common/version-history";
import { DocumentExportMenu } from "@/components/common/doc-export";
import { DocumentPreviewDialog } from "@/components/common/doc-preview";
import { useBrief } from "@/components/common/ai";
import { useBreadcrumb } from "@/components/shell/app-shell";
import type { ExportableDocument } from "@/lib/export/document";
import { useDocument } from "./use-document";
import { FormattingToolbar } from "./formatting-toolbar";
import { FindBar } from "./find-bar";
import { ChapterList } from "./chapter-list";
import { OutlinePanel } from "./outline-panel";
import { CompareView } from "./compare-view";
import { AIPanel, AnalysisPanel, DetailsPanel, NotesPanel, ToolsPanel } from "./panels";
import { cn } from "@/lib/utils";
import { useToolHref } from "@/components/common/tool-links";

function useMedia(query: string) {
  const [m, setM] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return m;
}

function TitleInput({ value, onChange, onEnter, placeholder }: { value: string; onChange: (v: string) => void; onEnter: () => void; placeholder: string }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
      className="mb-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[2rem] font-bold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50"
      aria-label="Chapter title"
      data-testid="chapter-title"
    />
  );
}

function ChapterEditor({ chapter, editorKey, onReady, onChange, placeholder }: { chapter: Chapter; editorKey: number; onReady: (e: Editor | null) => void; onChange: (e: Editor) => void; placeholder: string }) {
  const editor = useEditor(
    {
      extensions: [...editorExtensions({ placeholder }), SearchHighlight],
      content: chapter.content,
      immediatelyRender: false,
      editorProps: { attributes: { class: "plr-doc", "data-testid": "doc-editor", spellcheck: "true" } },
      onUpdate: ({ editor: e }) => onChange(e as Editor),
    },
    [editorKey],
  );
  React.useEffect(() => {
    onReady(editor as Editor | null);
    return () => onReady(null);
  }, [editor, onReady]);
  return <EditorContent editor={editor} />;
}

export function EditorWorkspace({ assetId, project }: { assetId: string; project: Project }) {
  const router = useRouter();
  const toolHref = useToolHref();
  const doc = useDocument(assetId);
  const confirm = useConfirm();
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [leftTab, setLeftTab] = React.useState("chapters");
  const [rightTab, setRightTab] = React.useState("ai");
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [rightOpen, setRightOpen] = React.useState(true);
  const [leftSheet, setLeftSheet] = React.useState(false);
  const [rightSheet, setRightSheet] = React.useState(false);
  const [find, setFind] = React.useState<null | "find" | "replace">(null);
  const [compare, setCompare] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [previewDoc, setPreviewDoc] = React.useState<ExportableDocument | null>(null);
  const isLg = useMedia("(min-width: 1024px)");
  const isXl = useMedia("(min-width: 1280px)");
  const { data: kit } = useBrandKit(project.brandKitId);
  const { data: projectDocs } = useAssets(project.id, "document");
  const brief = useBrief(project.id, { productName: doc.title, description: doc.meta?.description });
  useBreadcrumb(doc.title || null);

  /* ---------------------- editor → state sync ---------------------- */
  const pending = React.useRef<{ id: string; editor: Editor } | null>(null);
  const syncTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = React.useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p && !p.editor.isDestroyed) doc.setChapterContent(p.id, p.editor.getJSON() as PMDoc);
  }, [doc]);
  const activeIdRef = React.useRef(doc.activeId);
  activeIdRef.current = doc.activeId;
  const onEditorChange = React.useCallback(
    (e: Editor) => {
      if (!activeIdRef.current) return;
      pending.current = { id: activeIdRef.current, editor: e };
      doc.notePending();
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(flush, 300);
    },
    [flush, doc],
  );
  // Leaving or hiding the page pushes any typed-but-unsynced text into the save queue.
  React.useEffect(() => {
    const onHide = () => {
      if (pending.current) {
        flush();
        void doc.save();
      }
    };
    const onVisibility = () => document.visibilityState === "hidden" && onHide();
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flush, doc]);
  const flushAndSave = React.useCallback(async () => {
    flush();
    await new Promise((r) => setTimeout(r, 0));
    await doc.save();
  }, [flush, doc]);

  const select = (id: string) => {
    flush();
    doc.selectChapter(id);
    if (!isLg) setLeftSheet(false);
  };

  /* ---------------------------- actions ---------------------------- */
  const snapshotNow = React.useCallback(
    async (label: string, reason: "pre-ai" | "pre-bulk" | "pre-apply" | "manual") => {
      flush();
      await new Promise((r) => setTimeout(r, 0));
      await doc.snapshot(label, reason);
    },
    [flush, doc],
  );

  const replaceEverywhere = async (find: string, replacement: string, opts: { caseSensitive: boolean; wholeWord: boolean }) => {
    flush();
    let total = 0;
    const next = doc.getChapters().map((c) => {
      const r = replaceInDoc(c.content, find, replacement, opts);
      const t = replaceInDoc({ type: "doc", content: [{ type: "paragraph", content: c.title ? [{ type: "text", text: c.title }] : [] }] }, find, replacement, opts);
      total += r.count + t.count;
      return { ...c, content: r.doc, title: t.count ? docText(t.doc) : c.title };
    });
    if (!total) return toast.info(`No matches for “${find}” in any ${doc.chapterLabel.toLowerCase()}.`);
    const ok = await confirm({ title: `Replace ${plural(total, "match", "matches")} in all ${doc.chapterLabel.toLowerCase()}s?`, description: "A version is saved first, so this can be undone from Version history.", confirmLabel: "Replace all" });
    if (!ok) return;
    await snapshotNow(`Before replacing “${find}” everywhere`, "pre-bulk");
    doc.ops.replaceAll(next);
    toast.success(`Replaced ${plural(total, "match", "matches")}`);
  };

  const getExportDocument = React.useCallback((): ExportableDocument => {
    flush();
    return { title: doc.title || "Untitled", subtitle: doc.meta?.subtitle, author: doc.meta?.author, chapters: doc.getChapters().map((c) => ({ title: c.title, content: c.content })) };
  }, [flush, doc]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s" && !e.shiftKey) {
        e.preventDefault();
        void flushAndSave().then(() => toast.success("All changes saved"));
      } else if (k === "s" && e.shiftKey) {
        e.preventDefault();
        void flushAndSave().then(() => setHistoryOpen(true));
      } else if (k === "f" && !e.shiftKey) {
        e.preventDefault();
        setCompare(false);
        setFind("find");
      } else if (k === "h" && !e.shiftKey) {
        e.preventDefault();
        setCompare(false);
        setFind("replace");
      } else if (k === "k" && editor?.isFocused) {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>("[data-link-trigger]")?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flushAndSave, editor]);

  /* ---------------------------- render ---------------------------- */
  if (doc.missing) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <p className="text-lg font-semibold">Document not found</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted or moved to the Trash.</p>
        <Button asChild className="mt-4">
          <Link href={toolHref("/editor")}>Back to documents</Link>
        </Button>
      </div>
    );
  }
  if (!doc.asset || !doc.meta) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Opening document…
      </div>
    );
  }

  const active = doc.activeChapter;
  const originals = doc.asset.data.original?.chapters ?? [];
  const totalWords = doc.chapters.reduce((n, c) => n + docWords(c.content), 0);
  const label = doc.chapterLabel;

  const left = (
    <Tabs value={leftTab} onValueChange={setLeftTab} className="flex h-full min-h-0 flex-col">
      <div className="border-b p-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chapters">{label}s</TabsTrigger>
          <TabsTrigger value="outline">Outline</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="chapters" className="plr-scroll min-h-0 flex-1 overflow-y-auto p-2">
        <ChapterList
          chapters={doc.chapters}
          activeId={doc.activeId}
          label={label}
          actions={{
            onSelect: select,
            onAdd: (after) => {
              flush();
              doc.ops.add(after);
            },
            onRename: doc.ops.rename,
            onDuplicate: (id) => {
              flush();
              doc.ops.duplicate(id);
            },
            onDelete: (id) => {
              flush();
              doc.ops.remove(id);
            },
            onReorder: doc.ops.reorder,
            onMove: doc.ops.move,
            onMergeNext: (id) => {
              flush();
              doc.ops.mergeNext(id);
            },
            onSplit: (id) => {
              if (!editor) return;
              flush();
              const idx = editor.state.selection.$from.index(0);
              doc.ops.split(id, idx);
            },
            onToggleApproved: doc.ops.toggleApproved,
          }}
        />
      </TabsContent>
      <TabsContent value="outline" className="plr-scroll min-h-0 flex-1 overflow-y-auto p-2">
        <OutlinePanel editor={editor} chapters={doc.chapters} activeId={doc.activeId} onSelectChapter={select} label={label} />
      </TabsContent>
    </Tabs>
  );

  const tabs = [
    { id: "ai", label: "AI", icon: <Sparkles className="size-3.5" /> },
    { id: "tools", label: "Tools", icon: <Wrench className="size-3.5" /> },
    { id: "details", label: "Details", icon: <Settings2 className="size-3.5" /> },
    { id: "analysis", label: "Analysis", icon: <BarChart3 className="size-3.5" /> },
    { id: "notes", label: "Notes", icon: <NotebookPen className="size-3.5" /> },
  ];

  const right = (
    <Tabs value={rightTab} onValueChange={setRightTab} className="flex h-full min-h-0 flex-col">
      <div className="border-b p-2">
        <TabsList className="grid h-auto w-full grid-cols-5 gap-0.5">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="h-auto flex-col gap-0.5 px-1 py-1.5 text-[10.5px]" data-testid={`tab-${t.id}`}>
              {t.icon}
              <span className="truncate">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="ai" forceMount hidden={rightTab !== "ai"} className="plr-scroll min-h-0 flex-1 overflow-y-auto">
        <AIPanel editor={editor} projectId={project.id} brief={brief} onBeforeReplace={(l) => snapshotNow(l, "pre-ai")} />
      </TabsContent>
      <TabsContent value="tools" className="plr-scroll min-h-0 flex-1 overflow-y-auto">
        <ToolsPanel
          chapters={doc.chapters}
          rules={doc.meta.rules}
          onRulesChange={doc.setRules}
          activeChapterId={doc.activeId}
          onApply={async (next, count, scope) => {
            await snapshotNow("Before rebrand replacements", "pre-bulk");
            doc.ops.replaceAll(next);
            toast.success(`Applied ${plural(count, "replacement")} to ${scope}`);
          }}
        />
      </TabsContent>
      <TabsContent value="details" className="plr-scroll min-h-0 flex-1 overflow-y-auto">
        <DetailsPanel
          title={doc.title}
          onTitle={doc.setTitle}
          status={doc.status}
          onStatus={doc.setStatus}
          meta={doc.meta}
          onMeta={doc.setMeta}
          isMain={project.mainDocumentId === doc.asset.id}
          onMakeMain={async () => {
            await updateProject(project.id, { mainDocumentId: doc.asset!.id });
            toast.success("Set as the main document");
          }}
          authorSuggestion={kit?.authorName}
        />
      </TabsContent>
      <TabsContent value="analysis" className="plr-scroll min-h-0 flex-1 overflow-y-auto">
        <AnalysisPanel chapters={doc.chapters} originals={originals} activeId={doc.activeId} />
      </TabsContent>
      <TabsContent value="notes" className="plr-scroll min-h-0 flex-1 overflow-y-auto">
        <NotesPanel docNotes={doc.meta.notes} onDocNotes={(v) => doc.setMeta({ notes: v })} chapter={active} onChapterNotes={(v) => active && doc.updateChapter(active.id, { notes: v })} label={label} />
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="no-print flex h-12 shrink-0 items-center gap-1.5 border-b bg-card px-2 sm:px-3">
        <Tooltip content="All documents">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={toolHref("/editor")} aria-label="All documents">
              <ArrowLeft />
            </Link>
          </Button>
        </Tooltip>
        <Tooltip content={`${label}s panel`}>
          <Button variant="ghost" size="icon-sm" onClick={() => (isLg ? setLeftOpen((o) => !o) : setLeftSheet(true))} aria-label="Toggle left panel">
            <PanelLeft />
          </Button>
        </Tooltip>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-semibold hover:bg-secondary" data-testid="doc-switcher">
                <span className="truncate">{doc.title || "Untitled document"}</span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80">
              <DropdownMenuLabel>Documents in {project.name}</DropdownMenuLabel>
              {projectDocs?.map((d) => (
                <DropdownMenuItem key={d.id} onSelect={() => router.push(toolHref(`/editor?id=${d.id}`))} className={cn(d.id === assetId && "bg-secondary")}>
                  <FileText />
                  <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  <span className="text-[11px] text-muted-foreground">{d.data.role}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={toolHref("/editor")}>
                  <Plus /> Import or create a document
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {doc.meta.role !== "main" && <Badge variant="secondary" className="hidden md:inline-flex">{DOCUMENT_ROLE_LABELS[doc.meta.role]}</Badge>}
        </div>
        <SaveStatus state={doc.saveState} lastSavedAt={doc.lastSavedAt} onRetry={() => void flushAndSave()} />
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Tooltip content="Version history" shortcut="Ctrl+Shift+S">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={async () => {
              await flushAndSave();
              setHistoryOpen(true);
            }}
            aria-label="Version history"
            data-testid="open-history"
          >
            <History />
          </Button>
        </Tooltip>
        <Tooltip content={compare ? "Back to editing" : "Original vs edited"}>
          <Button
            variant={compare ? "soft" : "ghost"}
            size="icon-sm"
            className="hidden md:inline-flex"
            onClick={() => {
              flush();
              setFind(null);
              setCompare((c) => !c);
            }}
            aria-label="Compare with original"
            aria-pressed={compare}
            data-testid="toggle-compare"
          >
            <Columns2 />
          </Button>
        </Tooltip>
        <Tooltip content="Preview">
          <Button variant="ghost" size="icon-sm" onClick={() => setPreviewDoc(getExportDocument())} aria-label="Preview">
            <Eye />
          </Button>
        </Tooltip>
        <DocumentExportMenu
          getDocument={async () => {
            await flushAndSave();
            return getExportDocument();
          }}
          projectId={project.id}
          assetId={assetId}
        />
        <Tooltip content="Tools panel">
          <Button variant="ghost" size="icon-sm" onClick={() => (isXl ? setRightOpen((o) => !o) : setRightSheet(true))} aria-label="Toggle right panel">
            <PanelRight />
          </Button>
        </Tooltip>
      </div>

      <div className="flex min-h-0 flex-1">
        {isLg && leftOpen && <aside className="w-[264px] shrink-0 overflow-hidden border-r bg-card">{left}</aside>}

        <section className="relative flex min-w-0 flex-1 flex-col">
          {!compare && <FormattingToolbar editor={editor} onFind={() => setFind("find")} />}
          {find && editor && !compare && <FindBar editor={editor} showReplace={find === "replace"} chapterLabel={label} onClose={() => { setFind(null); editor.commands.focus(); }} onReplaceEverywhere={(f, r, o) => void replaceEverywhere(f, r, o)} />}
          {compare && active ? (
            <div className="min-h-0 flex-1">
              <CompareView
                chapter={active}
                index={doc.activeIndex}
                originals={originals}
                onRestoreOriginal={async (o) => {
                  const ok = await confirm({ title: "Replace this chapter with the original text?", description: "A version of your edited text is saved first.", confirmLabel: "Use original" });
                  if (!ok) return;
                  await snapshotNow(`Before restoring original “${o.title}”`, "pre-apply");
                  doc.ops.replaceAll(doc.chapters.map((c) => (c.id === active.id ? { ...c, content: deepClone(o.content) } : c)));
                  setCompare(false);
                }}
              />
            </div>
          ) : (
            <div
              className="plr-scroll min-h-0 flex-1 overflow-y-auto"
              onClick={(e) => {
                if (e.target === e.currentTarget) editor?.commands.focus("end");
              }}
            >
              <div className="mx-auto my-4 w-full max-w-[820px] px-2 sm:my-8 sm:px-4">
                <div className="rounded-2xl border bg-card px-5 py-8 shadow-[0_1px_3px_rgba(16,24,40,0.06)] sm:px-14 sm:py-12">
                  {active ? (
                    <>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                        {label} {doc.activeIndex + 1} of {doc.chapters.length}
                      </p>
                      <TitleInput value={active.title} onChange={(v) => doc.updateChapter(active.id, { title: v })} onEnter={() => editor?.commands.focus("start")} placeholder={`${label} title`} />
                      <ChapterEditor key={`${active.id}-${doc.editorKey}`} chapter={active} editorKey={doc.editorKey} onReady={setEditor} onChange={onEditorChange} placeholder={`Write this ${label.toLowerCase()}, or paste content…`} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No {label.toLowerCase()} selected.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="no-print flex h-8 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap border-t bg-card px-3 text-[11px] text-muted-foreground" data-testid="status-bar">
            <span>
              {label}: {active ? docWords(active.content).toLocaleString() : 0} words
            </span>
            <span data-testid="total-words">Total: {totalWords.toLocaleString()} words</span>
            <span className="hidden sm:inline">{editor ? `${editor.storage.characterCount?.characters?.() ?? 0} characters` : ""}</span>
            <span className="ml-auto hidden 2xl:inline">Ctrl+S save · Ctrl+F find · Ctrl+H replace · Ctrl+Shift+S versions</span>
          </div>
        </section>

        {isXl && rightOpen && <aside className="w-[360px] shrink-0 overflow-hidden border-l bg-card">{right}</aside>}
      </div>

      <Sheet open={leftSheet && !isLg} onOpenChange={setLeftSheet}>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetTitle className="sr-only">{label}s</SheetTitle>
          <div className="h-full pt-8">{left}</div>
        </SheetContent>
      </Sheet>
      <Sheet open={rightSheet && !isXl} onOpenChange={setRightSheet}>
        <SheetContent side="right" className="w-[92vw] max-w-md p-0">
          <SheetTitle className="sr-only">Tools</SheetTitle>
          <div className="h-full pt-8">{right}</div>
        </SheetContent>
      </Sheet>

      <VersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        asset={doc.asset}
        beforeAction={flushAndSave}
        onRestored={() => doc.reload()}
        toText={(d) => normalizeDocumentData(d).chapters.map((c) => `${c.title}\n\n${docText(c.content)}`).join("\n\n")}
        renderPreview={(d, title) => {
          const data = normalizeDocumentData(d) as DocumentData;
          return (
            <div className="plr-prose">
              <h1>{title}</h1>
              {data.chapters.map((c) => (
                <section key={c.id}>
                  <h2>{c.title}</h2>
                  <div dangerouslySetInnerHTML={{ __html: docToHtml(c.content) }} />
                </section>
              ))}
            </div>
          );
        }}
      />
      <DocumentPreviewDialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)} doc={previewDoc} />
    </div>
  );
}
