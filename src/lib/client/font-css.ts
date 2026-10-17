"use client";

import { fontById } from "@/lib/fonts";

let cache: string | null = null;

/** @font-face rules of the app's self-hosted fonts, so sandboxed previews (srcdoc iframes) render the same fonts. */
export function appFontFaceCss(): string {
  if (cache !== null) return cache;
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const r of Array.from(rules ?? [])) if (r instanceof CSSFontFaceRule) out.push(r.cssText);
  }
  cache = out.join("\n");
  return cache;
}

/** A Google Fonts stylesheet link for exported pages (opt-in; the app itself never loads third-party fonts). */
export function googleFontsLink(fontIds: string[]): string {
  const fams = [...new Set(fontIds)].map((id) => fontById(id)).map((f) => {
    const family = f.family.replace(/ Variable$/, "");
    const weights = f.weights.length > 1 ? `:wght@${f.weights.join(";")}` : "";
    return `family=${encodeURIComponent(family).replace(/%20/g, "+")}${weights}`;
  });
  return fams.length ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fams.join("&")}&display=swap">` : "";
}
