"use client";

import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { ChevronDown, ChevronLeft, ChevronRight, FileText, ListTree, Plus, ScrollText } from "lucide-react";
import { editorExtensions } from "@/lib/editor/extensions";
import { SearchHighlight } from "@/lib/editor/search";
import { docToHtml } from "@/lib/doc/html";
import { docWords } from "@/lib/doc/text";
import { shortTitle } from "@/lib/doc/chapter-title";
import type { PMDoc } from "@/lib/doc/types";
import type { Chapter } from "@/lib/models/document";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* View mode: the whole document in one scroll, or one chapter at a time       */
/* -------------------------------------------------------------------------- */

export type DocView = "all" | "one";
const VIEW_KEY = "plr-editor-view";

/** The editor's view mode, remembered in this browser. The whole document is the default. */
export function useDocView(): [DocView, (v: DocView) => void] {
  const [view, setView] = React.useState<DocView>("all");
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "all" || v === "one") setView(v);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);
  const set = React.useCallback((v: DocView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not remembered — fine */
    }
  }, []);
  return [view, set];
}

/* -------------------------------------------------------------------------- */
/* Chapter title                                                               */
/* -------------------------------------------------------------------------- */

export function TitleInput({ value, onChange, onEnter, onFocus, placeholder, active = true, ariaLabel = "Chapter title" }: { value: string; onChange: (v: string) => void; onEnter: () => void; onFocus?: () => void; placeholder: string; active?: boolean; ariaLabel?: string }) {
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
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
      className="mb-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[1.75rem] font-bold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-[2rem]"
      aria-label={ariaLabel}
      data-testid={active ? "chapter-title" : "chapter-title-other"}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* One chapter's rich-text editor                                              */
/* -------------------------------------------------------------------------- */

export interface ChapterEditorCallbacks {
  onReady: (chapterId: string, editor: Editor) => void;
  onGone: (chapterId: string, editor: Editor) => void;
  onChange: (chapterId: string, editor: Editor) => void;
  onFocus: (chapterId: string) => void;
}

interface ChapterEditorProps extends ChapterEditorCallbacks {
  chapterId: string;
  content: PMDoc;
  editorKey: number;
  /** The chapter the toolbar, AI and find tools work on. Its editor is the one tests and tools call "doc-editor". */
  active: boolean;
  /** Part of the whole-document view: no tall minimum height, so chapters follow each other. */
  flow: boolean;
  placeholder: string;
  /** Put the cursor at this screen point once the editor is ready (a tap on the chapter before it was editable). */
  caret?: { x: number; y: number } | null;
  onCaretPlaced?: () => void;
}

function docClass(flow: boolean) {
  return flow ? "plr-doc plr-doc-flow" : "plr-doc plr-doc-page";
}

function editorAttributes(flow: boolean) {
  return { class: docClass(flow), spellcheck: "true" };
}

/**
 * The chapter as plain HTML, shown until its editor is ready so the page doesn't jump while editors
 * load. The `__html` object is memoised: React replaces the element's whole content whenever it gets a
 * new object, which on every save would rebuild every chapter that isn't being edited.
 */
const StaticDoc = React.memo(function StaticDoc({ content, flow, onActivate }: { content: PMDoc; flow: boolean; onActivate?: (x: number, y: number) => void }) {
  const inner = React.useMemo(() => ({ __html: docToHtml(content) }), [content]);
  const activate = React.useRef(onActivate);
  activate.current = onActivate;
  return (
    <div
      className={cn(docClass(flow), onActivate && "cursor-text")}
      // Links in the static copy must not navigate away; a tap means "edit here".
      onClickCapture={(e) => {
        e.preventDefault();
        activate.current?.(e.clientX, e.clientY);
      }}
      dangerouslySetInnerHTML={inner}
    />
  );
});

export const ChapterEditor = React.memo(function ChapterEditor(props: ChapterEditorProps) {
  const cb = React.useRef(props);
  cb.current = props;
  const { content, editorKey, active, flow, placeholder, caret } = props;
  const extensions = React.useMemo(() => [...editorExtensions({ placeholder }), SearchHighlight], [placeholder, editorKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const editor = useEditor(
    {
      extensions,
      content,
      immediatelyRender: false,
      editorProps: { attributes: editorAttributes(flow) },
      onUpdate: ({ editor: e }) => cb.current.onChange(cb.current.chapterId, e as Editor),
      onFocus: () => cb.current.onFocus(cb.current.chapterId),
    },
    [editorKey],
  );

  // Which chapter is active changes without re-creating its editor in the whole-document view. The
  // marker is set on the element directly: updating the editor's options would reset a selection
  // being made at that moment (for example a double-click on a word in another chapter).
  React.useEffect(() => {
    if (!editor) return;
    const mark = () => {
      if (editor.isDestroyed) return;
      try {
        editor.view.dom.setAttribute("data-testid", active ? "doc-editor" : "doc-editor-chapter");
      } catch {
        /* not on the page yet — done on mount */
      }
    };
    mark();
    editor.on("mount", mark);
    return () => {
      editor.off("mount", mark);
    };
  }, [editor, active]);

  React.useEffect(() => {
    if (!editor) return;
    cb.current.onReady(cb.current.chapterId, editor as Editor);
    return () => cb.current.onGone(cb.current.chapterId, editor as Editor);
  }, [editor]);

  React.useEffect(() => {
    if (!editor || !caret) return;
    const raf = requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      try {
        const hit = editor.view.posAtCoords({ left: caret.x, top: caret.y });
        if (hit) editor.commands.setTextSelection(hit.pos);
        editor.commands.focus(null, { scrollIntoView: false });
      } catch {
        /* the editor isn't on screen yet — leave the cursor where it is */
      }
      cb.current.onCaretPlaced?.();
    });
    return () => cancelAnimationFrame(raf);
  }, [editor, caret]);

  if (!editor) return <StaticDoc content={content} flow={flow} />;
  return <EditorContent editor={editor} />;
});

/* -------------------------------------------------------------------------- */
/* Chapter navigator: jump, previous / next, and the view switch               */
/* -------------------------------------------------------------------------- */

export function ChapterNavigator({ chapters, index, label, view, onView, onGo, onManage }: { chapters: Chapter[]; index: number; label: string; view: DocView; onView: (v: DocView) => void; onGo: (index: number) => void; onManage: () => void }) {
  const current = chapters[index];
  const lower = label.toLowerCase();
  const seg = "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors";
  return (
    <div className="no-print flex h-11 shrink-0 items-center gap-1 border-b bg-card px-2 sm:px-3" data-testid="chapter-nav">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-secondary" data-testid="chapter-picker" aria-label={`Jump to a ${lower}`}>
            <span className="shrink-0 rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary" data-testid="chapter-position">
              {index + 1} of {chapters.length}
            </span>
            <span className="min-w-0 truncate text-[13px] font-medium" data-testid="chapter-current" title={current?.title}>
              {shortTitle(current?.title ?? "")}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[min(22rem,calc(100vw-1.5rem))]">
          <DropdownMenuLabel>Jump to a {lower}</DropdownMenuLabel>
          {chapters.map((c, i) => (
            <DropdownMenuItem key={c.id} onSelect={() => onGo(i)} className={cn(i === index && "bg-secondary")} data-testid="chapter-picker-item">
              <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{c.title || "Untitled"}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{docWords(c.content).toLocaleString()} words</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onManage}>
            <ListTree /> Add, reorder or rename {lower}s
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="ghost" size="icon-sm" disabled={index <= 0} onClick={() => onGo(index - 1)} aria-label={`Previous ${lower}`} data-testid="chapter-prev">
        <ChevronLeft />
      </Button>
      <Button variant="ghost" size="icon-sm" disabled={index >= chapters.length - 1} onClick={() => onGo(index + 1)} aria-label={`Next ${lower}`} data-testid="chapter-next">
        <ChevronRight />
      </Button>
      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />
      <div role="group" aria-label="How to show the document" className="flex shrink-0 rounded-lg bg-secondary p-0.5">
        <button type="button" aria-pressed={view === "all"} title="Show every chapter in one scroll" onClick={() => onView("all")} className={cn(seg, view === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} data-testid="view-all">
          <ScrollText className="size-3.5" />
          <span className="sm:hidden">All</span>
          <span className="hidden sm:inline">Whole document</span>
        </button>
        <button type="button" aria-pressed={view === "one"} title={`Show one ${lower} at a time`} onClick={() => onView("one")} className={cn(seg, view === "one" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} data-testid="view-one">
          <FileText className="size-3.5" />
          <span className="sm:hidden">One</span>
          <span className="hidden sm:inline">One {lower}</span>
        </button>
      </div>
    </div>
  );
}

/** Previous / next links at the end of a chapter (one-chapter view). */
export function ChapterPager({ chapters, index, label, onGo, onShowAll }: { chapters: Chapter[]; index: number; label: string; onGo: (index: number) => void; onShowAll: () => void }) {
  const prev = chapters[index - 1];
  const next = chapters[index + 1];
  const lower = label.toLowerCase();
  const card = "min-w-0 rounded-xl border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-secondary";
  return (
    <nav className="no-print mt-10 grid grid-cols-2 gap-2 border-t pt-5 sm:gap-3" aria-label={`${label}s`}>
      {prev ? (
        <button type="button" className={cn(card, "text-left")} onClick={() => onGo(index - 1)} data-testid="pager-prev">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ChevronLeft className="size-3" /> Previous {lower}
          </span>
          <span className="block truncate text-sm font-medium">{shortTitle(prev.title)}</span>
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button type="button" className={cn(card, "text-right")} onClick={() => onGo(index + 1)} data-testid="pager-next">
          <span className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
            Next {lower} <ChevronRight className="size-3" />
          </span>
          <span className="block truncate text-sm font-medium">{shortTitle(next.title)}</span>
        </button>
      ) : chapters.length > 1 ? (
        <button type="button" className={cn(card, "text-right")} onClick={onShowAll} data-testid="pager-all">
          <span className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
            Last {lower} <ScrollText className="size-3" />
          </span>
          <span className="block truncate text-sm font-medium">Whole document</span>
        </button>
      ) : (
        <span />
      )}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Whole-document view                                                         */
/* -------------------------------------------------------------------------- */

interface WholeDocumentProps extends ChapterEditorCallbacks {
  chapters: Chapter[];
  activeId: string | null;
  label: string;
  editorKey: number;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  onTitle: (chapterId: string, title: string) => void;
  onTitleEnter: (chapterId: string) => void;
  onAdd: () => void;
}

function ChapterBlock({ chapter, index, total, active, props }: { chapter: Chapter; index: number; total: number; active: boolean; props: WholeDocumentProps }) {
  const { label, editorKey, scrollRoot } = props;
  const ref = React.useRef<HTMLElement>(null);
  // Editors are created as chapters come near the screen, so long documents open quickly.
  const [near, setNear] = React.useState(false);
  const [caret, setCaret] = React.useState<{ x: number; y: number } | null>(null);
  const clearCaret = React.useCallback(() => setCaret(null), []);
  React.useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { root: scrollRoot.current, rootMargin: "1500px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near, scrollRoot]);
  const mounted = near || active;
  const lower = label.toLowerCase();

  return (
    <article ref={ref} data-chapter-card={chapter.id} data-testid="doc-chapter" className={cn("rounded-2xl border bg-card px-5 py-8 shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition-colors sm:px-14 sm:py-12", active && "border-primary/30")}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        {label} {index + 1} of {total}
      </p>
      <TitleInput
        value={chapter.title}
        active={active}
        ariaLabel={`${label} ${index + 1} title`}
        onChange={(v) => props.onTitle(chapter.id, v)}
        onFocus={() => props.onFocus(chapter.id)}
        onEnter={() => props.onTitleEnter(chapter.id)}
        placeholder={`${label} title`}
      />
      {mounted ? (
        <ChapterEditor
          key={`${chapter.id}-${editorKey}`}
          chapterId={chapter.id}
          content={chapter.content}
          editorKey={editorKey}
          active={active}
          flow
          placeholder={`Write this ${lower}, or paste content…`}
          caret={caret}
          onCaretPlaced={clearCaret}
          onReady={props.onReady}
          onGone={props.onGone}
          onChange={props.onChange}
          onFocus={props.onFocus}
        />
      ) : (
        <StaticDoc
          content={chapter.content}
          flow
          onActivate={(x, y) => {
            setCaret({ x, y });
            setNear(true);
          }}
        />
      )}
    </article>
  );
}

export function WholeDocument(props: WholeDocumentProps) {
  const { chapters, activeId, label } = props;
  const words = chapters.reduce((n, c) => n + docWords(c.content), 0);
  return (
    <div className="mx-auto my-4 w-full max-w-[820px] space-y-4 px-2 sm:my-8 sm:space-y-6 sm:px-4" data-testid="whole-document">
      {chapters.map((c, i) => (
        <ChapterBlock key={c.id} chapter={c} index={i} total={chapters.length} active={c.id === activeId} props={props} />
      ))}
      <div className="no-print flex flex-col items-center gap-2 pb-[20vh] pt-2 text-center">
        <p className="text-xs text-muted-foreground">
          End of document · {chapters.length} {label.toLowerCase()}
          {chapters.length === 1 ? "" : "s"} · {words.toLocaleString()} words
        </p>
        <Button variant="outline" size="sm" onClick={props.onAdd} data-testid="add-chapter-end">
          <Plus /> Add a {label.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}
