import { escapeHtml } from "@/lib/utils";
import type { PMMark, PMNode } from "./types";

/** Serialises TipTap JSON to clean HTML (no DOM required). Used for previews and exports. */

const CALLOUT_LABELS: Record<string, string> = { tip: "Tip", note: "Note", warning: "Warning", example: "Example", summary: "Summary", exercise: "Exercise" };

function safeUrl(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const h = href.trim();
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(h)) return h;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(h)) return h;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(h)) return `https://${h}`;
  return null;
}

function wrapMarks(text: string, marks: PMMark[] | undefined): string {
  let out = escapeHtml(text).replace(/\n/g, "<br>");
  if (!marks?.length) return out;
  // Apply in a stable order so nesting is valid.
  const order = ["code", "bold", "italic", "underline", "strike", "highlight", "subscript", "superscript", "textStyle", "link"];
  const sorted = [...marks].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const m of sorted) {
    switch (m.type) {
      case "bold":
        out = `<strong>${out}</strong>`;
        break;
      case "italic":
        out = `<em>${out}</em>`;
        break;
      case "underline":
        out = `<u>${out}</u>`;
        break;
      case "strike":
        out = `<s>${out}</s>`;
        break;
      case "code":
        out = `<code>${out}</code>`;
        break;
      case "highlight":
        out = `<mark>${out}</mark>`;
        break;
      case "subscript":
        out = `<sub>${out}</sub>`;
        break;
      case "superscript":
        out = `<sup>${out}</sup>`;
        break;
      case "link": {
        const href = safeUrl(m.attrs?.href);
        if (href) out = `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${out}</a>`;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function alignAttr(node: PMNode): string {
  const a = node.attrs?.textAlign;
  return typeof a === "string" && a !== "left" && ["center", "right", "justify"].includes(a) ? ` style="text-align:${a}"` : "";
}

function children(node: PMNode): string {
  return (node.content ?? []).map(nodeToHtml).join("");
}

export function nodeToHtml(node: PMNode): string {
  switch (node.type) {
    case "doc":
      return children(node);
    case "text":
      return wrapMarks(node.text ?? "", node.marks);
    case "paragraph":
      return `<p${alignAttr(node)}>${children(node)}</p>`;
    case "heading": {
      const lvl = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 2)));
      return `<h${lvl}${alignAttr(node)}>${children(node)}</h${lvl}>`;
    }
    case "bulletList":
      return `<ul>${children(node)}</ul>`;
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return `<ol${start !== 1 ? ` start="${start}"` : ""}>${children(node)}</ol>`;
    }
    case "listItem":
      return `<li>${children(node)}</li>`;
    case "taskList":
      return `<ul data-type="taskList" class="task-list">${children(node)}</ul>`;
    case "taskItem": {
      const checked = !!node.attrs?.checked;
      return `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox" disabled${checked ? " checked" : ""}></label><div>${children(node)}</div></li>`;
    }
    case "blockquote":
      return `<blockquote>${children(node)}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${escapeHtml((node.content ?? []).map((c) => c.text ?? "").join(""))}</code></pre>`;
    case "horizontalRule":
      return `<hr>`;
    case "hardBreak":
      return `<br>`;
    case "image": {
      const src = safeUrl(node.attrs?.src);
      if (!src) return "";
      const alt = escapeHtml(String(node.attrs?.alt ?? ""));
      return `<img src="${escapeHtml(src)}" alt="${alt}">`;
    }
    case "table":
      return `<table><tbody>${children(node)}</tbody></table>`;
    case "tableRow":
      return `<tr>${children(node)}</tr>`;
    case "tableHeader":
    case "tableCell": {
      const tag = node.type === "tableHeader" ? "th" : "td";
      const cs = Number(node.attrs?.colspan ?? 1);
      const rs = Number(node.attrs?.rowspan ?? 1);
      return `<${tag}${cs > 1 ? ` colspan="${cs}"` : ""}${rs > 1 ? ` rowspan="${rs}"` : ""}>${children(node)}</${tag}>`;
    }
    case "callout": {
      const v = String(node.attrs?.variant ?? "note");
      return `<div class="plr-callout" data-callout="" data-variant="${escapeHtml(v)}" data-label="${escapeHtml(CALLOUT_LABELS[v] ?? "Note")}">${children(node)}</div>`;
    }
    case "writingLines": {
      const count = Math.min(20, Math.max(1, Number(node.attrs?.count ?? 3)));
      return `<div class="plr-writing-lines" data-writing-lines="" data-count="${count}">${"<span></span>".repeat(count)}</div>`;
    }
    default:
      return children(node);
  }
}

