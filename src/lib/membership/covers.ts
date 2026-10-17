/**
 * Generated artwork for sample products and drops: an ebook-style cover and a "what's inside"
 * preview page, both as standalone SVG files (no external fonts or images, so they render offline
 * and inside the strict Content Security Policy).
 */

export type CoverMotif = "circles" | "waves" | "grid" | "rays" | "leaves" | "steps";

export interface CoverSpec {
  title: string;
  subtitle?: string;
  kicker?: string;
  brandName: string;
  /** [background top, background bottom, accent] */
  palette: [string, string, string];
  motif: CoverMotif;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy word wrap by character budget (good enough for display type at a fixed size). */
export function wrapText(text: string, maxChars: number, maxLines = 4): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:]?$/, "")}…`;
    return kept;
  }
  return lines;
}

function motifSvg(m: CoverMotif, accent: string): string {
  const a = esc(accent);
  switch (m) {
    case "circles":
      return `<circle cx="470" cy="150" r="190" fill="${a}" opacity=".18"/><circle cx="520" cy="110" r="110" fill="${a}" opacity=".25"/><circle cx="90" cy="690" r="150" fill="#fff" opacity=".06"/>`;
    case "waves":
      return `<path d="M0 560 C150 500 300 640 600 540 L600 800 L0 800Z" fill="${a}" opacity=".22"/><path d="M0 620 C200 560 380 700 600 610 L600 800 L0 800Z" fill="#fff" opacity=".07"/>`;
    case "grid":
      return Array.from({ length: 8 }, (_, i) => `<line x1="${i * 80}" y1="0" x2="${i * 80 + 200}" y2="800" stroke="#fff" stroke-opacity=".06" stroke-width="2"/>`).join("") + `<rect x="380" y="60" width="160" height="160" rx="28" fill="${a}" opacity=".3"/>`;
    case "rays":
      return Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2;
        return `<line x1="500" y1="140" x2="${(500 + Math.cos(ang) * 420).toFixed(0)}" y2="${(140 + Math.sin(ang) * 420).toFixed(0)}" stroke="${a}" stroke-opacity=".18" stroke-width="14"/>`;
      }).join("") + `<circle cx="500" cy="140" r="70" fill="${a}" opacity=".55"/>`;
    case "leaves":
      return `<path d="M470 60 C600 120 600 300 470 360 C380 260 380 160 470 60Z" fill="${a}" opacity=".3"/><path d="M380 150 C470 190 480 320 400 380 C330 320 320 220 380 150Z" fill="#fff" opacity=".08"/>`;
    case "steps":
      return [0, 1, 2, 3].map((i) => `<rect x="${300 + i * 70}" y="${300 - i * 70}" width="${300 - i * 70}" height="40" rx="8" fill="${a}" opacity="${0.15 + i * 0.08}"/>`).join("");
  }
}

export function coverSvg(spec: CoverSpec): string {
  const [c1, c2, accent] = spec.palette.map(esc);
  const titleLines = wrapText(spec.title, 15, 4);
  const size = titleLines.length > 3 ? 50 : 58;
  const titleY = 430 - (titleLines.length - 1) * (size * 0.55);
  const subtitleLines = spec.subtitle ? wrapText(spec.subtitle, 34, 3) : [];
  const subY = titleY + titleLines.length * (size + 6) + 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="600" height="800" fill="url(#bg)"/>
${motifSvg(spec.motif, spec.palette[2])}
<rect x="0" y="0" width="14" height="800" fill="#000" opacity=".18"/>
${spec.kicker ? `<text x="60" y="${titleY - size - 18}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="4" fill="${accent}">${esc(spec.kicker.toUpperCase())}</text>` : ""}
${titleLines.map((l, i) => `<text x="58" y="${titleY + i * (size + 6)}" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" font-weight="700" fill="#ffffff">${esc(l)}</text>`).join("\n")}
<rect x="60" y="${subY - 6}" width="70" height="5" rx="2" fill="${accent}"/>
${subtitleLines.map((l, i) => `<text x="60" y="${subY + 34 + i * 30}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" fill="#ffffff" fill-opacity=".86">${esc(l)}</text>`).join("\n")}
<text x="60" y="748" font-family="Inter, Helvetica, Arial, sans-serif" font-size="16" font-weight="600" letter-spacing="2" fill="#ffffff" fill-opacity=".7">${esc(spec.brandName.toUpperCase())}</text>
</svg>`;
}

/** Landscape (16:9) artwork for courses and tutorials. */
export function bannerSvg(spec: CoverSpec): string {
  const [c1, c2, accent] = spec.palette.map(esc);
  const titleLines = wrapText(spec.title, 22, 3);
  const size = titleLines.length > 2 ? 46 : 54;
  const startY = 225 - ((titleLines.length - 1) * (size + 6)) / 2 + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="800" height="450" fill="url(#bg)"/>
<g transform="translate(260 -120)">${motifSvg(spec.motif, spec.palette[2])}</g>
${spec.kicker ? `<text x="56" y="${startY - size - 10}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="4" fill="${accent}">${esc(spec.kicker.toUpperCase())}</text>` : ""}
${titleLines.map((l, i) => `<text x="54" y="${startY + i * (size + 6)}" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" font-weight="700" fill="#ffffff">${esc(l)}</text>`).join("\n")}
<text x="56" y="410" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" font-weight="600" letter-spacing="2" fill="#ffffff" fill-opacity=".7">${esc(spec.brandName.toUpperCase())}${spec.subtitle ? ` · ${esc(spec.subtitle.toUpperCase())}` : ""}</text>
</svg>`;
}

/** A preview "inside page" listing the contents — used as a gallery image. */
export function contentsSvg(title: string, items: string[], palette: [string, string, string]): string {
  const [c1, , accent] = palette.map(esc);
  const rows = items.slice(0, 9);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
<rect width="600" height="800" fill="#fbfbfd"/>
<rect width="600" height="120" fill="${c1}"/>
<text x="50" y="74" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" fill="#fff">What's inside</text>
${wrapText(title, 40, 2)
  .map((l, i) => `<text x="50" y="${168 + i * 26}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="19" font-weight="600" fill="#1d2033">${esc(l)}</text>`)
  .join("\n")}
${rows
  .map((r, i) => {
    const y = 240 + i * 58;
    return `<circle cx="66" cy="${y - 6}" r="15" fill="${accent}" opacity=".9"/><text x="66" y="${y - 1}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="#fff">${i + 1}</text><text x="96" y="${y}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" fill="#2b2f45">${esc(wrapText(r, 44, 1)[0] ?? "")}</text><line x1="96" y1="${y + 18}" x2="550" y2="${y + 18}" stroke="#e5e7ee"/>`;
  })
  .join("\n")}
</svg>`;
}

export const svgBlob = (svg: string) => new Blob([svg], { type: "image/svg+xml" });
