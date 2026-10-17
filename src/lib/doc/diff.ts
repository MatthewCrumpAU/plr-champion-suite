import { diffWords } from "diff";
import { escapeHtml } from "@/lib/utils";
import { countWords } from "./text";

export interface DiffPart {
  value: string;
  added: boolean;
  removed: boolean;
}

export interface DiffResult {
  parts: DiffPart[];
  addedWords: number;
  removedWords: number;
  unchangedWords: number;
  /** 0–100: share of words that differ between the two versions. */
  changePercent: number;
}

export function diffText(oldText: string, newText: string): DiffResult {
  const raw = diffWords(oldText, newText);
  const parts: DiffPart[] = raw.map((p) => ({ value: p.value, added: !!p.added, removed: !!p.removed }));
  let addedWords = 0;
  let removedWords = 0;
  let unchangedWords = 0;
  for (const p of parts) {
    const w = countWords(p.value);
    if (p.added) addedWords += w;
    else if (p.removed) removedWords += w;
    else unchangedWords += w;
  }
  const total = Math.max(1, unchangedWords + Math.max(addedWords, removedWords));
  const changePercent = Math.min(100, Math.round((Math.max(addedWords, removedWords) / total) * 100));
  return { parts, addedWords, removedWords, unchangedWords, changePercent };
}

function toHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

/** Inline (unified) diff HTML. */
export function diffToInlineHtml(parts: DiffPart[]): string {
  return parts
    .map((p) => (p.added ? `<ins class="plr-diff-added">${toHtml(p.value)}</ins>` : p.removed ? `<del class="plr-diff-removed">${toHtml(p.value)}</del>` : toHtml(p.value)))
    .join("");
}

/** Side-by-side HTML: original with removals highlighted, edited with additions highlighted. */
export function diffToSideBySide(parts: DiffPart[]): { left: string; right: string } {
  const left = parts.filter((p) => !p.added).map((p) => (p.removed ? `<del class="plr-diff-removed">${toHtml(p.value)}</del>` : toHtml(p.value))).join("");
  const right = parts.filter((p) => !p.removed).map((p) => (p.added ? `<ins class="plr-diff-added">${toHtml(p.value)}</ins>` : toHtml(p.value))).join("");
  return { left, right };
}
