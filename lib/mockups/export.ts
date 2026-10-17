"use client";

import type { Asset, BrandKit } from "@/lib/data/types";
import type { MockupData } from "@/lib/models/design";
import { solid } from "@/lib/models/design";
import { canvasToBlob } from "@/lib/covers/render";
import { ensureFontLoaded } from "@/lib/fonts";
import { safeFileName, type ExportFile } from "@/lib/export/download";
import { renderMockup, type MockupSourceImage } from "./render";
import { loadSourceImage } from "./sources";

export async function exportMockup(data: MockupData, covers: Asset<"cover">[], kit: BrandKit | null, title: string, format: "png" | "jpg", scale: number): Promise<ExportFile> {
  const coverMap = new Map(covers.map((c) => [c.id, c]));
  const targetHeight = data.canvas.height * scale * 0.9 * data.layout.scale;
  const images = (await Promise.all(data.sources.map((s) => loadSourceImage(s, coverMap.get(s.refId), kit?.logoFileId ?? null, targetHeight)))).filter((x): x is MockupSourceImage => !!x);
  if (!images.length) throw new Error("Add at least one cover or image first.");
  if (data.caption.enabled && data.caption.text) await ensureFontLoaded(data.caption.font ?? "montserrat", 700).catch(() => undefined);
  const out = data.background.kind === "transparent" && format === "jpg" ? { ...data, background: solid("#ffffff") } : data;
  const canvas = renderMockup(out, images, { scale });
  const blob = await canvasToBlob(canvas, format === "png" ? "image/png" : "image/jpeg", 0.93);
  return { fileName: safeFileName(scale > 1 ? `${title}@${scale}x` : title, format), blob };
}

