import { CHAMPION_SAMPLE, type SampleLibrary } from "./sample-content";
import { IM_SAMPLE } from "./sample-content-im";
import type { BrandId } from "./types";

/** Each brand's own sample library — brands never share products. */
const LIBRARIES: Record<BrandId, SampleLibrary> = { "plr-champion": CHAMPION_SAMPLE, plrforim: IM_SAMPLE };

export function sampleLibraryFor(brandId: string): SampleLibrary | null {
  return (LIBRARIES as Record<string, SampleLibrary | undefined>)[brandId] ?? null;
}
