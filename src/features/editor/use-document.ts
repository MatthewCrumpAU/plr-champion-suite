"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Asset, AssetStatus } from "@/lib/data/types";
import type { Chapter, DocumentData, ReplacementRule } from "@/lib/models/document";
import { newChapter } from "@/lib/models/document";
import { getAsset, updateAsset } from "@/lib/services/assets";
import { createVersion, dataSignature } from "@/lib/services/versions";
import { loadSettings } from "@/lib/services/settings";
import { deepClone, errorMessage, nowIso } from "@/lib/utils";
import { mergeChapterContent, splitChapterContent } from "@/lib/doc/chapters";
import type { PMDoc } from "@/lib/doc/types";
import type { SaveState } from "@/components/common/save-status";
import { clearRecovery, readRecovery, shouldRestore, writeRecovery } from "./recovery";

export type DocMeta = Omit<DocumentData, "chapters" | "original" | "builder" | "exportCount">;

/**
 * Owns the editable state of one document asset: chapters, metadata, autosave and auto-versions.
 * Editor content flows in through `setChapterContent`; everything else through explicit operations.
 */
export function useDocument(assetId: string) {
  const [asset, setAsset] = React.useState<Asset<"document"> | null>(null);
  const [missing, setMissing] = React.useState(false);
  const [title, setTitleState] = React.useState("");
  const [status, setStatusState] = React.useState<AssetStatus>("draft");
  const [chapters, setChaptersState] = React.useState<Chapter[]>([]);
  const [meta, setMetaState] = React.useState<DocMeta | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [editorKey, setEditorKey] = React.useState(0);
  const [recoveredAt, setRecoveredAt] = React.useState(0);

  const ref = React.useRef<{ title: string; status: AssetStatus; chapters: Chapter[]; meta: DocMeta | null; dirty: boolean; pending: boolean; saving: boolean; lastVersionAt: number; lastVersionSig: string; settings: { autosaveDelayMs: number; autoVersionMinutes: number } }>({ title: "", status: "draft", chapters: [], meta: null, dirty: false, pending: false, saving: false, lastVersionAt: 0, lastVersionSig: "", settings: { autosaveDelayMs: 800, autoVersionMinutes: 10 } });
  const assetRef = React.useRef<Asset<"document"> | null>(null);
  assetRef.current = asset;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load
  React.useEffect(() => {
    let active = true;
    (async () => {
      const [a, settings] = await Promise.all([getAsset<"document">(assetId), loadSettings().catch(() => null)]);
      if (!active) return;
      if (settings) ref.current.settings = { autosaveDelayMs: settings.autosaveDelayMs, autoVersionMinutes: settings.autoVersionMinutes };
      if (!a || a.type !== "document" || a.deletedAt) {
        setMissing(true);
        return;
      }
      setMissing(false);
      setAsset(a);
      setTitleState(a.title);
      setStatusState(a.status);
      setChaptersState(a.data.chapters);
      const { chapters: _c, original: _o, builder: _b, exportCount: _e, ...m } = a.data;
      setMetaState(m);
      ref.current.title = a.title;
      ref.current.status = a.status;
      ref.current.chapters = a.data.chapters;
      ref.current.meta = m;
      setActiveId((cur) => (cur && a.data.chapters.some((c) => c.id === cur) ? cur : (a.data.chapters[0]?.id ?? null)));
      setLastSavedAt(a.updatedAt);
      setSaveState("saved");
      ref.current.dirty = false;
      ref.current.lastVersionSig = dataSignature(a.data.chapters);
      ref.current.lastVersionAt = Date.now();
      // Edits made just before the tab closed whose save never reached the database.
      const rec = readRecovery(assetId);
      if (shouldRestore(rec, a.updatedAt)) {
        ref.current.title = rec.title;
        ref.current.status = rec.status;
        ref.current.chapters = rec.chapters;
        if (rec.meta) ref.current.meta = rec.meta;
        setTitleState(rec.title);
        setStatusState(rec.status);
        setChaptersState(rec.chapters);
        if (rec.meta) setMetaState(rec.meta);
        setActiveId((cur) => (cur && rec.chapters.some((c) => c.id === cur) ? cur : (rec.chapters[0]?.id ?? null)));
        ref.current.dirty = true;
        setSaveState("unsaved");
        setRecoveredAt(Date.now());
      } else if (rec) {
        clearRecovery(assetId);
      }
      setEditorKey((k) => k + 1);
    })();
    return () => {
      active = false;
    };
  }, [assetId, reloadToken]);

  const buildData = React.useCallback((): DocumentData | null => {
    const a = assetRef.current;
    const m = ref.current.meta;
    if (!a || !m) return null;
    return { ...a.data, ...m, chapters: ref.current.chapters };
  }, []);

  const inflight = React.useRef<Promise<void> | null>(null);
  const save = React.useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // Wait for a save that is already running so `await save()` always means "everything is stored".
    while (inflight.current) await inflight.current.catch(() => undefined);
    const data = buildData();
    const a = assetRef.current;
    if (!data || !a) return;
    if (!ref.current.dirty) return;
    let done!: () => void;
    inflight.current = new Promise<void>((r) => (done = r));
    ref.current.saving = true;
    ref.current.dirty = false;
    setSaveState("saving");
    try {
      const updated = await updateAsset<"document">(a.id, { title: ref.current.title.trim() || "Untitled document", status: ref.current.status, data: deepClone(data) });
      assetRef.current = updated;
      setAsset(updated);
      setLastSavedAt(updated.updatedAt);
      setSaveState(ref.current.dirty || ref.current.pending ? "unsaved" : "saved");
      if (!ref.current.dirty && !ref.current.pending) clearRecovery(a.id);
      // Automatic version every N minutes of editing.
      const mins = ref.current.settings.autoVersionMinutes;
      const sig = dataSignature(data.chapters);
      if (mins > 0 && Date.now() - ref.current.lastVersionAt > mins * 60_000 && sig !== ref.current.lastVersionSig) {
        ref.current.lastVersionAt = Date.now();
        ref.current.lastVersionSig = sig;
        await createVersion(updated, "Auto-save", "auto").catch(() => undefined);
      }
    } catch (err) {
      ref.current.dirty = true;
      setSaveState("error");
      toast.error(errorMessage(err));
    } finally {
      ref.current.saving = false;
      inflight.current = null;
      done();
    }
  }, [buildData]);

  const markDirty = React.useCallback(() => {
    ref.current.dirty = true;
    ref.current.pending = false;
    setSaveState((s) => (s === "saving" ? s : "unsaved"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), ref.current.settings.autosaveDelayMs);
  }, [save]);

  /** The editor has typed changes that have not been synced into state yet — show "Unsaved" straight away. */
  const notePending = React.useCallback(() => {
    if (ref.current.pending) return;
    ref.current.pending = true;
    setSaveState((s) => (s === "saving" ? s : "unsaved"));
  }, []);

  /** Synchronous safety copy of unsaved edits (see recovery.ts). Called when the page is hidden or closed. */
  const keepUnsavedCopy = React.useCallback(() => {
    const state = ref.current;
    if (!assetRef.current || !(state.dirty || state.saving)) return;
    writeRecovery({ assetId, title: state.title, status: state.status, chapters: state.chapters, meta: state.meta });
  }, [assetId]);

  // A restored copy is saved straight away.
  React.useEffect(() => {
    if (!recoveredAt) return;
    toast.info("Recovered changes you made just before the page closed.");
    void save();
  }, [recoveredAt, save]);

  // Flush on unmount and warn before closing with unsaved edits.
  React.useEffect(() => {
    const state = ref.current;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.dirty || state.saving) {
        keepUnsavedCopy();
        void save();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    // Leaving the tab or app (or closing the page) stores pending edits without waiting for the autosave delay.
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      keepUnsavedCopy();
      if (state.dirty) void save();
    };
    const onPageHide = () => {
      keepUnsavedCopy();
      if (state.dirty) void save();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      if (state.dirty) void save();
    };
  }, [save, keepUnsavedCopy]);

  /* ----------------------------- mutations ----------------------------- */
  const setChapters = React.useCallback(
    (fn: (prev: Chapter[]) => Chapter[]) => {
      const next = fn(ref.current.chapters);
      ref.current.chapters = next;
      setChaptersState(next);
      markDirty();
    },
    [markDirty],
  );

  const setChapterContent = React.useCallback(
    (id: string, content: PMDoc) => {
      setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, content } : c)));
    },
    [setChapters],
  );

  const updateChapter = React.useCallback((id: string, patch: Partial<Chapter>) => setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))), [setChapters]);

  const setTitle = React.useCallback(
    (t: string) => {
      setTitleState(t);
      ref.current.title = t;
      markDirty();
    },
    [markDirty],
  );

  const setStatus = React.useCallback(
    (s: AssetStatus) => {
      setStatusState(s);
      ref.current.status = s;
      markDirty();
    },
    [markDirty],
  );

  const setMeta = React.useCallback(
    (patch: Partial<DocMeta>) => {
      const m = ref.current.meta;
      const next = m ? { ...m, ...patch } : m;
      ref.current.meta = next;
      setMetaState(next);
      markDirty();
    },
    [markDirty],
  );

  const setRules = React.useCallback((rules: ReplacementRule[]) => setMeta({ rules }), [setMeta]);

  const chapterLabel = meta?.chapterLabel || "Chapter";

  const ops = React.useMemo(
    () => ({
      add(afterId?: string | null, title?: string, content?: PMDoc) {
        const ch = newChapter(title ?? `New ${chapterLabel.toLowerCase()}`, content);
        setChapters((prev) => {
          const idx = afterId ? prev.findIndex((c) => c.id === afterId) : prev.length - 1;
          const next = [...prev];
          next.splice(idx + 1, 0, ch);
          return next;
        });
        setActiveId(ch.id);
        setEditorKey((k) => k + 1);
        return ch;
      },
      rename(id: string, title: string) {
        updateChapter(id, { title });
      },
      duplicate(id: string) {
        const src = ref.current.chapters.find((c) => c.id === id);
        if (!src) return;
        const copy = { ...deepClone(src), ...newChapter(`${src.title} (copy)`, deepClone(src.content), src.sourceChapterId), notes: src.notes };
        setChapters((prev) => {
          const idx = prev.findIndex((c) => c.id === id);
          const next = [...prev];
          next.splice(idx + 1, 0, copy);
          return next;
        });
        setActiveId(copy.id);
        setEditorKey((k) => k + 1);
      },
      remove(id: string) {
        const list = ref.current.chapters;
        if (list.length <= 1) {
          toast.info(`A document needs at least one ${chapterLabel.toLowerCase()}.`);
          return;
        }
        const idx = list.findIndex((c) => c.id === id);
        setChapters((prev) => prev.filter((c) => c.id !== id));
        if (activeId === id) {
          const next = list[idx + 1] ?? list[idx - 1];
          setActiveId(next?.id ?? null);
          setEditorKey((k) => k + 1);
        }
      },
      reorder(fromId: string, toId: string) {
        setChapters((prev) => {
          const from = prev.findIndex((c) => c.id === fromId);
          const to = prev.findIndex((c) => c.id === toId);
          if (from < 0 || to < 0 || from === to) return prev;
          const next = [...prev];
          const [m] = next.splice(from, 1);
          next.splice(to, 0, m);
          return next;
        });
      },
      move(id: string, dir: -1 | 1) {
        setChapters((prev) => {
          const i = prev.findIndex((c) => c.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= prev.length) return prev;
          const next = [...prev];
          [next[i], next[j]] = [next[j], next[i]];
          return next;
        });
      },
      mergeNext(id: string) {
        const list = ref.current.chapters;
        const i = list.findIndex((c) => c.id === id);
        const b = list[i + 1];
        if (i < 0 || !b) {
          toast.info(`There is no following ${chapterLabel.toLowerCase()} to merge.`);
          return;
        }
        const a = list[i];
        setChapters((prev) => {
          const next = prev.filter((c) => c.id !== b.id).map((c) => (c.id === a.id ? { ...c, content: mergeChapterContent(a.content, b.title, b.content), notes: [a.notes, b.notes].filter(Boolean).join("\n\n") } : c));
          return next;
        });
        setActiveId(a.id);
        setEditorKey((k) => k + 1);
        toast.success(`Merged “${b.title}” into “${a.title}”`);
      },
      split(id: string, blockIndex: number) {
        const ch = ref.current.chapters.find((c) => c.id === id);
        if (!ch) return;
        if (blockIndex <= 0 || blockIndex >= ch.content.content.length) {
          toast.info(`Place your cursor in the paragraph or heading where the new ${chapterLabel.toLowerCase()} should start (not the first block).`);
          return;
        }
        const { before, after, afterTitle } = splitChapterContent(ch.content, blockIndex, ch.title);
        const created = newChapter(afterTitle, after, ch.sourceChapterId);
        setChapters((prev) => {
          const idx = prev.findIndex((c) => c.id === id);
          const next = [...prev];
          next.splice(idx, 1, { ...ch, content: before }, created);
          return next;
        });
        setActiveId(created.id);
        setEditorKey((k) => k + 1);
        toast.success(`Split into a new ${chapterLabel.toLowerCase()}: “${afterTitle}”`);
      },
      toggleApproved(id: string) {
        const c = ref.current.chapters.find((x) => x.id === id);
        if (c) updateChapter(id, { approved: !c.approved });
      },
      replaceAll(next: Chapter[]) {
        setChapters(() => next);
        setEditorKey((k) => k + 1);
        // Bulk changes (rebrand rules, AI rewrites, restores) are stored straight away, not after the autosave delay.
        void save();
      },
    }),
    [setChapters, updateChapter, chapterLabel, activeId, save],
  );

  const selectChapter = React.useCallback((id: string) => {
    setActiveId(id);
    setEditorKey((k) => k + 1);
  }, []);

  /** Snapshot the current state (after flushing pending edits). */
  const snapshot = React.useCallback(
    async (label: string, reason: Parameters<typeof createVersion>[2]) => {
      await save();
      const fresh = await getAsset<"document">(assetId);
      if (fresh) await createVersion(fresh, label, reason);
    },
    [assetId, save],
  );

  const reload = React.useCallback(() => setReloadToken((t) => t + 1), []);

  return {
    asset,
    missing,
    title,
    status,
    chapters,
    meta,
    activeId,
    activeChapter: chapters.find((c) => c.id === activeId) ?? null,
    activeIndex: chapters.findIndex((c) => c.id === activeId),
    chapterLabel,
    saveState,
    lastSavedAt,
    editorKey,
    setTitle,
    setStatus,
    setMeta,
    setRules,
    setChapterContent,
    updateChapter,
    selectChapter,
    notePending,
    ops,
    save,
    keepUnsavedCopy,
    snapshot,
    reload,
    buildData,
    getChapters: () => ref.current.chapters,
    touchedAt: lastSavedAt ?? nowIso(),
  };
}

export type DocumentController = ReturnType<typeof useDocument>;
