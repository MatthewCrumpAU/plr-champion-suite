"use client";

import type { Asset } from "@/lib/data/types";
import type { CoverData, MockupData, MockupSource } from "@/lib/models/design";
import { renderCover } from "@/lib/covers/render";
import { loadFileImage } from "@/lib/services/files";
import { renderMockup, type MockupSourceImage } from "./render";

const sourceCache = new Map<string, Promise<MockupSourceImage | null>>();

/** Renders a cover (or loads an uploaded image) at roughly `targetHeight` pixels tall. Cached by cover revision. */
export function loadSourceImage(source: MockupSource, cover: Asset<"cover"> | undefined, logoFileId: string | null, targetHeight: number): Promise<MockupSourceImage | null> {
  if (source.kind === "file") {
    const key = `file:${source.refId}`;
    if (!sourceCache.has(key)) sourceCache.set(key, loadFileImage(source.refId).catch(() => null));
    return sourceCache.get(key)!;
  }
  if (!cover) return Promise.resolve(null);
  const ratio = Math.min(1, targetHeight / cover.data.height);
  const key = `cover:${cover.id}:${cover.updatedAt}:${ratio.toFixed(3)}:${logoFileId ?? ""}`;
  if (!sourceCache.has(key)) {
    if (sourceCache.size > 60) sourceCache.clear();
    sourceCache.set(
      key,
      renderCover(cover.data as CoverData, { pixelRatio: ratio, logoFileId }).catch(() => null),
    );
  }
  return sourceCache.get(key)!;
}


/** Renders a mockup to a PNG data URL `width` pixels wide (used for sales page hero images). */
export async function mockupDataUrl(data: MockupData, covers: Asset<"cover">[], logoFileId: string | null, width = 900): Promise<string | null> {
  const scale = width / data.canvas.width;
  const map = new Map(covers.map((c) => [c.id, c]));
  const images = (await Promise.all(data.sources.map((s) => loadSourceImage(s, map.get(s.refId), logoFileId, data.canvas.height * scale * 0.9)))).filter((x): x is MockupSourceImage => !!x);
  if (!images.length) return null;
  return renderMockup(data, images, { scale }).toDataURL("image/png");
}
