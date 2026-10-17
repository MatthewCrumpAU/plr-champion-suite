"use client";

import { slugify } from "@/lib/utils";

export interface ExportFile {
  fileName: string;
  blob: Blob;
}

export function safeFileName(name: string, ext: string): string {
  return `${slugify(name, "export")}.${ext.replace(/^\./, "")}`;
}

/** Triggers a browser download for a generated file. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 4000);
}

export function downloadFile(f: ExportFile) {
  downloadBlob(f.blob, f.fileName);
}

export function textFile(content: string, fileName: string, mime = "text/plain"): ExportFile {
  return { fileName, blob: new Blob([content], { type: `${mime};charset=utf-8` }) };
}

export function htmlPage(title: string, bodyHtml: string, css: string): string {
  const esc = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc}</title>
<style>${css}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
