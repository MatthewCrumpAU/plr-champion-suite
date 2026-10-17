"use client";

import type { CoverData } from "@/lib/models/design";
import { safeFileName, type ExportFile } from "@/lib/export/download";
import { canvasToBlob, renderCover } from "./render";

export type CoverExportFormat = "png" | "jpg" | "pdf";

export async function exportCover(data: CoverData, title: string, format: CoverExportFormat, logoFileId: string | null, scale = 1): Promise<ExportFile> {
  if (format === "png") {
    const canvas = await renderCover(data, { pixelRatio: scale, logoFileId });
    return { fileName: safeFileName(title, "png"), blob: await canvasToBlob(canvas, "image/png") };
  }
  if (format === "jpg") {
    const canvas = await renderCover(data, { pixelRatio: scale, logoFileId, background: "#ffffff" });
    return { fileName: safeFileName(title, "jpg"), blob: await canvasToBlob(canvas, "image/jpeg", 0.93) };
  }
  const canvas = await renderCover(data, { pixelRatio: scale, logoFileId, background: "#ffffff" });
  const { jsPDF } = await import("jspdf");
  // Page size equals the design in points at 150 dpi so print size is sensible (e.g. 1600×2560 → 10.7 × 17 in).
  const wPt = (data.width / 150) * 72;
  const hPt = (data.height / 150) * 72;
  const pdf = new jsPDF({ unit: "pt", format: [wPt, hPt], orientation: wPt > hPt ? "landscape" : "portrait", compress: true });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, wPt, hPt, undefined, "FAST");
  pdf.setProperties({ title, creator: "PLR Champion Software Suite" });
  return { fileName: safeFileName(title, "pdf"), blob: pdf.output("blob") };
}
