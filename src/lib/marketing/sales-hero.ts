"use client";

import type { Asset } from "@/lib/data/types";
import type { SalesPageData } from "@/lib/models/marketing";
import { coverThumbnail } from "@/lib/covers/render";
import { mockupDataUrl } from "@/lib/mockups/sources";

/** Hero image (data URL) for a sales page: its chosen mockup, else its chosen cover, else none. */
export async function salesHeroImage(d: SalesPageData, covers: Asset<"cover">[], mockups: Asset<"mockup">[], logoFileId: string | null): Promise<string | null> {
  const mockup = mockups.find((m) => m.id === d.mockupAssetId);
  if (mockup) return mockupDataUrl(mockup.data, covers, logoFileId, 900);
  const cover = covers.find((c) => c.id === d.coverAssetId);
  if (cover) return coverThumbnail(cover.data, logoFileId, 640);
  return null;
}
