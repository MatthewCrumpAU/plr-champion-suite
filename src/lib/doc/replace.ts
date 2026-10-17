import type { PMDoc, PMMark, PMNode } from "./types";

/** Find & replace on TipTap JSON, matching across adjacent text nodes inside a text block. */

export interface MatchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildMatcher(find: string, opts: MatchOptions = {}): RegExp | null {
  if (!find) return null;
  let src = opts.regex ? find : escapeRegExp(find);
  if (opts.wholeWord) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`;
  try {
    return new RegExp(src, `gu${opts.caseSensitive ? "" : "i"}`);
  } catch {
    return null;
  }
}

function isTextBlock(n: PMNode): boolean {
  return !!n.content && n.content.length > 0 && n.content.every((c) => c.type === "text" || c.type === "hardBreak" || c.type === "image");
}

/** Preserve capitalisation of the first letter when replacing case-insensitively ("Old" → "New"). */
function matchCase(found: string, replacement: string, caseSensitive: boolean): string {
  if (caseSensitive || !replacement) return replacement;
  if (found.toUpperCase() === found && found.toLowerCase() !== found && found.length > 1) return replacement.toUpperCase();
  const f = found.charAt(0);
  if (f && f === f.toUpperCase() && f !== f.toLowerCase()) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  return replacement;
}

interface Seg {
  text: string;
  marks?: PMMark[];
  other?: PMNode;
}

function replaceInTextBlock(node: PMNode, re: RegExp, replacement: string, caseSensitive: boolean): { node: PMNode; count: number } {
  const segs: Seg[] = (node.content ?? []).map((c) => (c.type === "text" ? { text: c.text ?? "", marks: c.marks } : { text: "￼", other: c }));
  const full = segs.map((s) => s.text).join("");
  re.lastIndex = 0;
  const matches: { start: number; end: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(full))) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    if (m[0].includes("￼")) continue;
    matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  if (!matches.length) return { node, count: 0 };

  // Map each character offset to its segment.
  const out: PMNode[] = [];
  const push = (text: string, marks?: PMMark[]) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === "text" && JSON.stringify(last.marks ?? []) === JSON.stringify(marks ?? [])) {
      last.text = (last.text ?? "") + text;
      return;
    }
    const n: PMNode = { type: "text", text };
    if (marks?.length) n.marks = marks;
    out.push(n);
  };

  let pos = 0;
  let mi = 0;
  let offset = 0;
  for (const seg of segs) {
    const segStart = offset;
    const segEnd = offset + seg.text.length;
    offset = segEnd;
    if (seg.other) {
      out.push(seg.other);
      pos = segEnd;
      continue;
    }
    let cursor = Math.max(pos, segStart);
    while (cursor < segEnd) {
      const match = matches[mi];
      if (!match || match.start >= segEnd) {
        push(seg.text.slice(cursor - segStart), seg.marks);
        cursor = segEnd;
        break;
      }
      if (cursor < match.start) {
        push(seg.text.slice(cursor - segStart, match.start - segStart), seg.marks);
        cursor = match.start;
      }
      if (cursor === match.start) {
        // Replacement takes the marks of the segment where the match begins.
        push(matchCase(match.text, replacement, caseSensitive), seg.marks);
      }
      const skipTo = Math.min(match.end, segEnd);
      cursor = skipTo;
      if (match.end <= segEnd) mi++;
    }
    pos = segEnd;
  }
  return { node: { ...node, content: out }, count: matches.length };
}

function walkReplace(node: PMNode, re: RegExp, replacement: string, caseSensitive: boolean): { node: PMNode; count: number } {
  if (isTextBlock(node)) return replaceInTextBlock(node, re, replacement, caseSensitive);
  if (!node.content) return { node, count: 0 };
  let total = 0;
  const content = node.content.map((c) => {
    const r = walkReplace(c, re, replacement, caseSensitive);
    total += r.count;
    return r.node;
  });
  return { node: total ? { ...node, content } : node, count: total };
}

export function replaceInDoc(doc: PMDoc, find: string, replacement: string, opts: MatchOptions = {}): { doc: PMDoc; count: number } {
  const re = buildMatcher(find, opts);
  if (!re) return { doc, count: 0 };
  const r = walkReplace(doc, re, replacement, !!opts.caseSensitive);
  // Drop paragraphs that became empty after removing a phrase, but keep at least one block.
  const cleaned = (r.node.content ?? []).filter((n, i, all) => !(r.count && n.type === "paragraph" && n.content && n.content.length === 0 && all.length > 1));
  return { doc: { ...(r.node as PMDoc), content: cleaned.length ? cleaned : [{ type: "paragraph" }] }, count: r.count };
}

export function replaceInText(text: string, find: string, replacement: string, opts: MatchOptions = {}): { text: string; count: number } {
  const re = buildMatcher(find, opts);
  if (!re) return { text, count: 0 };
  let count = 0;
  const out = text.replace(re, (m) => {
    count++;
    return matchCase(m, replacement, !!opts.caseSensitive);
  });
  return { text: out, count };
}

export function countMatches(doc: PMNode, find: string, opts: MatchOptions = {}): number {
  const re = buildMatcher(find, opts);
  if (!re) return 0;
  let n = 0;
  const visit = (node: PMNode) => {
    if (isTextBlock(node)) {
      const full = (node.content ?? []).map((c) => (c.type === "text" ? (c.text ?? "") : "￼")).join("");
      re.lastIndex = 0;
      const matches = full.match(re);
      n += matches ? matches.filter((x) => x.length > 0).length : 0;
      return;
    }
    node.content?.forEach(visit);
  };
  visit(doc);
  return n;
}

export interface RuleLike {
  find: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  enabled: boolean;
}

/** Applies replacement rules in order. */
export function applyRules(doc: PMDoc, rules: RuleLike[]): { doc: PMDoc; count: number } {
  let current = doc;
  let total = 0;
  for (const r of rules) {
    if (!r.enabled || !r.find) continue;
    const res = replaceInDoc(current, r.find, r.replace, { caseSensitive: r.caseSensitive, wholeWord: r.wholeWord });
    current = res.doc;
    total += res.count;
  }
  return { doc: current, count: total };
}

export function applyRulesToText(text: string, rules: RuleLike[]): { text: string; count: number } {
  let current = text;
  let total = 0;
  for (const r of rules) {
    if (!r.enabled || !r.find) continue;
    const res = replaceInText(current, r.find, r.replace, { caseSensitive: r.caseSensitive, wholeWord: r.wholeWord });
    current = res.text;
    total += res.count;
  }
  return { text: current, count: total };
}

/** Common filler phrases found in older PLR, offered as one-click removal rules. */
export const FILLER_PHRASES = [
  "In today's fast-paced world, ",
  "In today's day and age, ",
  "It goes without saying that ",
  "It goes without saying, ",
  "First and foremost, ",
  "At the end of the day, ",
  "Needless to say, ",
  "Without further ado, ",
  "As we all know, ",
  "It is important to note that ",
  "In this day and age, ",
  "Last but not least, ",
];
