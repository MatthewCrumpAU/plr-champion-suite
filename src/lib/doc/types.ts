/** Minimal TipTap/ProseMirror JSON types used throughout the suite (no DOM dependency). */

export interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  marks?: PMMark[];
  text?: string;
}

export interface PMDoc extends PMNode {
  type: "doc";
  content: PMNode[];
}

export function emptyDoc(): PMDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function isDoc(v: unknown): v is PMDoc {
  return !!v && typeof v === "object" && (v as PMNode).type === "doc" && Array.isArray((v as PMNode).content);
}

export function normalizeDoc(v: unknown): PMDoc {
  if (isDoc(v)) return v.content.length ? v : emptyDoc();
  return emptyDoc();
}
