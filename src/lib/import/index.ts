"use client";

import { escapeHtml, sha256Hex } from "@/lib/utils";
import { htmlToDoc, markdownToHtml, sanitizeHtml } from "@/lib/doc/parse";
import { isChapterLikeText, promotePseudoHeadings } from "@/lib/doc/chapters";
import { docWords } from "@/lib/doc/text";
import type { PMDoc } from "@/lib/doc/types";
import type { ImportFormat } from "@/lib/models/document";
import { MAX_IMPORT_BYTES } from "@/lib/services/files";

export interface ImportResult {
  fileName: string;
  format: ImportFormat;
  doc: PMDoc;
  wordCount: number;
  pageCount: number | null;
  warnings: string[];
  /** True when no usable text could be extracted (e.g. scanned PDF). */
  empty: boolean;
  fingerprint: string;
  blob: Blob;
  documentTitle: string | null;
}

export const ACCEPTED_IMPORT = ".docx,.pdf,.txt,.md,.markdown,.html,.htm";
export const ACCEPTED_LABEL = "DOCX, PDF, TXT, Markdown or HTML";

export function detectFormat(fileName: string, mime: string): ImportFormat | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "html" || ext === "htm" || mime === "text/html") return "html";
  if (ext === "txt" || mime === "text/plain") return "txt";
  if (ext === "doc") return null;
  return null;
}

/** Plain text → HTML with heading/list detection suited to PLR text files. */
export function plainTextToHtml(text: string): string {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .split(/\n\s*\n/)
    .map((b) => b.replace(/[  ]+$/gm, ""))
    .filter((b) => b.trim());
  let html = "";
  for (const block of blocks) {
    const ls = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const bullets = ls.every((l) => /^([•●▪*-]|\d{1,2}[.)])\s+/.test(l));
    if (bullets && ls.length) {
      const ordered = ls.every((l) => /^\d{1,2}[.)]\s+/.test(l));
      html += `<${ordered ? "ol" : "ul"}>${ls.map((l) => `<li><p>${escapeHtml(l.replace(/^([•●▪*-]|\d{1,2}[.)])\s+/, ""))}</p></li>`).join("")}</${ordered ? "ol" : "ul"}>`;
      continue;
    }
    if (ls.length === 1) {
      const t = ls[0];
      const letters = t.replace(/[^A-Za-z]/g, "");
      const allCaps = letters.length >= 3 && letters === letters.toUpperCase() && t.split(/\s+/).length <= 12;
      if (isChapterLikeText(t)) {
        html += `<h1>${escapeHtml(t)}</h1>`;
        continue;
      }
      if (allCaps || (t.length < 70 && !/[.!?,;:]$/.test(t) && t.split(/\s+/).length <= 10)) {
        html += `<h2>${escapeHtml(allCaps ? t.charAt(0) + t.slice(1).toLowerCase() : t)}</h2>`;
        continue;
      }
    }
    html += `<p>${escapeHtml(ls.join(" "))}</p>`;
  }
  return html;
}

async function readDocx(buf: ArrayBuffer): Promise<{ html: string; warnings: string[] }> {
  const mammoth = (await import("mammoth")).default;
  const warnings: string[] = [];
  let skippedImages = 0;
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buf },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Intense Quote'] => blockquote:fresh",
        "p[style-name='List Paragraph'] => p:fresh",
      ],
      convertImage: mammoth.images.imgElement(async (image) => {
        const b64 = await image.read("base64");
        if (b64.length > 2_800_000) {
          skippedImages++;
          return { src: "" };
        }
        return { src: `data:${image.contentType};base64,${b64}` };
      }),
    },
  );
  const msgs = [...new Set(result.messages.filter((m) => m.type === "warning").map((m) => m.message))];
  if (msgs.length) warnings.push(`Some Word formatting could not be converted exactly (${msgs.length} note${msgs.length === 1 ? "" : "s"}). Text content was preserved.`);
  if (skippedImages) warnings.push(`${skippedImages} large image(s) over 2 MB were not embedded. Add them back with Insert → Image if needed.`);
  return { html: result.value, warnings };
}

/**
 * Reads a file into the document schema. Nothing is saved here — the caller shows a preview first.
 */
export async function importFile(file: File, onProgress?: (msg: string) => void): Promise<ImportResult> {
  const format = detectFormat(file.name, file.type);
  if (!format) {
    if (file.name.toLowerCase().endsWith(".doc")) throw new Error("Old Word .doc files are not supported. Open it in Word or Google Docs and save as .docx, then import again.");
    throw new Error(`Unsupported file type. Import a ${ACCEPTED_LABEL} file.`);
  }
  if (file.size > MAX_IMPORT_BYTES) throw new Error("This file is larger than 60 MB. Split it or compress embedded images first.");
  if (file.size === 0) throw new Error("This file is empty.");

  const buf = await file.arrayBuffer();
  const fingerprint = await sha256Hex(buf);
  const warnings: string[] = [];
  let html = "";
  let pageCount: number | null = null;

  onProgress?.("Reading file…");
  if (format === "docx") {
    try {
      const r = await readDocx(buf);
      html = r.html;
      warnings.push(...r.warnings);
    } catch {
      throw new Error("This DOCX file could not be read. It may be damaged or not a real Word document.");
    }
  } else if (format === "pdf") {
    const { extractPdf } = await import("./pdf");
    const r = await extractPdf(buf, (p, t) => onProgress?.(`Extracting page ${p} of ${t}…`));
    html = r.html;
    pageCount = r.pageCount;
    warnings.push(...r.warnings);
  } else {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    if (format === "md") html = markdownToHtml(text);
    else if (format === "html") {
      const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(text);
      html = bodyMatch ? bodyMatch[1] : text;
      if (/<script|on\w+=|<iframe|javascript:/i.test(html)) warnings.push("Scripts, embedded frames and event handlers were removed from the HTML for safety.");
    } else html = plainTextToHtml(text);
  }

  onProgress?.("Converting…");
  const sanitized = sanitizeHtml(html);
  let doc = htmlToDoc(sanitized, { sanitize: false });
  if (format !== "md" && format !== "html") doc = promotePseudoHeadings(doc);
  const wordCount = docWords(doc);
  const empty = wordCount === 0;
  if (empty && !warnings.length) warnings.push("No text was found in this file.");

  return { fileName: file.name, format, doc, wordCount, pageCount, warnings, empty, fingerprint, blob: file, documentTitle: null };
}
