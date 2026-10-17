import type { PMDoc, PMNode } from "./types";

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "taskItem",
  "codeBlock",
  "tableCell",
  "tableHeader",
  "callout",
  "horizontalRule",
]);

/** Plain text of a node; blocks are separated by newlines. */
export function nodeText(node: PMNode | null | undefined, blockSep = "\n"): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (!node.content?.length) return "";
  const parts = node.content.map((c) => nodeText(c, blockSep));
  if (node.type === "doc" || node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList" || node.type === "blockquote" || node.type === "callout" || node.type === "table" || node.type === "tableRow" || node.type === "listItem" || node.type === "taskItem") {
    return parts.filter((p) => p !== "").join(blockSep);
  }
  return parts.join("");
}

export function docText(doc: PMDoc | PMNode | null | undefined): string {
  return nodeText(doc ?? null, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function countWords(text: string): number {
  const m = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu);
  return m ? m.length : 0;
}

export function docWords(doc: PMDoc | PMNode | null | undefined): number {
  return countWords(nodeText(doc ?? null, " "));
}

export function docChars(doc: PMDoc | PMNode | null | undefined): number {
  return nodeText(doc ?? null, "").length;
}

/** Visit every node depth-first. Return false from the visitor to skip children. */
export function walk(node: PMNode, visit: (n: PMNode, parent: PMNode | null, depth: number) => void | boolean, parent: PMNode | null = null, depth = 0) {
  const r = visit(node, parent, depth);
  if (r === false) return;
  node.content?.forEach((c) => walk(c, visit, node, depth + 1));
}

export interface HeadingInfo {
  level: number;
  text: string;
  index: number; // top-level block index
}

export function docHeadings(doc: PMDoc): HeadingInfo[] {
  return (doc.content ?? [])
    .map((n, index) => ({ n, index }))
    .filter(({ n }) => n.type === "heading")
    .map(({ n, index }) => ({ level: Number(n.attrs?.level ?? 1), text: nodeText(n).trim(), index }));
}

/** First paragraph-ish sentences, used for summaries and templates. */
export function firstSentences(text: string, count = 2, maxChars = 320): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [clean];
  let out = sentences.slice(0, count).join("").trim();
  if (out.length > maxChars) out = out.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
  return out;
}

/** Collect list-item texts (bullet/ordered/task) in a doc. */
export function docListItems(doc: PMDoc): string[] {
  const out: string[] = [];
  walk(doc, (n) => {
    if (n.type === "listItem" || n.type === "taskItem") {
      const firstBlock = n.content?.[0];
      const t = nodeText(firstBlock ?? null).trim();
      if (t) out.push(t);
      return false;
    }
  });
  return out;
}

/** Paragraph texts at any depth (excluding list items and table cells). */
export function docParagraphs(doc: PMDoc): string[] {
  const out: string[] = [];
  walk(doc, (n) => {
    if (n.type === "listItem" || n.type === "taskItem" || n.type === "table") return false;
    if (n.type === "paragraph") {
      const t = nodeText(n).trim();
      if (t) out.push(t);
      return false;
    }
  });
  return out;
}

export function isBlock(type: string): boolean {
  return BLOCK_TYPES.has(type);
}

/** Estimated reading time in minutes at 230 wpm. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230));
}
