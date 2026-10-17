"use client";

import type { CoverData, CoverElement, Fill } from "@/lib/models/design";
import { ensureFontsLoaded, fontById } from "@/lib/fonts";
import { loadFileImage } from "@/lib/services/files";

/**
 * Shared Konva configuration for cover elements. Both the interactive editor (react-konva) and the
 * off-screen renderer (exports, thumbnails, mockups) use these functions, so what you see is what you export.
 */

export type ImageMap = Map<string, HTMLImageElement>;

export function gradientPoints(angle: number, w: number, h: number) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = Math.abs((w / 2) * dx) + Math.abs((h / 2) * dy);
  const cx = w / 2;
  const cy = h / 2;
  return { start: { x: cx - dx * half, y: cy - dy * half }, end: { x: cx + dx * half, y: cy + dy * half } };
}

/** Konva fill attributes for a Fill over a box of w×h whose local origin is at (ox, oy). */
export function fillAttrs(fill: Fill, w: number, h: number, ox = 0, oy = 0): Record<string, unknown> {
  if (fill.kind === "solid") return { fill: fill.color };
  const stops = fill.stops.flatMap((s) => [Math.max(0, Math.min(1, s.offset)), s.color]);
  if (fill.kind === "linear") {
    const { start, end } = gradientPoints(fill.angle, w, h);
    return {
      fillPriority: "linear-gradient",
      fillLinearGradientStartPoint: { x: start.x - ox, y: start.y - oy },
      fillLinearGradientEndPoint: { x: end.x - ox, y: end.y - oy },
      fillLinearGradientColorStops: stops,
    };
  }
  return {
    fillPriority: "radial-gradient",
    fillRadialGradientStartPoint: { x: w / 2 - ox, y: h / 2 - oy },
    fillRadialGradientEndPoint: { x: w / 2 - ox, y: h / 2 - oy },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: Math.max(w, h) * 0.7,
    fillRadialGradientColorStops: stops,
  };
}

export function textValue(el: Extract<CoverElement, { type: "text" }>) {
  return el.uppercase ? el.text.toUpperCase() : el.text;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/**
 * Font size actually used for a text element. When "keep words whole" is on (the default), the size shrinks just
 * enough that the longest word fits the box, so titles never break mid-word. Shared by the editor and exports.
 */
export function effectiveFontSize(el: Extract<CoverElement, { type: "text" }>): number {
  if (el.fitWords === false || typeof document === "undefined") return el.fontSize;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return el.fontSize;
  const f = fontById(el.fontFamily);
  measureCtx.font = `${el.italic ? "italic " : ""}${el.fontWeight} ${el.fontSize}px "${f.family}"`;
  let widest = 0;
  for (const word of textValue(el).split(/\s+/)) {
    if (!word) continue;
    const w = measureCtx.measureText(word).width + Math.max(0, word.length - 1) * (el.letterSpacing || 0);
    if (w > widest) widest = w;
  }
  if (widest <= el.width || widest === 0) return el.fontSize;
  return Math.max(6, Math.floor(el.fontSize * (el.width / widest) * 0.98));
}

export type NodeKind = "Text" | "Rect" | "Ellipse" | "Line" | "Image";

/** Konva class + attributes for one element. `id` is used for selection/transformer lookup. */
export function elementNode(el: CoverElement, images: ImageMap, logo: HTMLImageElement | null): { kind: NodeKind; attrs: Record<string, unknown> } | null {
  const common = { id: el.id, name: "element", x: el.x, y: el.y, rotation: el.rotation, opacity: el.opacity, visible: el.visible, draggable: !el.locked, listening: true };
  switch (el.type) {
    case "text": {
      const f = fontById(el.fontFamily);
      return {
        kind: "Text",
        attrs: {
          ...common,
          text: textValue(el),
          fontFamily: f.family,
          fontSize: effectiveFontSize(el),
          fontStyle: `${el.italic ? "italic " : ""}${el.fontWeight}`,
          fill: el.fill,
          align: el.align,
          width: el.width,
          lineHeight: el.lineHeight,
          letterSpacing: el.letterSpacing,
          wrap: "word",
          stroke: el.stroke && el.strokeWidth > 0 ? el.stroke : undefined,
          strokeWidth: el.stroke ? el.strokeWidth : 0,
          fillAfterStrokeEnabled: true,
          shadowColor: el.shadow?.color,
          shadowBlur: el.shadow?.blur ?? 0,
          shadowOffsetX: el.shadow?.offsetX ?? 0,
          shadowOffsetY: el.shadow?.offsetY ?? 0,
          shadowOpacity: el.shadow ? el.shadow.opacity : 0,
          shadowEnabled: !!el.shadow,
        },
      };
    }
    case "rect":
      return {
        kind: "Rect",
        attrs: { ...common, width: el.width, height: el.height, cornerRadius: el.cornerRadius, stroke: el.stroke ?? undefined, strokeWidth: el.stroke ? el.strokeWidth : 0, ...fillAttrs(el.fill, el.width, el.height) },
      };
    case "ellipse":
      return {
        kind: "Ellipse",
        attrs: {
          ...common,
          radiusX: el.width / 2,
          radiusY: el.height / 2,
          offsetX: -el.width / 2,
          offsetY: -el.height / 2,
          stroke: el.stroke ?? undefined,
          strokeWidth: el.stroke ? el.strokeWidth : 0,
          ...fillAttrs(el.fill, el.width, el.height, el.width / 2, el.height / 2),
        },
      };
    case "line":
      return { kind: "Line", attrs: { ...common, points: [0, 0, el.width, 0], stroke: el.stroke, strokeWidth: el.strokeWidth, dash: el.dash ? [el.strokeWidth * 3, el.strokeWidth * 2] : undefined, lineCap: "round", hitStrokeWidth: Math.max(20, el.strokeWidth) } };
    case "image": {
      const img = el.source === "brand-logo" ? logo : el.fileId ? (images.get(el.fileId) ?? null) : null;
      return { kind: "Image", attrs: { ...common, image: img ?? undefined, width: el.width, height: el.height, cornerRadius: el.cornerRadius, fill: img ? undefined : "#e5e7ee" } };
    }
  }
}

/** Crop values so a background image covers the canvas (like CSS background-size: cover). */
export function coverCrop(img: HTMLImageElement, w: number, h: number) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const cw = w / scale;
  const ch = h / scale;
  return { x: (iw - cw) / 2, y: (ih - ch) / 2, width: cw, height: ch };
}

