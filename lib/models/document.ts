import { emptyDoc, normalizeDoc, type PMDoc } from "@/lib/doc/types";
import { uid } from "@/lib/utils";

export type ImportFormat = "docx" | "pdf" | "txt" | "md" | "html" | "paste" | "ai" | "template" | "outline" | "builder" | "sample";

export interface Chapter {
  id: string;
  title: string;
  content: PMDoc;
  notes: string;
  approved: boolean;
  /** For derived chapters: id of the chapter in `original` (or another document) it came from. */
  sourceChapterId: string | null;
}

export interface ImportSource {
  id: string;
  fileName: string;
  format: ImportFormat;
  fileId: string | null;
  fingerprint: string;
  importedAt: string;
  warnings: string[];
  wordCount: number;
  pageCount: number | null;
}

export interface ReplacementRule {
  id: string;
  find: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  enabled: boolean;
}

export type DocumentRole = "main" | "rebrand" | "product" | "bonus" | "lead-magnet" | "draft";

export const DOCUMENT_ROLE_LABELS: Record<DocumentRole, string> = {
  main: "Main product",
  rebrand: "Rebranded version",
  product: "Product",
  bonus: "Bonus",
  "lead-magnet": "Lead magnet",
  draft: "Draft",
};

export interface BuilderInfo {
  kind: "product" | "bonus" | "lead-magnet";
  format: string;
  sourceDocumentId: string | null;
  sourceChapterIds: string[];
  generatedWith: "template" | "ai";
  opportunityId: string | null;
}

export interface DocumentData {
  role: DocumentRole;
  format: string;
  subtitle: string;
  author: string;
  description: string;
  chapterLabel: string;
  chapters: Chapter[];
  /** Frozen copy of the content as originally imported (never edited). */
  original: { sources: ImportSource[]; chapters: Chapter[] } | null;
  rules: ReplacementRule[];
  notes: string;
  price: number | null;
  builder: BuilderInfo | null;
  /** Licence status reminder shown on export (mirrors the project's rights review). */
  exportCount: number;
}

export function newChapter(title = "Untitled chapter", content: PMDoc = emptyDoc(), sourceChapterId: string | null = null): Chapter {
  return { id: uid("ch"), title, content, notes: "", approved: false, sourceChapterId };
}

export function defaultDocumentData(partial: Partial<DocumentData> = {}): DocumentData {
  return {
    role: "main",
    format: "ebook",
    subtitle: "",
    author: "",
    description: "",
    chapterLabel: "Chapter",
    chapters: [newChapter("Chapter 1")],
    original: null,
    rules: [],
    notes: "",
    price: null,
    builder: null,
    exportCount: 0,
    ...partial,
  };
}

function normalizeChapter(c: Partial<Chapter> | undefined, i: number): Chapter {
  return {
    id: c?.id || uid("ch"),
    title: typeof c?.title === "string" ? c.title : `Chapter ${i + 1}`,
    content: normalizeDoc(c?.content),
    notes: typeof c?.notes === "string" ? c.notes : "",
    approved: !!c?.approved,
    sourceChapterId: c?.sourceChapterId ?? null,
  };
}

export function normalizeDocumentData(raw: unknown): DocumentData {
  const d = (raw ?? {}) as Partial<DocumentData>;
  const base = defaultDocumentData();
  const chapters = Array.isArray(d.chapters) && d.chapters.length ? d.chapters.map(normalizeChapter) : base.chapters;
  return {
    ...base,
    ...d,
    chapters,
    original: d.original
      ? { sources: Array.isArray(d.original.sources) ? d.original.sources : [], chapters: (d.original.chapters ?? []).map(normalizeChapter) }
      : null,
    rules: Array.isArray(d.rules) ? d.rules : [],
    builder: d.builder ?? null,
    exportCount: Number(d.exportCount ?? 0),
  };
}

export const CHAPTER_LABELS = ["Chapter", "Section", "Lesson", "Module", "Day", "Email", "Part", "Step", "Worksheet"] as const;
