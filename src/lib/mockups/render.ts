"use client";

import type { Fill, MockupData } from "@/lib/models/design";
import { fontById } from "@/lib/fonts";

/**
 * Canvas 2D mockup renderer. Everything is drawn from the actual cover images, so the exported PNG is
 * exactly what the preview shows. No external services or AI image generation are used.
 */

export type MockupSourceImage = HTMLCanvasElement | HTMLImageElement;

const rad = (d: number) => (d * Math.PI) / 180;

function imgSize(img: MockupSourceImage) {
  const w = img instanceof HTMLImageElement ? img.naturalWidth || img.width : img.width;
  const h = img instanceof HTMLImageElement ? img.naturalHeight || img.height : img.height;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function paintFill(ctx: CanvasRenderingContext2D, fill: Fill, w: number, h: number) {
  if (fill.kind === "solid") {
    ctx.fillStyle = fill.color;
  } else if (fill.kind === "linear") {
    const a = rad(fill.angle);
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const half = Math.abs((w / 2) * dx) + Math.abs((h / 2) * dy);
    const g = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
    fill.stops.forEach((s) => g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color));
    ctx.fillStyle = g;
  } else {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    fill.stops.forEach((s) => g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color));
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, w, h);
}

/** Average colour of the left 4% of the cover, used for the spine when no colour is set. */
function edgeColor(img: MockupSourceImage): string {
  try {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 32;
    const x = c.getContext("2d")!;
    const { w, h } = imgSize(img);
    x.drawImage(img, 0, 0, Math.max(1, w * 0.04), h, 0, 0, 8, 32);
    const d = x.getImageData(0, 0, 8, 32).data;
    let r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }
    const n = d.length / 4;
    return `rgb(${Math.round((r / n) * 0.82)}, ${Math.round((g / n) * 0.82)}, ${Math.round((b / n) * 0.82)})`;
  } catch {
    return "#333";
  }
}

