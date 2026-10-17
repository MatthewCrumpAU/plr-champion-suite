"use client";

import { escapeHtml } from "@/lib/utils";

/**
 * PDF text extraction with pdf.js. Rebuilds paragraphs and headings from text positions and font sizes,
 * removes running headers/footers and page numbers, and reports image-only (scanned) PDFs honestly.
 */

export interface PdfExtraction {
  html: string;
  pageCount: number;
  charCount: number;
  emptyPages: number[];
  imageBased: boolean;
  warnings: string[];
}

interface Line {
  text: string;
  size: number;
  y: number;
  bold: boolean;
  page: number;
  top: boolean;
  bottom: boolean;
}

interface RawItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL?: boolean;
}

// The "legacy" build bundles polyfills, so imports work in every current browser (Chrome, Safari, Firefox, Edge).
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as Promise<typeof import("pdfjs-dist")>).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const norm = (t: string) => t.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

export async function extractPdf(data: ArrayBuffer, onProgress?: (page: number, total: number) => void): Promise<PdfExtraction> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(data), disableFontFace: true, useSystemFonts: false });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password/i.test(msg)) throw new Error("This PDF is password-protected. Remove the password in a PDF tool and import it again.");
    throw new Error(`This PDF could not be read (${msg}).`);
  }

  const pageCount = pdf.numPages;
  const lines: Line[] = [];
  const emptyPages: number[] = [];
  let charCount = 0;

  for (let p = 1; p <= pageCount; p++) {
    onProgress?.(p, pageCount);
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const styles = (tc as unknown as { styles: Record<string, { fontFamily?: string }> }).styles ?? {};
    const items = (tc.items as RawItem[]).filter((i) => typeof i.str === "string");
    const pageChars = items.reduce((n, i) => n + i.str.trim().length, 0);
    charCount += pageChars;
    if (pageChars < 5) {
      emptyPages.push(p);
      page.cleanup();
      continue;
    }

    // Group items into lines by baseline.
    const rows: { y: number; items: RawItem[] }[] = [];
    for (const it of items) {
      if (!it.str) continue;
      const y = it.transform[5];
      const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
      const row = rows.find((r) => Math.abs(r.y - y) < Math.max(2, size * 0.35));
      if (row) row.items.push(it);
      else rows.push({ y, items: [it] });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.transform[4] - b.transform[4]);
      let text = "";
      let lastEnd: number | null = null;
      let maxSize = 0;
      let boldChars = 0;
      let totalChars = 0;
      for (const it of row.items) {
        const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
        maxSize = Math.max(maxSize, size);
        const x = it.transform[4];
        if (lastEnd !== null && x - lastEnd > size * 0.25 && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
        text += it.str;
        lastEnd = x + it.width;
        const fam = `${styles[it.fontName]?.fontFamily ?? ""} ${it.fontName}`;
        const len = it.str.trim().length;
        totalChars += len;
        if (/bold|black|heavy|semibold/i.test(fam)) boldChars += len;
      }
      const t = text.replace(/\s+/g, " ").trim();
      if (!t) continue;
      lines.push({
        text: t,
        size: Math.round(maxSize * 10) / 10,
        y: row.y,
        bold: totalChars > 0 && boldChars / totalChars > 0.6,
        page: p,
        top: row.y > viewport.height * 0.9,
        bottom: row.y < viewport.height * 0.08,
      });
    }
    page.cleanup();
  }
  await task.destroy();

  const warnings: string[] = [];
  const imageBased = pageCount > 0 && charCount < Math.max(40, pageCount * 25);
  if (imageBased) {
    warnings.push(
      "This PDF appears to be scanned or image-based: little or no text could be extracted. PLR Champion does not include OCR, so the text was not imported. Use the original DOCX/TXT version if your PLR package includes one, or run the PDF through an OCR tool first.",
    );
    return { html: "", pageCount, charCount, emptyPages, imageBased, warnings };
  }
  if (emptyPages.length) {
    warnings.push(`${emptyPages.length} page(s) had no extractable text (probably images or scans): ${emptyPages.slice(0, 12).join(", ")}${emptyPages.length > 12 ? "…" : ""}. Check those pages in the original file.`);
  }

  // Remove running headers/footers (same text at the top/bottom of many pages) and page numbers.
  const edgeCounts = new Map<string, Set<number>>();
  for (const l of lines) if (l.top || l.bottom) edgeCounts.set(norm(l.text), (edgeCounts.get(norm(l.text)) ?? new Set()).add(l.page));
  const textPages = pageCount - emptyPages.length;
  const repeated = new Set([...edgeCounts.entries()].filter(([, pages]) => textPages >= 3 && pages.size >= Math.max(2, textPages * 0.5)).map(([k]) => k));
  const isPageNumber = (t: string) => /^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(t.trim()) || /^[-–—]\s*\d{1,4}\s*[-–—]$/.test(t.trim());
  const body = lines.filter((l) => !((l.top || l.bottom) && (repeated.has(norm(l.text)) || isPageNumber(l.text))) && !(isPageNumber(l.text) && (l.top || l.bottom)));
  if (repeated.size) warnings.push("Repeating page headers/footers were removed.");

  const bodySize = median(body.map((l) => l.size)) || 11;
  // Typical spacing between consecutive body lines, and typical line length, adapt paragraph detection to each PDF.
  const gaps: number[] = [];
  for (let i = 1; i < body.length; i++) {
    const a = body[i - 1];
    const b = body[i];
    if (a.page === b.page && Math.abs(a.size - bodySize) < 1 && Math.abs(b.size - bodySize) < 1) {
      const g = a.y - b.y;
      if (g > 0 && g < bodySize * 4) gaps.push(g);
    }
  }
  const lineGap = median(gaps) || bodySize * 1.25;
  const typicalLen = median(body.filter((l) => Math.abs(l.size - bodySize) < 1).map((l) => l.text.length)) || 70;

  // Build blocks.
  type Block = { kind: "h1" | "h2" | "h3" | "p" | "li"; text: string };
  const blocks: Block[] = [];
  let para: string[] = [];
  let prev: Line | null = null;
  const flush = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ").replace(/\s+/g, " ").trim() });
      para = [];
    }
  };
  for (const l of body) {
    const ratio = l.size / bodySize;
    const short = l.text.length < 120;
    const headingKind: Block["kind"] | null = short && ratio >= 1.6 ? "h1" : short && ratio >= 1.25 ? "h2" : short && l.bold && l.text.length < 90 && !/[.,;]$/.test(l.text) ? "h3" : null;
    const bullet = /^([•●▪◦‣∙·*-]|\d{1,2}[.)])\s+/.exec(l.text);
    const gap = prev && prev.page === l.page ? prev.y - l.y : Infinity;
    let newBlock: boolean;
    if (!prev) newBlock = true;
    else if (prev.page !== l.page) {
      // A paragraph that did not end with punctuation continues on the next page.
      const lastText = para[para.length - 1];
      newBlock = !(lastText && !/[.!?:"”)]$/.test(lastText));
    } else {
      const prevText = para[para.length - 1] ?? prev.text;
      const endedEarly = /[.!?:"”)]$/.test(prevText) && prev.text.length < typicalLen * 0.7;
      newBlock = gap > lineGap * 1.45 || gap > Math.max(prev.size, l.size) * 2.6 || endedEarly;
    }

    if (headingKind) {
      flush();
      const last = blocks[blocks.length - 1];
      // Multi-line headings: join consecutive heading lines of the same kind.
      if (last && last.kind === headingKind && prev && prev.page === l.page && gap < l.size * 1.8) last.text += ` ${l.text}`;
      else blocks.push({ kind: headingKind, text: l.text });
    } else if (bullet) {
      flush();
      blocks.push({ kind: "li", text: l.text.slice(bullet[0].length).trim() });
    } else {
      const lastBlock = blocks[blocks.length - 1];
      if (!para.length && lastBlock?.kind === "li" && !newBlock) {
        lastBlock.text += ` ${l.text}`;
      } else {
        if (newBlock) flush();
        const last = para[para.length - 1];
        if (last && /[a-z]-$/.test(last) && /^[a-z]/.test(l.text)) para[para.length - 1] = last.slice(0, -1) + l.text;
        else para.push(l.text);
      }
    }
    prev = l;
  }
  flush();

  // Serialise to HTML, grouping list items.
  let html = "";
  let inList = false;
  for (const b of blocks) {
    if (b.kind === "li") {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li><p>${escapeHtml(b.text)}</p></li>`;
      continue;
    }
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    html += b.kind === "p" ? `<p>${escapeHtml(b.text)}</p>` : `<${b.kind}>${escapeHtml(b.text)}</${b.kind}>`;
  }
  if (inList) html += "</ul>";

  return { html, pageCount, charCount, emptyPages, imageBased: false, warnings };
}
