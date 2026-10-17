"use client";

import * as React from "react";
import { toast } from "sonner";
import type { SaveState } from "@/components/common/save-status";
import { errorMessage } from "@/lib/utils";

/**
 * Local editable copy of a stored record with debounced autosave.
 * - `update` edits the copy and schedules a save.
 * - `flush` saves now (and waits for any save in progress) and returns the stored record.
 * - `adopt` replaces the copy with a record another operation just saved (e.g. after an upload).
 * Changes made elsewhere (another tab) are picked up only while there are no unsaved edits.
 */
export function useDraft<T extends { id: string; updatedAt: string }>(source: T | null | undefined, save: (t: T) => Promise<T>, delay = 600) {
  const [draft, setDraft] = React.useState<T | null>(source ?? null);
  const [state, setState] = React.useState<SaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(source?.updatedAt ?? null);
  const ref = React.useRef<T | null>(draft);
  const dirty = React.useRef(false);
  const inflight = React.useRef<Promise<void> | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = React.useRef(save);
  saveRef.current = save;

  React.useEffect(() => {
    if (!source || dirty.current || inflight.current) return;
    if (ref.current && ref.current.id === source.id && ref.current.updatedAt === source.updatedAt) return;
    ref.current = source;
    setDraft(source);
    setLastSavedAt(source.updatedAt);
  }, [source]);

  const flush = React.useCallback(async (): Promise<T | null> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    while (inflight.current) await inflight.current;
    if (!dirty.current || !ref.current) return ref.current;
    dirty.current = false;
    setState("saving");
    let done!: () => void;
    inflight.current = new Promise<void>((r) => (done = r));
    try {
      const saved = await saveRef.current(ref.current);
      if (!dirty.current) {
        ref.current = saved;
        setDraft(saved);
      } else {
        // Typing continued during the save: keep the newer text, take the stored timestamps.
        ref.current = { ...ref.current, updatedAt: saved.updatedAt, slug: (saved as { slug?: string }).slug ?? (ref.current as { slug?: string }).slug } as T;
      }
      setLastSavedAt(saved.updatedAt);
      setState(dirty.current ? "unsaved" : "saved");
      return saved;
    } catch (e) {
      dirty.current = true;
      setState("error");
      toast.error(`Couldn't save: ${errorMessage(e)}`);
      return null;
    } finally {
      inflight.current = null;
      done();
    }
  }, []);

  const update = React.useCallback(
    (patch: Partial<T> | ((d: T) => T)) => {
      const cur = ref.current;
      if (!cur) return;
      const next = typeof patch === "function" ? patch(cur) : { ...cur, ...patch };
      ref.current = next;
      setDraft(next);
      dirty.current = true;
      setState("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  const adopt = React.useCallback((t: T) => {
    ref.current = t;
    dirty.current = false;
    setDraft(t);
    setLastSavedAt(t.updatedAt);
    setState("saved");
  }, []);

  // Save anything pending when the editor closes.
  React.useEffect(
    () => () => {
      if (dirty.current) void flush();
    },
    [flush],
  );

  return { draft, update, flush, adopt, state, lastSavedAt };
}
