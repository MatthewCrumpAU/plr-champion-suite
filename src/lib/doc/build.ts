import type { PMDoc, PMMark, PMNode } from "./types";

/**
 * Small builder for TipTap JSON. Used by templates, builders, sample data and tests.
 * Inline text supports **bold**, *italic* and `code` markers.
 */

export function inline(text: string, extraMarks: PMMark[] = []): PMNode[] {
  const out: PMNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (t: string, marks: PMMark[]) => {
    if (!t) return;
    const node: PMNode = { type: "text", text: t };
    const all = [...extraMarks, ...marks];
    if (all.length) node.marks = all;
    out.push(node);
  };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index), []);
    const tok = m[0];
    if (tok.startsWith("**")) push(tok.slice(2, -2), [{ type: "bold" }]);
    else if (tok.startsWith("`")) push(tok.slice(1, -1), [{ type: "code" }]);
    else push(tok.slice(1, -1), [{ type: "italic" }]);
    last = m.index + tok.length;
  }
  push(text.slice(last), []);
  return out;
}

export const B = {
  doc(...content: (PMNode | PMNode[] | null | undefined | false)[]): PMDoc {
    const flat = content.flat().filter(Boolean) as PMNode[];
    return { type: "doc", content: flat.length ? flat : [{ type: "paragraph" }] };
  },
  p(text = ""): PMNode {
    const c = inline(text);
    return c.length ? { type: "paragraph", content: c } : { type: "paragraph" };
  },
  h(level: 1 | 2 | 3 | 4, text: string): PMNode {
    return { type: "heading", attrs: { level }, content: inline(text) };
  },
  ul(items: string[]): PMNode {
    return { type: "bulletList", content: items.map((t) => ({ type: "listItem", content: [B.p(t)] })) };
  },
  ol(items: string[]): PMNode {
    return { type: "orderedList", attrs: { start: 1 }, content: items.map((t) => ({ type: "listItem", content: [B.p(t)] })) };
  },
  tasks(items: string[], checked = false): PMNode {
    return { type: "taskList", content: items.map((t) => ({ type: "taskItem", attrs: { checked }, content: [B.p(t)] })) };
  },
  quote(text: string): PMNode {
    return { type: "blockquote", content: [B.p(text)] };
  },
  callout(variant: "tip" | "note" | "warning" | "example" | "summary" | "exercise", ...content: PMNode[]): PMNode {
    return { type: "callout", attrs: { variant }, content: content.length ? content : [B.p("")] };
  },
  lines(count = 3): PMNode {
    return { type: "writingLines", attrs: { count } };
  },
  hr(): PMNode {
    return { type: "horizontalRule" };
  },
  table(header: string[], rows: string[][]): PMNode {
    const cell = (type: "tableHeader" | "tableCell", t: string): PMNode => ({ type, attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [B.p(t)] });
    return {
      type: "table",
      content: [
        { type: "tableRow", content: header.map((h) => cell("tableHeader", h)) },
        ...rows.map((r) => ({ type: "tableRow", content: header.map((_, i) => cell("tableCell", r[i] ?? "")) })),
      ],
    };
  },
};
