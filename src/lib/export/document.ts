"use client";

import { docToHtml, exportCss } from "@/lib/doc/html";
import { docToMarkdown, docToPlainText } from "@/lib/doc/markdown";
import { nodeText } from "@/lib/doc/text";
import type { PMDoc, PMNode } from "@/lib/doc/types";
import { escapeHtml } from "@/lib/utils";
import { htmlPage, safeFileName, textFile, type ExportFile } from "./download";

export type DocExportFormat = "docx" | "pdf" | "html" | "md" | "txt";

export const DOC_EXPORT_LABELS: Record<DocExportFormat, string> = {
  docx: "Word (.docx)",
  pdf: "PDF (.pdf)",
  html: "Web page (.html)",
  md: "Markdown (.md)",
  txt: "Plain text (.txt)",
};

export interface ExportableDocument {
  title: string;
  subtitle?: string;
  author?: string;
  chapters: { title: string; content: PMDoc }[];
}

export interface DocExportOptions {
  titlePage: boolean;
  toc: boolean;
  pageBreaks: boolean;
  pageSize: "A4" | "LETTER";
  accent: string;
}

export const DEFAULT_DOC_EXPORT: DocExportOptions = { titlePage: true, toc: true, pageBreaks: true, pageSize: "A4", accent: "#5b4df5" };

/* ------------------------------------------------------------------ */
/* HTML / Markdown / Text                                               */
/* ------------------------------------------------------------------ */
export function documentToHtml(doc: ExportableDocument, opts: DocExportOptions = DEFAULT_DOC_EXPORT): string {
  let body = `<div class="page">`;
  if (opts.titlePage) {
    body += `<header class="title-page"><h1>${escapeHtml(doc.title)}</h1>${doc.subtitle ? `<p class="subtitle">${escapeHtml(doc.subtitle)}</p>` : ""}${doc.author ? `<p class="author">${escapeHtml(doc.author)}</p>` : ""}</header>`;
  }
  if (opts.toc && doc.chapters.length > 1) {
    body += `<nav class="toc"><h2>Contents</h2><ol>${doc.chapters.map((c, i) => `<li><a href="#chapter-${i + 1}">${escapeHtml(c.title)}</a></li>`).join("")}</ol></nav>`;
  }
  doc.chapters.forEach((c, i) => {
    body += `<section class="chapter" id="chapter-${i + 1}"><h1>${escapeHtml(c.title)}</h1>${docToHtml(c.content)}</section>`;
  });
  body += `</div>`;
  return htmlPage(doc.title, body, exportCss({ accent: opts.accent }) + `.toc ol{line-height:2}.toc a{text-decoration:none}`);
}

export function documentToMarkdown(doc: ExportableDocument, opts: DocExportOptions = DEFAULT_DOC_EXPORT): string {
  const parts: string[] = [];
  if (opts.titlePage) {
    parts.push(`# ${doc.title}`);
    if (doc.subtitle) parts.push(`*${doc.subtitle}*`);
    if (doc.author) parts.push(`By ${doc.author}`);
  }
  if (opts.toc && doc.chapters.length > 1) parts.push(`## Contents\n\n${doc.chapters.map((c, i) => `${i + 1}. ${c.title}`).join("\n")}`);
  for (const c of doc.chapters) parts.push(`${opts.titlePage ? "##" : "#"} ${c.title}\n\n${docToMarkdown(c.content)}`);
  return parts.join("\n\n") + "\n";
}

export function documentToText(doc: ExportableDocument, opts: DocExportOptions = DEFAULT_DOC_EXPORT): string {
  const parts: string[] = [];
  if (opts.titlePage) parts.push([doc.title.toUpperCase(), doc.subtitle, doc.author ? `By ${doc.author}` : ""].filter(Boolean).join("\n"));
  for (const c of doc.chapters) parts.push(`${c.title.toUpperCase()}\n${"=".repeat(Math.min(60, c.title.length))}\n\n${docToPlainText(c.content)}`);
  return parts.join("\n\n\n") + "\n";
}