/** Loads every image a cover needs (uploaded images, background image, optional brand logo). */
export async function loadCoverImages(data: CoverData, logoFileId: string | null): Promise<{ images: ImageMap; logo: HTMLImageElement | null }> {
  const ids = new Set<string>();
  for (const el of data.elements) if (el.type === "image" && el.source === "file" && el.fileId) ids.add(el.fileId);
  if (data.backgroundImageFileId) ids.add(data.backgroundImageFileId);
  const images: ImageMap = new Map();
  await Promise.all(
    [...ids].map(async (id) => {
      const img = await loadFileImage(id);
      if (img) images.set(id, img);
    }),
  );
  const needsLogo = data.elements.some((e) => e.type === "image" && e.source === "brand-logo");
  const logo = needsLogo && logoFileId ? await loadFileImage(logoFileId) : null;
  return { images, logo };
}

export async function ensureCoverFonts(data: CoverData) {
  await ensureFontsLoaded(data.elements.filter((e) => e.type === "text").map((e) => ({ font: (e as { fontFamily: string }).fontFamily, weight: (e as { fontWeight: number }).fontWeight, italic: (e as { italic: boolean }).italic })));
}

/** Renders a cover off-screen with Konva and returns a canvas at `pixelRatio` × design size. */
export async function renderCover(data: CoverData, opts: { pixelRatio?: number; logoFileId?: string | null; background?: string | null } = {}): Promise<HTMLCanvasElement> {
  const Konva = (await import("konva")).default;
  await ensureCoverFonts(data);
  const { images, logo } = await loadCoverImages(data, opts.logoFileId ?? null);
  const container = document.createElement("div");
  const stage = new Konva.Stage({ container, width: data.width, height: data.height });
  const layer = new Konva.Layer();
  stage.add(layer);
  if (opts.background) layer.add(new Konva.Rect({ x: 0, y: 0, width: data.width, height: data.height, fill: opts.background }));
  layer.add(new Konva.Rect({ x: 0, y: 0, width: data.width, height: data.height, ...fillAttrs(data.background, data.width, data.height) }));
  const bg = data.backgroundImageFileId ? images.get(data.backgroundImageFileId) : null;
  if (bg) layer.add(new Konva.Image({ x: 0, y: 0, width: data.width, height: data.height, image: bg, crop: coverCrop(bg, data.width, data.height), opacity: data.backgroundImageOpacity }));
  for (const el of data.elements) {
    const n = elementNode(el, images, logo);
    if (!n || !el.visible) continue;
    const Ctor = Konva[n.kind] as unknown as new (a: Record<string, unknown>) => InstanceType<typeof Konva.Shape>;
    layer.add(new Ctor({ ...n.attrs, draggable: false }));
  }
  layer.draw();
  const canvas = stage.toCanvas({ pixelRatio: opts.pixelRatio ?? 1 }) as HTMLCanvasElement;
  stage.destroy();
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create image."))), type, quality));
}

/** Small JPEG data URL for lists and pickers. */
export async function coverThumbnail(data: CoverData, logoFileId: string | null, width = 260): Promise<string> {
  const canvas = await renderCover(data, { pixelRatio: width / data.width, logoFileId, background: "#ffffff" });
  return canvas.toDataURL("image/jpeg", 0.82);
}