function floorShadow(ctx: CanvasRenderingContext2D, cx: number, y: number, rx: number, ry: number, opacity: number) {
  if (opacity <= 0) return;
  ctx.save();
  ctx.translate(cx, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${0.55 * opacity})`);
  g.addColorStop(0.55, `rgba(0,0,0,${0.22 * opacity})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

interface ShadowOpts {
  enabled: boolean;
  blur: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
  floor: boolean;
}

function withShadow(ctx: CanvasRenderingContext2D, s: ShadowOpts, k: number, draw: () => void) {
  ctx.save();
  if (s.enabled) {
    ctx.shadowColor = `rgba(0,0,0,${s.opacity})`;
    ctx.shadowBlur = s.blur * k;
    ctx.shadowOffsetX = s.offsetX * k;
    ctx.shadowOffsetY = s.offsetY * k;
  }
  draw();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 3D book                                                              */
/* ------------------------------------------------------------------ */
export function drawBook3D(
  ctx: CanvasRenderingContext2D,
  img: MockupSourceImage,
  o: { cx: number; cy: number; height: number; angle: number; spineRatio: number; spineColor: string | null; shadow: ShadowOpts; k: number; pages?: boolean },
) {
  const { w: iw, h: ih } = imgSize(img);
  const H = o.height;
  const W = H * (iw / ih);
  const th = rad(Math.max(2, Math.min(60, o.angle)));
  const D = W * 2.8;
  const S = W * o.spineRatio;
  const proj = (X: number, Z: number) => ({ x: (X * D) / (D + Z), s: D / (D + Z) });
  const front = (u: number) => proj(u * W * Math.cos(th), u * W * Math.sin(th));
  const spine = (t: number) => proj(-t * S * Math.sin(th), t * S * Math.cos(th));
  const fl = front(0);
  const fr = front(1);
  const sb = spine(1);
  const minX = Math.min(sb.x, fl.x);
  const maxX = fr.x;
  const shift = o.cx - (minX + maxX) / 2;
  const X = (p: { x: number }) => p.x + shift;
  const top = (p: { s: number }) => o.cy - (H * p.s) / 2;
  const bot = (p: { s: number }) => o.cy + (H * p.s) / 2;

  if (o.shadow.floor && o.shadow.enabled) floorShadow(ctx, o.cx + (maxX - minX) * 0.05, o.cy + H / 2, (maxX - minX) * 0.62, H * 0.05, o.shadow.opacity * 1.6);

  // Silhouette for the drop shadow.
  withShadow(ctx, o.shadow, o.k, () => {
    ctx.beginPath();
    ctx.moveTo(X(sb), top(sb));
    ctx.lineTo(X(fl), top(fl));
    ctx.lineTo(X(fr), top(fr));
    ctx.lineTo(X(fr), bot(fr));
    ctx.lineTo(X(fl), bot(fl));
    ctx.lineTo(X(sb), bot(sb));
    ctx.closePath();
    ctx.fillStyle = "#222";
    ctx.fill();
  });

  // Spine.
  const spineColor = o.spineColor || edgeColor(img);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(X(sb), top(sb));
  ctx.lineTo(X(fl), top(fl));
  ctx.lineTo(X(fl), bot(fl));
  ctx.lineTo(X(sb), bot(sb));
  ctx.closePath();
  ctx.fillStyle = spineColor;
  ctx.fill();
  ctx.clip();
  const sg = ctx.createLinearGradient(X(sb), 0, X(fl), 0);
  sg.addColorStop(0, "rgba(0,0,0,0.35)");
  sg.addColorStop(0.6, "rgba(255,255,255,0.08)");
  sg.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = sg;
  ctx.fillRect(X(sb) - 2, o.cy - H, X(fl) - X(sb) + 4, H * 2);
  ctx.restore();

  // Front cover, drawn in perspective slices.
  const N = 160;
  for (let i = 0; i < N; i++) {
    const a = front(i / N);
    const b = front((i + 1) / N);
    const s = (a.s + b.s) / 2;
    const h = H * s;
    ctx.drawImage(img, (i / N) * iw, 0, iw / N + 0.5, ih, X(a), o.cy - h / 2, X(b) - X(a) + 0.8, h);
  }

  // Lighting: hinge groove + soft gloss.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(X(fl), top(fl));
  ctx.lineTo(X(fr), top(fr));
  ctx.lineTo(X(fr), bot(fr));
  ctx.lineTo(X(fl), bot(fl));
  ctx.closePath();
  ctx.clip();
  const fw = X(fr) - X(fl);
  const lg = ctx.createLinearGradient(X(fl), 0, X(fr), 0);
  lg.addColorStop(0, "rgba(0,0,0,0.38)");
  lg.addColorStop(0.025, "rgba(255,255,255,0.22)");
  lg.addColorStop(0.05, "rgba(0,0,0,0.12)");
  lg.addColorStop(0.09, "rgba(255,255,255,0.06)");
  lg.addColorStop(0.5, "rgba(255,255,255,0)");
  lg.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = lg;
  ctx.fillRect(X(fl), o.cy - H, fw, H * 2);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Flat, paperback, workbook                                            */
/* ------------------------------------------------------------------ */
function drawFlat(ctx: CanvasRenderingContext2D, img: MockupSourceImage, cx: number, cy: number, height: number, tilt: number, shadow: ShadowOpts, k: number, radius = 0) {
  const { w: iw, h: ih } = imgSize(img);
  const H = height;
  const W = H * (iw / ih);
  if (shadow.floor && shadow.enabled) floorShadow(ctx, cx, cy + H / 2, W * 0.6, H * 0.04, shadow.opacity * 1.4);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad(tilt));
  withShadow(ctx, shadow, k, () => {
    roundRect(ctx, -W / 2, -H / 2, W, H, radius);
    ctx.fillStyle = "#fff";
    ctx.fill();
  });
  roundRect(ctx, -W / 2, -H / 2, W, H, radius);
  ctx.clip();
  ctx.drawImage(img, -W / 2, -H / 2, W, H);
  ctx.restore();
  return { W, H };
}

function drawPaperback(ctx: CanvasRenderingContext2D, img: MockupSourceImage, cx: number, cy: number, height: number, tilt: number, shadow: ShadowOpts, k: number) {
  const { w: iw, h: ih } = imgSize(img);
  const H = height;
  const W = H * (iw / ih);
  const t = Math.max(10, W * 0.07);
  if (shadow.floor && shadow.enabled) floorShadow(ctx, cx + t / 2, cy + H / 2 + t * 0.4, W * 0.62, H * 0.045, shadow.opacity * 1.5);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad(tilt));
  // Page block (visible thickness to the right and bottom).
  withShadow(ctx, shadow, k, () => {
    ctx.beginPath();
    ctx.moveTo(-W / 2 + t, -H / 2 + t * 0.6);
    ctx.lineTo(W / 2 + t, -H / 2 + t * 0.6);
    ctx.lineTo(W / 2 + t, H / 2 + t * 0.6);
    ctx.lineTo(-W / 2 + t, H / 2 + t * 0.6);
    ctx.closePath();
    ctx.fillStyle = "#f3eee2";
    ctx.fill();
  });
  ctx.strokeStyle = "rgba(120,110,90,0.18)";
  ctx.lineWidth = Math.max(1, k);
  for (let i = 1; i < 8; i++) {
    const off = (t / 8) * i;
    ctx.beginPath();
    ctx.moveTo(W / 2 + off, -H / 2 + off * 0.6);
    ctx.lineTo(W / 2 + off, H / 2 + off * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-W / 2 + off, H / 2 + off * 0.6);
    ctx.lineTo(W / 2 + off, H / 2 + off * 0.6);
    ctx.stroke();
  }
  ctx.drawImage(img, -W / 2, -H / 2, W, H);
  // Soft cover sheen and spine crease.
  const g = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
  g.addColorStop(0, "rgba(0,0,0,0.25)");
  g.addColorStop(0.03, "rgba(255,255,255,0.18)");
  g.addColorStop(0.07, "rgba(0,0,0,0.06)");
  g.addColorStop(0.6, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0.08)");
  ctx.fillStyle = g;
  ctx.fillRect(-W / 2, -H / 2, W, H);
  ctx.restore();
}

function drawWorkbook(ctx: CanvasRenderingContext2D, img: MockupSourceImage, cx: number, cy: number, height: number, tilt: number, shadow: ShadowOpts, k: number) {
  const { w: iw, h: ih } = imgSize(img);
  const H = height;
  const W = H * (iw / ih);
  if (shadow.floor && shadow.enabled) floorShadow(ctx, cx, cy + H / 2, W * 0.62, H * 0.04, shadow.opacity * 1.4);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad(tilt));
  // Stacked pages underneath.
  for (let i = 3; i >= 1; i--) {
    withShadow(ctx, i === 3 ? shadow : { ...shadow, enabled: false }, k, () => {
      ctx.fillStyle = i % 2 ? "#ffffff" : "#f4f4f4";
      ctx.fillRect(-W / 2 + i * 4 * k, -H / 2 + i * 4 * k, W, H);
    });
  }
  ctx.drawImage(img, -W / 2, -H / 2, W, H);
  // Spiral binding.
  const rings = Math.max(8, Math.round(H / (W * 0.08)));
  const gap = H / (rings + 1);
  const r = Math.min(gap * 0.32, W * 0.035);
  for (let i = 1; i <= rings; i++) {
    const y = -H / 2 + gap * i;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.arc(-W / 2 + r * 2.2, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2b2f3a";
    ctx.lineWidth = r * 0.5;
    ctx.beginPath();
    ctx.ellipse(-W / 2 + r * 0.6, y, r * 1.7, r * 0.75, 0, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = r * 0.15;
    ctx.beginPath();
    ctx.ellipse(-W / 2 + r * 0.6, y - r * 0.1, r * 1.6, r * 0.65, 0, Math.PI * 0.75, Math.PI * 1.25);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Devices                                                              */
/* ------------------------------------------------------------------ */
const DEVICE: Record<MockupData["layout"]["deviceColor"], { body: string; edge: string; screenBg: string }> = {
  dark: { body: "#1c1d22", edge: "#3a3c44", screenBg: "#0b0c10" },
  silver: { body: "#d9dbe0", edge: "#b6b9c1", screenBg: "#f4f5f7" },
  light: { body: "#f5f5f7", edge: "#dadce1", screenBg: "#ffffff" },
};

function drawContain(ctx: CanvasRenderingContext2D, img: MockupSourceImage, x: number, y: number, w: number, h: number, bg: string) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const { w: iw, h: ih } = imgSize(img);
  const s = Math.min(w / iw, h / ih) * 0.9;
  const dw = iw * s;
  const dh = ih * s;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = Math.min(w, h) * 0.04;
  ctx.shadowOffsetY = Math.min(w, h) * 0.01;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function drawTablet(ctx: CanvasRenderingContext2D, img: MockupSourceImage, cx: number, cy: number, height: number, tilt: number, color: MockupData["layout"]["deviceColor"], shadow: ShadowOpts, k: number) {
  const H = height;
  const W = H * 0.75;
  const c = DEVICE[color];
  if (shadow.floor && shadow.enabled) floorShadow(ctx, cx, cy + H / 2, W * 0.62, H * 0.04, shadow.opacity * 1.4);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad(tilt));
  withShadow(ctx, shadow, k, () => {
    roundRect(ctx, -W / 2, -H / 2, W, H, W * 0.07);
    ctx.fillStyle = c.body;
    ctx.fill();
  });
  roundRect(ctx, -W / 2, -H / 2, W, H, W * 0.07);
  ctx.strokeStyle = c.edge;
  ctx.lineWidth = Math.max(2, W * 0.008);
  ctx.stroke();
  const bz = W * 0.055;
  ctx.save();
  roundRect(ctx, -W / 2 + bz, -H / 2 + bz, W - bz * 2, H - bz * 2, W * 0.02);
  ctx.clip();
  drawContain(ctx, img, -W / 2 + bz, -H / 2 + bz, W - bz * 2, H - bz * 2, c.screenBg);
  const glare = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
  glare.addColorStop(0, "rgba(255,255,255,0.10)");
  glare.addColorStop(0.45, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(-W / 2, -H / 2, W, H);
  ctx.restore();
  ctx.fillStyle = c.edge;
  ctx.beginPath();
  ctx.arc(0, -H / 2 + bz / 2, bz * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return { W, H };
}

function drawLaptop(ctx: CanvasRenderingContext2D, img: MockupSourceImage, cx: number, cy: number, height: number, color: MockupData["layout"]["deviceColor"], shadow: ShadowOpts, k: number) {
  const screenH = height * 0.82;
  const screenW = screenH * 1.6;
  const c = DEVICE[color];
  const top = cy - height / 2;
  const baseY = top + screenH;
  const baseW = screenW * 1.22;
  const baseH = height * 0.06;
  if (shadow.floor && shadow.enabled) floorShadow(ctx, cx, baseY + baseH, baseW * 0.58, height * 0.035, shadow.opacity * 1.5);
  withShadow(ctx, shadow, k, () => {
    roundRect(ctx, cx - screenW / 2, top, screenW, screenH, screenW * 0.025);
    ctx.fillStyle = "#16171b";
    ctx.fill();
  });
  const bz = screenW * 0.03;
  ctx.save();
  roundRect(ctx, cx - screenW / 2 + bz, top + bz, screenW - bz * 2, screenH - bz * 1.6, screenW * 0.006);
  ctx.clip();
  drawContain(ctx, img, cx - screenW / 2 + bz, top + bz, screenW - bz * 2, screenH - bz * 1.6, c.screenBg);
  ctx.restore();
  // Base
  ctx.beginPath();
  ctx.moveTo(cx - screenW / 2 - screenW * 0.02, baseY);
  ctx.lineTo(cx + screenW / 2 + screenW * 0.02, baseY);
  ctx.lineTo(cx + baseW / 2, baseY + baseH * 0.8);
  ctx.quadraticCurveTo(cx + baseW / 2, baseY + baseH, cx + baseW / 2 - baseH, baseY + baseH);
  ctx.lineTo(cx - baseW / 2 + baseH, baseY + baseH);
  ctx.quadraticCurveTo(cx - baseW / 2, baseY + baseH, cx - baseW / 2, baseY + baseH * 0.8);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, baseY, 0, baseY + baseH);
  bg.addColorStop(0, c.edge);
  bg.addColorStop(1, c.body);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  roundRect(ctx, cx - screenW * 0.08, baseY, screenW * 0.16, baseH * 0.3, baseH * 0.15);
  ctx.fill();
  return { W: baseW, H: height };
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */
export const FLAT_KINDS: MockupData["kind"][] = ["flat", "paperback", "workbook", "tablet"];
export const ANGLED_KINDS: MockupData["kind"][] = ["ebook-3d", "bundle", "course-bundle"];

/** Sensible default angle (3D turn) or tilt (flat rotation) when switching mockup type. */
export function defaultAngleFor(kind: MockupData["kind"]): number {
  switch (kind) {
    case "ebook-3d":
    case "course-bundle":
      return 18;
    case "bundle":
      return 22;
    case "laptop":
      return 0;
    case "paperback":
      return -3;
    case "workbook":
      return -2;
    case "tablet":
      return -3;
    default:
      return 0;
  }
}

/** Number of distinct images a mockup type shows. */
export function sourcesNeeded(kind: MockupData["kind"]): number {
  return kind === "bundle" ? 5 : kind === "course-bundle" ? 3 : 1;
}

function drawObjects(ctx: CanvasRenderingContext2D, data: MockupData, sources: MockupSourceImage[], W: number, H: number, scale: number, captionSpace: number) {
  const k = scale * (data.canvas.height / 1200);
  const L = data.layout;
  const cx = W / 2 + L.offsetX * W;
  const cy = H / 2 + L.offsetY * H - captionSpace / 2;
  const baseH = (H - captionSpace) * 0.68 * L.scale;
  const shadow = { ...data.shadow, floor: data.shadow.floor && !L.reflection };
  const s0 = sources[0];
  const at = (i: number) => sources[i % sources.length];

  switch (data.kind) {
    case "flat":
      drawFlat(ctx, s0, cx, cy, baseH, L.angle, shadow, k, 0);
      break;
    case "ebook-3d":
      drawBook3D(ctx, s0, { cx, cy, height: baseH, angle: L.angle, spineRatio: L.spineWidth, spineColor: L.spineColor, shadow, k });
      break;
    case "paperback":
      drawPaperback(ctx, s0, cx, cy, baseH * 0.94, L.angle, shadow, k);
      break;
    case "workbook":
      drawWorkbook(ctx, s0, cx, cy, baseH * 0.96, L.angle, shadow, k);
      break;
    case "tablet":
      drawTablet(ctx, s0, cx, cy, baseH, L.angle, L.deviceColor, shadow, k);
      break;
    case "laptop":
      drawLaptop(ctx, s0, cx, cy, baseH * 0.82, L.deviceColor, shadow, k);
      break;
    case "bundle": {
      const n = Math.min(5, Math.max(sources.length, 3));
      const half = Math.floor(n / 2);
      // Back to front: outermost books first, centre book last.
      const order: number[] = [];
      for (let d = half; d >= 1; d--) order.push(-d, d);
      order.push(0);
      for (const pos of order) {
        if (n % 2 === 0 && pos === half) continue; // even counts: keep composition balanced on the left
        const i = pos === 0 ? 0 : pos < 0 ? -pos * 2 - 1 : pos * 2;
        const depth = Math.abs(pos);
        const hh = baseH * (1 - depth * 0.13);
        drawBook3D(ctx, at(i), {
          cx: cx + pos * baseH * 0.42 * L.spacing * 2,
          cy: cy + depth * baseH * 0.065,
          height: hh,
          angle: Math.max(4, L.angle + pos * 4),
          spineRatio: L.spineWidth,
          spineColor: L.spineColor,
          shadow: { ...shadow, floor: depth === 0 ? shadow.floor : false },
          k,
        });
      }
      break;
    }
    case "course-bundle": {
      drawLaptop(ctx, at(0), cx, cy - baseH * 0.08, baseH * 0.7, L.deviceColor, { ...shadow, floor: false }, k);
      drawTablet(ctx, at(1), cx - baseH * 0.62 * L.spacing * 1.8, cy + baseH * 0.12, baseH * 0.62, -4, L.deviceColor, shadow, k);
      drawBook3D(ctx, at(2), { cx: cx + baseH * 0.62 * L.spacing * 1.8, cy: cy + baseH * 0.1, height: baseH * 0.66, angle: L.angle, spineRatio: L.spineWidth, spineColor: L.spineColor, shadow, k });
      break;
    }
  }
}

/**
 * Mirror each vertical strip of `src` about its own lowest opaque pixel, so angled objects (3D books, tilted
 * covers) get a reflection that touches their actual bottom edge. Returns a faded reflection layer.
 */
function buildReflection(src: HTMLCanvasElement, strength = 0.3): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const pixels = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  const strip = Math.max(1, Math.round(w / 700));
  const depth = Math.round(h * 0.22);
  const refl = document.createElement("canvas");
  refl.width = w;
  refl.height = h;
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const r = refl.getContext("2d")!;
  const m = mask.getContext("2d")!;
  for (let x = 0; x < w; x += strip) {
    const sw = Math.min(strip, w - x);
    const col = Math.min(w - 1, x + (sw >> 1));
    let bottom = -1;
    for (let y = h - 1; y >= 0; y--) {
      if (pixels[(y * w + col) * 4 + 3] > 40) {
        bottom = y;
        break;
      }
    }
    if (bottom < 0) continue;
    const len = Math.min(depth, bottom, h - bottom);
    if (len < 2) continue;
    r.save();
    r.translate(0, bottom * 2);
    r.scale(1, -1);
    r.drawImage(src, x, bottom - len, sw, len, x, bottom - len, sw, len);
    r.restore();
    const g = m.createLinearGradient(0, bottom, 0, bottom + len);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    m.fillStyle = g;
    m.fillRect(x, bottom, sw, len);
  }
  r.globalCompositeOperation = "destination-in";
  r.drawImage(mask, 0, 0);
  return refl;
}

export function renderMockup(data: MockupData, sources: MockupSourceImage[], opts: { scale?: number } = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 1;
  const W = Math.round(data.canvas.width * scale);
  const H = Math.round(data.canvas.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (data.background.kind !== "transparent") paintFill(ctx, data.background as Fill, W, H);

  if (!sources.length) {
    ctx.fillStyle = "rgba(15,18,34,0.35)";
    ctx.font = `${Math.round(H * 0.035)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Choose a cover or upload an image", W / 2, H / 2);
    return canvas;
  }

  const captionSpace = data.caption.enabled && data.caption.text ? data.caption.size * scale * 2 : 0;
  const makeLayer = (d: MockupData) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d")!;
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = "high";
    drawObjects(x, d, sources, W, H, scale, captionSpace);
    return c;
  };
  const layer = makeLayer(data);
  if (data.layout.reflection) {
    // Reflect a shadow-free copy so the reflection starts exactly at each object's bottom edge.
    const clean = data.shadow.enabled ? makeLayer({ ...data, shadow: { ...data.shadow, enabled: false } }) : layer;
    ctx.drawImage(buildReflection(clean), 0, 0);
  }
  ctx.drawImage(layer, 0, 0);

  if (captionSpace) {
    const size = data.caption.size * scale;
    ctx.fillStyle = data.caption.color;
    ctx.font = `700 ${size}px "${fontById(data.caption.font ?? "montserrat").family}", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.caption.text, W / 2, H - captionSpace / 2 - size * 0.2, W * 0.9);
  }
  return canvas;
}
