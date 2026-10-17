import { docText, nodeText } from "./text";
import type { PMDoc, PMNode } from "./types";
import { B } from "./build";

export type SplitStrategy = "auto" | "h1" | "h2" | "h3" | "pattern" | "none";

export const SPLIT_STRATEGY_LABELS: Record<SplitStrategy, string> = {
  auto: "Automatic (recommended)",
  h1: "At every Heading 1",
  h2: "At every Heading 2",
  h3: "At every Heading 3",
  pattern: "At lines like “Chapter 1”, “Introduction”…",
  none: "Keep as one chapter",
};

export interface SplitChapter {
  title: string;
  content: PMDoc;
}

export interface SplitResult {
  documentTitle: string | null;
  chapters: SplitChapter[];
  strategyUsed: Exclude<SplitStrategy, "auto">;
}

const WORD_NUM = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty";
const CHAPTER_RE = new RegExp(`^(chapter|part|section|lesson|module|day|step|week|unit)\\s+(\\d{1,3}|[ivxlc]{1,6}|${WORD_NUM})\\b`, "i");
const STANDALONE_RE = /^(introduction|intro|conclusion|foreword|preface|prologue|epilogue|summary|final thoughts|resources|bonus|afterword|about the author|getting started|wrapping up|closing thoughts)\b[:.!\s-]*.{0,80}$/i;

export function isChapterLikeText(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 120) return false;
  return CHAPTER_RE.test(t) || STANDALONE_RE.test(t);
}

function headingLevel(n: PMNode): number | null {
  return n.type === "heading" ? Number(n.attrs?.level ?? 1) : null;
}

function isBoldOnlyParagraph(n: PMNode): boolean {
  if (n.type !== "paragraph" || !n.content?.length) return false;
  const text = nodeText(n).trim();
  if (!text || text.length > 110 || /[.!?,;:]$/.test(text.replace(/[:]$/, "")) && text.split(" ").length > 12) return false;
  return n.content.every((c) => c.type !== "text" || !c.text?.trim() || c.marks?.some((m) => m.type === "bold"));
}

/**
 * When a document has no real headings (common in DOCX/PDF/TXT PLR), promote short bold-only
 * or chapter-like paragraphs to headings so chapters and outlines can be detected.
 */
export function promotePseudoHeadings(doc: PMDoc): PMDoc {
  const hasHeadings = doc.content.some((n) => n.type === "heading");
  if (hasHeadings) return doc;
  const content = doc.content.map((n) => {
    if (n.type !== "paragraph") return n;
    const text = nodeText(n).trim();
    if (isChapterLikeText(text)) return { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] } as PMNode;
    if (isBoldOnlyParagraph(n)) return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] } as PMNode;
    return n;
  });
  return { ...doc, content };
}

function splitAt(doc: PMDoc, isBoundary: (n: PMNode) => boolean): SplitChapter[] {
  const chapters: SplitChapter[] = [];
  let current: { title: string; content: PMNode[] } | null = null;
  const pre: PMNode[] = [];
  for (const n of doc.content) {
    if (isBoundary(n)) {
      if (current) chapters.push({ title: current.title, content: B.doc(current.content) });
      current = { title: nodeText(n).trim() || "Untitled", content: [] };
    } else if (current) current.content.push(n);
    else pre.push(n);
  }
  if (current) chapters.push({ title: current.title, content: B.doc(current.content) });
  const preText = pre.map((n) => nodeText(n)).join(" ").trim();
  if (preText) chapters.unshift({ title: "Introduction", content: B.doc(pre) });
  return chapters;
}

function count(doc: PMDoc, pred: (n: PMNode) => boolean) {
  return doc.content.filter(pred).length;
}

export function splitIntoChapters(input: PMDoc, strategy: SplitStrategy = "auto"): SplitResult {
  let doc = input;
  let documentTitle: string | null = null;

  const h1 = count(doc, (n) => headingLevel(n) === 1);
  const h2 = count(doc, (n) => headingLevel(n) === 2);
  const h3 = count(doc, (n) => headingLevel(n) === 3);
  const pattern = count(doc, (n) => (n.type === "heading" || n.type === "paragraph") && isChapterLikeText(nodeText(n)));

  let used: Exclude<SplitStrategy, "auto"> = "none";
  if (strategy === "auto") {
    if (h1 >= 2) used = "h1";
    else if (h2 >= 2) used = "h2";
    else if (pattern >= 2) used = "pattern";
    else if (h3 >= 3) used = "h3";
    else used = "none";
  } else used = strategy;

  // A single H1 at the very top of a document split by H2/H3/pattern is the document title.
  if ((used === "h2" || used === "h3" || used === "pattern") && h1 === 1) {
    const idx = doc.content.findIndex((n) => headingLevel(n) === 1);
    const before = doc.content.slice(0, idx).map((n) => nodeText(n)).join("").trim();
    if (!before && !isChapterLikeText(nodeText(doc.content[idx]))) {
      documentTitle = nodeText(doc.content[idx]).trim();
      doc = { ...doc, content: doc.content.filter((_, i) => i !== idx) };
    }
  }

  let chapters: SplitChapter[];
  switch (used) {
    case "h1":
    case "h2":
    case "h3": {
      const lvl = Number(used.slice(1));
      chapters = splitAt(doc, (n) => headingLevel(n) === lvl);
      break;
    }
    case "pattern":
      chapters = splitAt(doc, (n) => (n.type === "heading" || n.type === "paragraph") && isChapterLikeText(nodeText(n)));
      break;
    default:
      chapters = [{ title: documentTitle ?? "Chapter 1", content: doc.content.length ? doc : B.doc() }];
  }

  // A leading heading with no content of its own (e.g. a Word "Title" styled as Heading 1) is the document title.
  if (used === "h1" && !documentTitle && chapters.length > 2 && !docText(chapters[0].content).trim() && !isChapterLikeText(chapters[0].title)) {
    documentTitle = chapters[0].title;
    chapters = chapters.slice(1);
  }
  if (!chapters.length) chapters = [{ title: "Chapter 1", content: B.doc() }];
  return { documentTitle, chapters, strategyUsed: used };
}

/** Merge `b` into `a`; b's title becomes a heading inside the merged content. */
export function mergeChapterContent(a: PMDoc, bTitle: string, b: PMDoc): PMDoc {
  const bContent = b.content.filter((n) => !(n.type === "paragraph" && !n.content?.length));
  return B.doc(a.content.filter((n) => !(n.type === "paragraph" && !n.content?.length)), B.h(2, bTitle || "Untitled"), bContent);
}

/** Split a chapter's content at a top-level block index. */
export function splitChapterContent(doc: PMDoc, index: number, fallbackTitle: string): { before: PMDoc; after: PMDoc; afterTitle: string } {
  const before = doc.content.slice(0, index);
  let after = doc.content.slice(index);
  let afterTitle = `${fallbackTitle} (part 2)`;
  if (after[0]?.type === "heading") {
    afterTitle = nodeText(after[0]).trim() || afterTitle;
    after = after.slice(1);
  }
  return { before: B.doc(before), after: B.doc(after), afterTitle };
}