/* ------------------------------------------------------------------ */
/* Images                                                               */
/* ------------------------------------------------------------------ */
interface ImgInfo {
  data: Uint8Array;
  type: "png" | "jpg" | "gif" | "bmp";
  width: number;
  height: number;
  dataUrl: string;
}

function parseDataUrl(src: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(src);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: m[1].toLowerCase(), bytes };
}

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = src;
  });
}

async function collectImages(doc: ExportableDocument): Promise<Map<string, ImgInfo>> {
  const map = new Map<string, ImgInfo>();
  const visit = async (n: PMNode) => {
    if (n.type === "image" && typeof n.attrs?.src === "string" && !map.has(n.attrs.src)) {
      const parsed = parseDataUrl(n.attrs.src);
      if (parsed) {
        const type = parsed.mime.includes("png") ? "png" : parsed.mime.includes("jpeg") || parsed.mime.includes("jpg") ? "jpg" : parsed.mime.includes("gif") ? "gif" : parsed.mime.includes("bmp") ? "bmp" : null;
        if (type) {
          const { w, h } = await imageSize(n.attrs.src);
          const scale = Math.min(1, 560 / w);
          map.set(n.attrs.src, { data: parsed.bytes, type, width: Math.round(w * scale), height: Math.round(h * scale), dataUrl: n.attrs.src });
        }
      }
    }
    for (const c of n.content ?? []) await visit(c);
  };
  for (const c of doc.chapters) await visit(c.content);
  return map;
}