export function docToHtml(doc: PMNode | null | undefined): string {
  return doc ? nodeToHtml(doc) : "";
}

/** Standard stylesheet for exported HTML and print previews. */
export function exportCss(opts: { headingFont?: string; bodyFont?: string; accent?: string } = {}): string {
  const accent = opts.accent ?? "#5b4df5";
  const body = opts.bodyFont ?? `Georgia, "Times New Roman", serif`;
  const heading = opts.headingFont ?? `"Helvetica Neue", Arial, sans-serif`;
  return `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f5f8; color: #1b1e2e; font-family: ${body}; font-size: 17px; line-height: 1.7; }
  .page { max-width: 780px; margin: 0 auto; background: #fff; padding: 64px 72px; }
  @media (max-width: 700px) { .page { padding: 32px 22px; } }
  h1, h2, h3, h4 { font-family: ${heading}; line-height: 1.25; color: #0f1222; }
  h1 { font-size: 2.1em; margin: 1.6em 0 0.6em; }
  h2 { font-size: 1.5em; margin: 1.5em 0 0.5em; }
  h3 { font-size: 1.2em; margin: 1.3em 0 0.4em; }
  p { margin: 0 0 1em; }
  a { color: ${accent}; }
  ul, ol { padding-left: 1.5em; margin: 0 0 1em; }
  li > p { margin: 0.2em 0; }
  blockquote { margin: 1.2em 0; padding: 0.3em 0 0.3em 1em; border-left: 3px solid ${accent}; color: #3d4257; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 1.2em 0; font-size: 0.95em; }
  th, td { border: 1px solid #d9dce5; padding: 0.5em 0.7em; text-align: left; vertical-align: top; }
  th { background: #f2f3f7; }
  td > p, th > p { margin: 0; }
  img { max-width: 100%; height: auto; }
  pre { background: #0f1222; color: #e7e9f2; padding: 1em; border-radius: 8px; overflow-x: auto; font-size: 0.85em; }
  code { font-family: Menlo, Consolas, monospace; font-size: 0.9em; }
  hr { border: 0; border-top: 1px solid #e3e5ec; margin: 2em 0; }
  mark { background: #fef08a; }
  ul.task-list { list-style: none; padding-left: 0.2em; }
  ul.task-list li { display: flex; gap: 0.6em; align-items: flex-start; }
  ul.task-list li > div { flex: 1; }
  .plr-callout { border: 1px solid #dcd8ff; background: #f5f4ff; border-radius: 12px; padding: 0.9em 1.1em; margin: 1.2em 0; }
  .plr-callout::before { content: attr(data-label); display: block; font-family: ${heading}; font-size: 0.7em; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.35em; color: ${accent}; }
  .plr-callout[data-variant="tip"] { background: #eefaf3; border-color: #c8ecd7; }
  .plr-callout[data-variant="warning"] { background: #fff7e8; border-color: #fbe2b5; }
  .plr-callout[data-variant="example"] { background: #eef7fd; border-color: #cde6f7; }
  .plr-callout[data-variant="exercise"] { background: #fdf2f8; border-color: #f7d4e8; }
  .plr-callout > :last-child { margin-bottom: 0; }
  .plr-writing-lines span { display: block; height: 2em; border-bottom: 1px solid #c9cdd8; }
  .title-page { text-align: center; padding: 3em 0 2em; border-bottom: 1px solid #e3e5ec; margin-bottom: 2em; }
  .title-page h1 { margin: 0; font-size: 2.6em; }
  .title-page .subtitle { font-size: 1.2em; color: #4b5068; margin-top: 0.6em; }
  .title-page .author { margin-top: 2em; font-family: ${heading}; letter-spacing: 0.05em; color: #646b80; }
  .chapter { break-before: page; }
  .chapter:first-of-type { break-before: auto; }
  @media print { body { background: #fff; } .page { padding: 0; max-width: none; } }
  `;
}
