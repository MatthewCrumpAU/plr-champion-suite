import type { AssetStatus } from "@/lib/data/types";
import type { Chapter } from "@/lib/models/document";
import type { DocMeta } from "./use-document";

/**
 * Unsaved-edit safety copy for the PLR Editor.
 *
 * Saves go to IndexedDB, which is asynchronous: when a tab is closed or reloaded within a moment of
 * typing, the browser can stop that write before it finishes. When the page is hidden or closed with
 * unsaved edits, the editor also writes a copy synchronously to localStorage. Next time the document
 * opens, the copy is used only if it is newer than what IndexedDB holds (so the save never landed);
 * otherwise it is discarded. Every completed save clears it.
 */

export interface RecoveryEntry {
  v: 1;
  assetId: string;
  /** When the copy was written (ms since epoch). */
  at: number;
  title: string;
  status: AssetStatus;
  chapters: Chapter[];
  meta: DocMeta | null;
}

const key = (assetId: string) => `plr-editor-unsaved:${assetId}`;

export function writeRecovery(entry: Omit<RecoveryEntry, "v" | "at">, now: number = Date.now()): boolean {
  try {
    localStorage.setItem(key(entry.assetId), JSON.stringify({ ...entry, v: 1, at: now } satisfies RecoveryEntry));
    return true;
  } catch {
    // Storage full or blocked (private mode): the normal save still runs.
    return false;
  }
}

export function readRecovery(assetId: string): RecoveryEntry | null {
  try {
    const raw = localStorage.getItem(key(assetId));
    if (!raw) return null;
    const e = JSON.parse(raw) as RecoveryEntry;
    return e && e.v === 1 && e.assetId === assetId && Array.isArray(e.chapters) && typeof e.at === "number" ? e : null;
  } catch {
    return null;
  }
}

export function clearRecovery(assetId: string) {
  try {
    localStorage.removeItem(key(assetId));
  } catch {
    /* ignore */
  }
}

/** Use the copy only when it was written after the stored document was last saved. */
export function shouldRestore(entry: RecoveryEntry | null, storedUpdatedAt: string): entry is RecoveryEntry {
  if (!entry) return false;
  const stored = Date.parse(storedUpdatedAt);
  return Number.isFinite(stored) && entry.at > stored;
}