/* ------------------------------------------------------------------ */
/* DOCX                                                                 */
/* ------------------------------------------------------------------ */
export async function documentToDocx(doc: ExportableDocument, opts: DocExportOptions = DEFAULT_DOC_EXPORT): Promise<Blob> {
  const d = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, ImageRun, ExternalHyperlink, Footer, PageNumber, LevelFormat } = d;
  const images = await collectImages(doc);
  const accentHex = opts.accent.replace("#", "").toUpperCase();
  let listInstance = 0;

  type Run = InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink> | InstanceType<typeof ImageRun>;
  type Block = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;

  const alignment = (n: PMNode) => {
    const a = n.attrs?.textAlign;
    return a === "center" ? AlignmentType.CENTER : a === "right" ? AlignmentType.RIGHT : a === "justify" ? AlignmentType.JUSTIFIED : undefined;
  };

  const runs = (nodes: PMNode[] | undefined, base: { italics?: boolean; font?: string } = {}): Run[] => {
    const out: Run[] = [];
    for (const n of nodes ?? []) {
      if (n.type === "hardBreak") {
        out.push(new TextRun({ text: "", break: 1 }));
        continue;
      }
      if (n.type === "image") {
        const img = images.get(String(n.attrs?.src ?? ""));
        if (img) out.push(new ImageRun({ type: img.type, data: img.data, transformation: { width: img.width, height: img.height } }));
        continue;
      }
      if (n.type !== "text") continue;
      const marks = n.marks ?? [];
      const has = (t: string) => marks.some((m) => m.type === t);
      const link = marks.find((m) => m.type === "link");
      const run = new TextRun({
        text: n.text ?? "",
        bold: has("bold") || undefined,
        italics: has("italic") || base.italics || undefined,
        underline: has("underline") || link ? {} : undefined,
        strike: has("strike") || undefined,
        highlight: has("highlight") ? "yellow" : undefined,
        font: has("code") ? "Courier New" : base.font,
        color: link ? accentHex : undefined,
      });
      if (link && typeof link.attrs?.href === "string" && /^(https?:|mailto:)/i.test(link.attrs.href)) out.push(new ExternalHyperlink({ link: link.attrs.href, children: [run] }));
      else out.push(run);
    }
    return out;
  };

  const blocks = (n: PMNode, ctx: { level?: number; listRef?: string; instance?: number; shading?: string; indent?: number; italics?: boolean } = {}): Block[] => {
    const shading = ctx.shading ? { type: ShadingType.CLEAR, color: "auto", fill: ctx.shading } : undefined;
    const indent = ctx.indent ? { left: ctx.indent } : undefined;
    switch (n.type) {
      case "paragraph":
        return [new Paragraph({ children: runs(n.content, { italics: ctx.italics }), alignment: alignment(n), shading, indent, spacing: { after: 140 } })];
      case "heading": {
        const lvl = Number(n.attrs?.level ?? 2);
        const heading = lvl <= 1 ? HeadingLevel.HEADING_2 : lvl === 2 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4;
        return [new Paragraph({ heading, children: runs(n.content), alignment: alignment(n), shading })];
      }
      case "bulletList":
      case "orderedList":
      case "taskList": {
        const level = ctx.level === undefined ? 0 : ctx.level + 1;
        const ordered = n.type === "orderedList";
        const instance = ordered && level === 0 ? ++listInstance : ctx.instance;
        const out: Block[] = [];
        for (const li of n.content ?? []) {
          const [first, ...rest] = li.content ?? [];
          const prefix = n.type === "taskList" ? (li.attrs?.checked ? "☒ " : "☐ ") : "";
          const firstRuns = first ? runs(first.content) : [];
          if (prefix) firstRuns.unshift(new TextRun({ text: prefix }));
          out.push(
            new Paragraph({
              children: firstRuns,
              numbering: n.type === "taskList" ? undefined : { reference: ordered ? "numbered" : "bullets", level: Math.min(level, 4), instance: ordered ? instance : undefined },
              indent: n.type === "taskList" ? { left: 360 * (level + 1) } : undefined,
              shading,
              spacing: { after: 60 },
            }),
          );
          for (const r of rest) out.push(...blocks(r, { ...ctx, level, instance }));
        }
        return out;
      }
      case "blockquote":
        return (n.content ?? []).flatMap((c) => blocks(c, { ...ctx, indent: 600, italics: true }));
      case "callout": {
        const fills: Record<string, string> = { tip: "EEFAF3", note: "F1F0FF", warning: "FFF7E8", example: "EEF7FD", summary: "F6F6F8", exercise: "FDF2F8" };
        const variant = String(n.attrs?.variant ?? "note");
        const fill = fills[variant] ?? "F1F0FF";
        return [
          new Paragraph({ children: [new TextRun({ text: variant.toUpperCase(), bold: true, size: 16, color: accentHex })], shading: { type: ShadingType.CLEAR, color: "auto", fill }, spacing: { before: 120, after: 40 }, indent: { left: 200, right: 200 } }),
          ...(n.content ?? []).flatMap((c) => blocks(c, { ...ctx, shading: fill, indent: 200 })),
        ];
      }
      case "codeBlock":
        return [new Paragraph({ children: [new TextRun({ text: nodeText(n), font: "Courier New", size: 18 })], shading: { type: ShadingType.CLEAR, color: "auto", fill: "F2F3F7" } })];
      case "horizontalRule":
        return [new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D9DCE5", space: 4 } } })];
      case "writingLines": {
        const count = Math.min(20, Math.max(1, Number(n.attrs?.count ?? 3)));
        return Array.from({ length: count }, () => new Paragraph({ children: [], spacing: { before: 280 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "C9CDD8", space: 1 } } }));
      }
      case "image": {
        const r = runs([n]);
        return r.length ? [new Paragraph({ children: r, alignment: AlignmentType.CENTER })] : [];
      }
      case "table": {
        const rows = (n.content ?? []).map(
          (row) =>
            new TableRow({
              children: (row.content ?? []).map(
                (cell) =>
                  new TableCell({
                    children: (cell.content ?? []).flatMap((b) => blocks(b, {})).filter((b): b is InstanceType<typeof Paragraph> => b instanceof Paragraph).concat([]) as InstanceType<typeof Paragraph>[],
                    shading: cell.type === "tableHeader" ? { type: ShadingType.CLEAR, color: "auto", fill: "F2F3F7" } : undefined,
                    columnSpan: Number(cell.attrs?.colspan ?? 1) > 1 ? Number(cell.attrs?.colspan) : undefined,
                  }),
              ),
            }),
        );
        if (!rows.length) return [];
        return [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }), new Paragraph({ children: [] })];
      }
      default:
        return (n.content ?? []).flatMap((c) => blocks(c, ctx));
    }
  };

  const children: Block[] = [];
  if (opts.titlePage) {
    children.push(new Paragraph({ children: [], spacing: { before: 2400 } }));
    children.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: doc.title })] }));
    if (doc.subtitle) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: doc.subtitle, size: 28, color: "4B5068" })], spacing: { after: 400 } }));
    if (doc.author) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: doc.author, size: 24, color: "646B80" })], spacing: { before: 600 } }));
  }
  if (opts.toc && doc.chapters.length > 1) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: opts.titlePage, children: [new TextRun({ text: "Contents" })] }));
    doc.chapters.forEach((c, i) => children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}.  ${c.title}` })], spacing: { after: 80 } })));
  }
  doc.chapters.forEach((c, i) => {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: opts.pageBreaks && (i > 0 || opts.titlePage || opts.toc), children: [new TextRun({ text: c.title })] }));
    for (const n of c.content.content ?? []) children.push(...blocks(n));
  });

  const levels = (fmt: (typeof LevelFormat)[keyof typeof LevelFormat], texts: string[]) =>
    texts.map((text, level) => ({ level, format: fmt, text, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 * (level + 1), hanging: 260 } } } }));

  const document = new Document({
    creator: doc.author || "PLR Champion",
    title: doc.title,
    description: doc.subtitle,
    styles: {
      default: { document: { run: { font: "Calibri", size: 23 }, paragraph: { spacing: { line: 300 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", run: { size: 56, bold: true, color: "0F1222" }, paragraph: { spacing: { after: 240 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, color: "0F1222" }, paragraph: { spacing: { before: 240, after: 200 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: "0F1222" }, paragraph: { spacing: { before: 280, after: 140 } } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, color: "1B1E2E" }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: "1B1E2E" }, paragraph: { spacing: { before: 200, after: 100 } } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: levels(LevelFormat.BULLET, ["•", "◦", "▪", "•", "◦"]) },
        { reference: "numbered", levels: levels(LevelFormat.DECIMAL, ["%1.", "%2.", "%3.", "%4.", "%5."]) },
      ],
    },
    sections: [
      {
        properties: { page: { size: opts.pageSize === "A4" ? { width: 11906, height: 16838 } : { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } } },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "8A90A5" })] })] }) },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}

/* ------------------------------------------------------------------ */
/* PDF                                                                  */
/* ------------------------------------------------------------------ */
type PdfContent = Record<string, unknown> | string | PdfContent[];

export async function documentToPdf(doc: ExportableDocument, opts: DocExportOptions = DEFAULT_DOC_EXPORT): Promise<Blob> {
  const pdfMake = (await import("pdfmake/build/pdfmake")).default;
  const vfs = (await import("pdfmake/build/vfs_fonts")).default;
  pdfMake.addVirtualFileSystem(vfs);
  const pageWidth = opts.pageSize === "A4" ? 595.28 : 612;
  const contentWidth = pageWidth - 2 * 64;

  const runs = (nodes: PMNode[] | undefined): PdfContent[] => {
    const out: PdfContent[] = [];
    for (const n of nodes ?? []) {
      if (n.type === "hardBreak") {
        out.push("\n");
        continue;
      }
      if (n.type !== "text") continue;
      const marks = n.marks ?? [];
      const has = (t: string) => marks.some((m) => m.type === t);
      const link = marks.find((m) => m.type === "link");
      const decoration = has("underline") || link ? "underline" : has("strike") ? "lineThrough" : undefined;
      out.push({
        text: n.text ?? "",
        bold: has("bold") || undefined,
        italics: has("italic") || undefined,
        decoration,
        background: has("highlight") ? "#fef08a" : undefined,
        color: link ? opts.accent : has("code") ? "#3a2fd0" : undefined,
        link: link && typeof link.attrs?.href === "string" && /^(https?:|mailto:)/i.test(link.attrs.href) ? link.attrs.href : undefined,
      });
    }
    return out;
  };

  const align = (n: PMNode) => (["center", "right", "justify"].includes(String(n.attrs?.textAlign)) ? String(n.attrs?.textAlign) : undefined);

  const block = (n: PMNode, width = contentWidth): PdfContent | null => {
    switch (n.type) {
      case "paragraph": {
        const r = runs(n.content);
        return r.length ? { text: r, margin: [0, 0, 0, 8], alignment: align(n) } : { text: " ", margin: [0, 0, 0, 4] };
      }
      case "heading": {
        const lvl = Number(n.attrs?.level ?? 2);
        return { text: runs(n.content), style: lvl <= 1 ? "h2" : lvl === 2 ? "h3" : "h4", alignment: align(n) };
      }
      case "bulletList":
      case "orderedList":
        return {
          [n.type === "bulletList" ? "ul" : "ol"]: (n.content ?? []).map((li) => ({ stack: (li.content ?? []).map((c) => block(c, width - 16)).filter(Boolean) })),
          margin: [0, 0, 0, 8],
          ...(n.type === "orderedList" && Number(n.attrs?.start ?? 1) !== 1 ? { start: Number(n.attrs?.start) } : {}),
        };
      case "taskList":
        return {
          stack: (n.content ?? []).map((li) => ({
            columns: [
              { width: 14, canvas: [{ type: "rect", x: 0, y: 3, w: 8, h: 8, lineWidth: 0.8, lineColor: "#646b80", ...(li.attrs?.checked ? { color: "#c7c9d3" } : {}) }] },
              { width: "*", stack: (li.content ?? []).map((c) => block(c, width - 14)).filter(Boolean) },
            ],
          })),
          margin: [0, 0, 0, 8],
        };
      case "blockquote":
        return {
          table: { widths: ["*"], body: [[{ stack: (n.content ?? []).map((c) => block(c, width - 20)).filter(Boolean), italics: true, color: "#3d4257" }]] },
          layout: { hLineWidth: () => 0, vLineWidth: (i: number) => (i === 0 ? 2 : 0), vLineColor: () => opts.accent, paddingLeft: () => 10, paddingTop: () => 2, paddingBottom: () => 0 },
          margin: [0, 2, 0, 10],
        };
      case "callout": {
        const fills: Record<string, string> = { tip: "#eefaf3", note: "#f1f0ff", warning: "#fff7e8", example: "#eef7fd", summary: "#f6f6f8", exercise: "#fdf2f8" };
        const v = String(n.attrs?.variant ?? "note");
        return {
          table: { widths: ["*"], body: [[{ stack: [{ text: v.toUpperCase(), bold: true, fontSize: 8, color: opts.accent, margin: [0, 0, 0, 4] }, ...(n.content ?? []).map((c) => block(c, width - 24)).filter(Boolean)], fillColor: fills[v] ?? "#f1f0ff" }]] },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 10, paddingBottom: () => 4 },
          margin: [0, 4, 0, 12],
        };
      }
      case "codeBlock":
        return { table: { widths: ["*"], body: [[{ text: nodeText(n), fontSize: 9, preserveLeadingSpaces: true, color: "#e7e9f2", fillColor: "#0f1222" }]] }, layout: "noBorders", margin: [0, 0, 0, 10] };
      case "horizontalRule":
        return { canvas: [{ type: "line", x1: 0, y1: 6, x2: width, y2: 6, lineWidth: 0.6, lineColor: "#d9dce5" }], margin: [0, 6, 0, 14] };
      case "writingLines": {
        const count = Math.min(20, Math.max(1, Number(n.attrs?.count ?? 3)));
        return { canvas: Array.from({ length: count }, (_, i) => ({ type: "line", x1: 0, y1: 22 * (i + 1), x2: width, y2: 22 * (i + 1), lineWidth: 0.5, lineColor: "#c9cdd8" })), margin: [0, 0, 0, 12] };
      }
      case "image": {
        const src = String(n.attrs?.src ?? "");
        if (!/^data:image\/(png|jpe?g);base64,/i.test(src)) return { text: "[image omitted — only PNG and JPEG images can be embedded in PDF]", italics: true, color: "#8a90a5", margin: [0, 0, 0, 8] };
        return { image: src, fit: [width, 520], alignment: "center", margin: [0, 4, 0, 12] };
      }
      case "table": {
        const rows = (n.content ?? []).map((row) => (row.content ?? []).map((cell) => ({ stack: (cell.content ?? []).map((c) => block(c, 200)).filter(Boolean), fillColor: cell.type === "tableHeader" ? "#f2f3f7" : undefined, bold: cell.type === "tableHeader" || undefined })));
        if (!rows.length) return null;
        const cols = Math.max(...rows.map((r) => r.length));
        const body = rows.map((r) => [...r, ...Array.from({ length: cols - r.length }, () => ({ text: "" }))]);
        return { table: { headerRows: (n.content?.[0]?.content ?? []).every((c) => c.type === "tableHeader") ? 1 : 0, widths: Array(cols).fill("*"), body }, layout: { hLineColor: () => "#d9dce5", vLineColor: () => "#d9dce5", hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4, paddingBottom: () => 2 }, margin: [0, 2, 0, 12] };
      }
      default:
        return n.content ? { stack: n.content.map((c) => block(c, width)).filter(Boolean) } : null;
    }
  };

  const content: PdfContent[] = [];
  if (opts.titlePage) {
    content.push({ text: doc.title, style: "title", margin: [0, 180, 0, 16] });
    if (doc.subtitle) content.push({ text: doc.subtitle, style: "subtitle" });
    if (doc.author) content.push({ text: doc.author, style: "author", margin: [0, 80, 0, 0] });
  }
  if (opts.toc && doc.chapters.length > 1) {
    content.push({ toc: { title: { text: "Contents", style: "h1" }, numberStyle: { color: "#646b80" } }, pageBreak: opts.titlePage ? "before" : undefined });
  }
  doc.chapters.forEach((c, i) => {
    const first = i === 0 && !opts.titlePage && !(opts.toc && doc.chapters.length > 1);
    content.push({ text: c.title, style: "h1", tocItem: true, pageBreak: opts.pageBreaks && !first ? "before" : undefined, margin: first || !opts.pageBreaks ? [0, 12, 0, 12] : [0, 0, 0, 12] });
    for (const n of c.content.content ?? []) {
      const b = block(n);
      if (b) content.push(b);
    }
  });

  const definition = {
    pageSize: opts.pageSize,
    pageMargins: [64, 64, 64, 64],
    info: { title: doc.title, author: doc.author || undefined, creator: "PLR Champion Software Suite" },
    content,
    footer: (current: number) => (current > (opts.titlePage ? 1 : 0) ? { text: String(current), alignment: "center", fontSize: 9, color: "#8a90a5", margin: [0, 24, 0, 0] } : null),
    defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.35, color: "#1b1e2e" },
    styles: {
      title: { fontSize: 30, bold: true, alignment: "center", color: "#0f1222" },
      subtitle: { fontSize: 14, alignment: "center", color: "#4b5068" },
      author: { fontSize: 12, alignment: "center", color: "#646b80", characterSpacing: 1 },
      h1: { fontSize: 20, bold: true, color: "#0f1222" },
      h2: { fontSize: 16, bold: true, margin: [0, 12, 0, 6], color: "#0f1222" },
      h3: { fontSize: 13.5, bold: true, margin: [0, 10, 0, 4], color: "#1b1e2e" },
      h4: { fontSize: 12, bold: true, margin: [0, 8, 0, 4], color: "#1b1e2e" },
    },
  };
  return pdfMake.createPdf(definition).getBlob();
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                           */
/* ------------------------------------------------------------------ */
export async function exportDocument(doc: ExportableDocument, format: DocExportFormat, opts: DocExportOptions = DEFAULT_DOC_EXPORT): Promise<ExportFile> {
  switch (format) {
    case "html":
      return textFile(documentToHtml(doc, opts), safeFileName(doc.title, "html"), "text/html");
    case "md":
      return textFile(documentToMarkdown(doc, opts), safeFileName(doc.title, "md"), "text/markdown");
    case "txt":
      return textFile(documentToText(doc, opts), safeFileName(doc.title, "txt"));
    case "docx":
      return { fileName: safeFileName(doc.title, "docx"), blob: await documentToDocx(doc, opts) };
    case "pdf":
      return { fileName: safeFileName(doc.title, "pdf"), blob: await documentToPdf(doc, opts) };
  }
}
