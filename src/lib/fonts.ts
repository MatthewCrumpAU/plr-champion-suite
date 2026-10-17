/**
 * Fonts bundled with the app (self-hosted via @fontsource, no external requests).
 * Used by Cover Creator, Mockups, Brand Kits, Sales Pages and exports.
 */
export interface FontInfo {
  id: string;
  label: string;
  family: string;
  css: string;
  category: "sans" | "serif" | "display" | "script";
  weights: number[];
}

export const FONTS: FontInfo[] = [
  { id: "inter", label: "Inter", family: "Inter Variable", css: `"Inter Variable", Inter, system-ui, sans-serif`, category: "sans", weights: [400, 500, 600, 700, 800, 900] },
  { id: "montserrat", label: "Montserrat", family: "Montserrat", css: `Montserrat, system-ui, sans-serif`, category: "sans", weights: [400, 600, 700, 800, 900] },
  { id: "poppins", label: "Poppins", family: "Poppins", css: `Poppins, system-ui, sans-serif`, category: "sans", weights: [400, 600, 700, 800] },
  { id: "raleway", label: "Raleway", family: "Raleway", css: `Raleway, system-ui, sans-serif`, category: "sans", weights: [400, 600, 700, 800] },
  { id: "nunito", label: "Nunito", family: "Nunito", css: `Nunito, system-ui, sans-serif`, category: "sans", weights: [400, 700, 800] },
  { id: "oswald", label: "Oswald", family: "Oswald", css: `Oswald, Impact, sans-serif`, category: "display", weights: [400, 600, 700] },
  { id: "bebas", label: "Bebas Neue", family: "Bebas Neue", css: `"Bebas Neue", Impact, sans-serif`, category: "display", weights: [400] },
  { id: "archivo-black", label: "Archivo Black", family: "Archivo Black", css: `"Archivo Black", Impact, sans-serif`, category: "display", weights: [400] },
  { id: "playfair", label: "Playfair Display", family: "Playfair Display", css: `"Playfair Display", Georgia, serif`, category: "serif", weights: [400, 600, 700, 800, 900] },
  { id: "dm-serif", label: "DM Serif Display", family: "DM Serif Display", css: `"DM Serif Display", Georgia, serif`, category: "serif", weights: [400] },
  { id: "lora", label: "Lora", family: "Lora", css: `Lora, Georgia, serif`, category: "serif", weights: [400, 600, 700] },
  { id: "merriweather", label: "Merriweather", family: "Merriweather", css: `Merriweather, Georgia, serif`, category: "serif", weights: [400, 700, 900] },
  { id: "libre-baskerville", label: "Libre Baskerville", family: "Libre Baskerville", css: `"Libre Baskerville", Georgia, serif`, category: "serif", weights: [400, 700] },
  { id: "roboto-slab", label: "Roboto Slab", family: "Roboto Slab", css: `"Roboto Slab", Georgia, serif`, category: "serif", weights: [400, 600, 700, 800] },
  { id: "caveat", label: "Caveat (handwritten)", family: "Caveat", css: `Caveat, cursive`, category: "script", weights: [400, 700] },
];

export function fontById(id: string | null | undefined): FontInfo {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

export function fontCss(id: string | null | undefined): string {
  return fontById(id).css;
}

/** Ensures a font face is loaded before drawing it on a canvas. */
export async function ensureFontLoaded(id: string, weight = 400, italic = false): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const f = fontById(id);
  const w = f.weights.includes(weight) ? weight : f.weights.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a), f.weights[0]);
  try {
    await document.fonts.load(`${italic ? "italic " : ""}${w} 48px "${f.family}"`);
  } catch {
    /* fall back to whatever is available */
  }
}

export async function ensureFontsLoaded(list: { font: string; weight?: number; italic?: boolean }[]): Promise<void> {
  await Promise.all(list.map((x) => ensureFontLoaded(x.font, x.weight ?? 400, x.italic ?? false)));
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;
}
