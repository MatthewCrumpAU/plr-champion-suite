"use client";

import DOMPurify from "dompurify";
import { generateJSON } from "@tiptap/core";
import { marked } from "marked";
import { schemaExtensions } from "@/lib/editor/extensions";
import { normalizeDoc, type PMDoc } from "./types";

/**
 * Browser-only conversions into the document schema. Every external HTML string is sanitised first:
 * scripts, styles, event handlers, iframes, forms and remote embeds are removed.
 */

const ALLOWED_TAGS = [
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "strike", "del", "ins", "mark", "sub", "sup", "code", "pre",
  "blockquote", "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "hr", "div", "span", "label", "input", "aside", "section", "article", "figure", "figcaption",
];
const ALLOWED_ATTR = ["href", "src", "alt", "title", "colspan", "rowspan", "start", "type", "checked", "data-type", "data-checked", "data-variant", "data-callout", "data-writing-lines", "data-count", "class", "style"];

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName === "style") {
      // Keep only text-align from inline styles.
      const m = /text-align\s*:\s*(left|right|center|justify)/i.exec(data.attrValue);
      data.attrValue = m ? `text-align:${m[1].toLowerCase()}` : "";
      if (!m) data.keepAttr = false;
    }
    if (data.attrName === "src" && node.nodeName === "IMG") {
      // Only embedded images: remote images would leak requests and break offline use.
      if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(data.attrValue)) data.keepAttr = false;
    }
    if (data.attrName === "href" && !/^(https?:|mailto:|#)/i.test(data.attrValue)) data.keepAttr = false;
  });
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "IMG" && !(node as Element).getAttribute("src")) node.parentNode?.removeChild(node);
  });
}

export function sanitizeHtml(html: string): string {
  ensureHooks();
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false, FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "svg", "math"], KEEP_CONTENT: true });
}

export function htmlToDoc(html: string, opts: { sanitize?: boolean } = {}): PMDoc {
  const clean = opts.sanitize === false ? html : sanitizeHtml(html);
  const json = generateJSON(clean, schemaExtensions());
  return normalizeDoc(json);
}

export function markdownToHtml(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
}

export function markdownToDoc(md: string): PMDoc {
  // Task list syntax "- [ ] item" → TipTap task list markup.
  const html = markdownToHtml(md)
    .replace(/<li>\s*<input[^>]*checked[^>]*>\s*/g, '<li data-type="taskItem" data-checked="true">')
    .replace(/<li>\s*<input[^>]*type="checkbox"[^>]*>\s*/g, '<li data-type="taskItem" data-checked="false">')
    .replace(/<ul>(\s*<li data-type="taskItem")/g, '<ul data-type="taskList">$1');
  return htmlToDoc(html);
}

/** Plain text → paragraphs (blank lines separate paragraphs; single newlines become line breaks). */
export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${esc(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
