"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type Konva from "konva";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Boxes,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Heading,
  ImagePlus,
  Lock,
  Minus,
  Palette,
  Redo2,
  Square,
  Stamp,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Wand2,
  ZoomIn,
  ZoomOut,
  Maximize,
} from "lucide-react";
import { toast } from "sonner";
import type { BrandKit, Project } from "@/lib/data/types";
import type { CoverData, CoverElement, CoverTextElement } from "@/lib/models/design";
import { applyPalette, COVER_SIZES, ellipseEl, fillBoundText, imageEl, lineEl, rectEl, textEl, type TemplateText } from "@/lib/covers/templates";
import { coverThumbnail, effectiveFontSize, ensureCoverFonts, loadCoverImages, type ImageMap } from "@/lib/covers/render";
import { solid } from "@/lib/models/design";
import { loadFileImage, storeImageUpload } from "@/lib/services/files";
import { createAsset } from "@/lib/services/assets";
import { updateProject } from "@/lib/services/projects";
import { useBrandKits, useAsset } from "@/lib/data/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Checkbox, Field, Input, Label, NativeSelect, Separator, Slider, Spinner, Textarea } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from "@/components/ui/overlays";
import { ColorField, FillEditor, FontSelect } from "@/components/common/design-fields";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, deepClone, errorMessage, uid } from "@/lib/utils";

const CoverCanvas = dynamic(() => import("./cover-canvas"), { ssr: false, loading: () => <Spinner /> });

/* ------------------------------------------------------------------ */
/* Undo / redo                                                          */
/* ------------------------------------------------------------------ */
function useCoverHistory(editor: AssetEditor<"cover">) {
  const past = React.useRef<CoverData[]>([]);
  const future = React.useRef<CoverData[]>([]);
  const last = React.useRef<{ key: string; at: number } | null>(null);
  const [, force] = React.useReducer((x: number) => x + 1, 0);

  const commit = React.useCallback(
    (fn: (d: CoverData) => CoverData, coalesceKey?: string) => {
      const cur = editor.getData();
      if (!cur) return;
      const now = Date.now();
      const coalesce = coalesceKey && last.current && last.current.key === coalesceKey && now - last.current.at < 800;
      if (!coalesce) {
        past.current.push(deepClone(cur));
        if (past.current.length > 100) past.current.shift();
        future.current = [];
      }
      last.current = coalesceKey ? { key: coalesceKey, at: now } : null;
      editor.update(fn);
      force();
    },
    [editor],
  );

  const undo = React.useCallback(() => {
    const cur = editor.getData();
    const prev = past.current.pop();
    if (!cur || !prev) return;
    future.current.push(deepClone(cur));
    last.current = null;
    editor.update(() => ({ ...prev, thumbnail: cur.thumbnail }));
    force();
  }, [editor]);

  const redo = React.useCallback(() => {
    const cur = editor.getData();
    const next = future.current.pop();
    if (!cur || !next) return;
    past.current.push(deepClone(cur));
    last.current = null;
    editor.update(() => ({ ...next, thumbnail: cur.thumbnail }));
    force();
  }, [editor]);

  return { commit, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

/* ------------------------------------------------------------------ */
/* Panels                                                               */
/* ------------------------------------------------------------------ */
const WEIGHTS = [400, 500, 600, 700, 800, 900] as const;
const num = (v: string, fallback = 0) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback);

function NumberField({ label, value, onChange, step = 1, min, max }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input type="number" value={Math.round(value * 100) / 100} step={step} min={min} max={max} onChange={(e) => onChange(num(e.target.value, value))} className="h-8 text-xs" />
    </label>
  );
}

function ElementPanel({ el, update, swatches, onUpload }: { el: CoverElement; update: (patch: Partial<CoverElement>, key?: string) => void; swatches: string[]; onUpload: () => void }) {
  return (
    <div className="grid gap-3">
      <Input value={el.name} onChange={(e) => update({ name: e.target.value }, "name")} className="h-8 text-sm font-medium" aria-label="Layer name" />
      {el.type === "text" && (
        <>
          <Textarea value={el.text} onChange={(e) => update({ text: e.target.value } as Partial<CoverElement>, "text")} rows={3} aria-label="Text" data-testid="cover-text-input" />
          <FontSelect value={el.fontFamily} onChange={(v) => update({ fontFamily: v } as Partial<CoverElement>)} label="Font" />
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Size" value={el.fontSize} min={6} onChange={(v) => update({ fontSize: Math.max(6, v) } as Partial<CoverElement>, "fontSize")} />
            <label className="grid gap-1">
              <span className="text-[11px] text-muted-foreground">Weight</span>
              <NativeSelect value={el.fontWeight} onChange={(e) => update({ fontWeight: Number(e.target.value) as CoverTextElement["fontWeight"] } as Partial<CoverElement>)} className="h-8 text-xs">
                {WEIGHTS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] text-muted-foreground">Align</span>
              <NativeSelect value={el.align} onChange={(e) => update({ align: e.target.value as CoverTextElement["align"] } as Partial<CoverElement>)} className="h-8 text-xs">
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </NativeSelect>
            </label>
          </div>
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <Checkbox checked={el.italic} onCheckedChange={(v) => update({ italic: !!v } as Partial<CoverElement>)} /> Italic
            </label>
            <label className="flex items-center gap-1.5">
              <Checkbox checked={el.uppercase} onCheckedChange={(v) => update({ uppercase: !!v } as Partial<CoverElement>)} /> UPPERCASE
            </label>
            <Tooltip content="Shrinks the text just enough that long words never break across lines">
              <label className="flex items-center gap-1.5">
                <Checkbox checked={el.fitWords !== false} onCheckedChange={(v) => update({ fitWords: !!v } as Partial<CoverElement>)} /> Keep words whole
              </label>
            </Tooltip>
          </div>
          {el.fitWords !== false && effectiveFontSize(el) < el.fontSize && <p className="-mt-1 text-[11px] text-muted-foreground">Shown at {effectiveFontSize(el)}px so the longest word fits. Widen the box or shorten the word to use {el.fontSize}px.</p>}
          <ColorField label="Colour" value={el.fill} onChange={(c) => update({ fill: c, colorRole: null } as Partial<CoverElement>, "fill")} swatches={swatches} />
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Box width" value={el.width} min={20} onChange={(v) => update({ width: Math.max(20, v) } as Partial<CoverElement>, "width")} />
            <NumberField label="Line height" value={el.lineHeight} step={0.05} min={0.6} onChange={(v) => update({ lineHeight: v } as Partial<CoverElement>, "lh")} />
            <NumberField label="Spacing" value={el.letterSpacing} onChange={(v) => update({ letterSpacing: v } as Partial<CoverElement>, "ls")} />
          </div>
          <details className="rounded-lg border p-2">
            <summary className="cursor-pointer text-xs font-medium">Outline &amp; shadow</summary>
            <div className="mt-2 grid gap-2">
              <div className="grid grid-cols-[1fr_80px] items-end gap-2">
                <ColorField label="Outline colour" value={el.stroke ?? "#000000"} onChange={(c) => update({ stroke: c, strokeWidth: el.strokeWidth || 4 } as Partial<CoverElement>, "stroke")} />
                <NumberField label="Width" value={el.strokeWidth} min={0} onChange={(v) => update({ strokeWidth: v, stroke: v > 0 ? (el.stroke ?? "#000000") : null } as Partial<CoverElement>, "sw")} />
              </div>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={!!el.shadow} onCheckedChange={(v) => update({ shadow: v ? { color: "#000000", blur: 20, offsetX: 0, offsetY: 6, opacity: 0.45 } : null } as Partial<CoverElement>)} /> Drop shadow
              </label>
              {el.shadow && (
                <div className="grid grid-cols-3 gap-2">
                  <NumberField label="Blur" value={el.shadow.blur} min={0} onChange={(v) => update({ shadow: { ...el.shadow!, blur: v } } as Partial<CoverElement>, "sh")} />
                  <NumberField label="Offset Y" value={el.shadow.offsetY} onChange={(v) => update({ shadow: { ...el.shadow!, offsetY: v } } as Partial<CoverElement>, "sh")} />
                  <NumberField label="Opacity" value={el.shadow.opacity} step={0.05} min={0} max={1} onChange={(v) => update({ shadow: { ...el.shadow!, opacity: v } } as Partial<CoverElement>, "sh")} />
                </div>
              )}
            </div>
          </details>
          <label className="grid gap-1">
            <span className="text-[11px] text-muted-foreground">Linked to project field</span>
            <NativeSelect value={el.bind ?? ""} onChange={(e) => update({ bind: (e.target.value || null) as CoverTextElement["bind"] } as Partial<CoverElement>)} className="h-8 text-xs">
              <option value="">Not linked</option>
              <option value="title">Title</option>
              <option value="subtitle">Subtitle</option>
              <option value="author">Author</option>
              <option value="tagline">Tagline</option>
              <option value="brand">Brand name</option>
            </NativeSelect>
          </label>
        </>
      )}
      {(el.type === "rect" || el.type === "ellipse") && (
        <>
          <FillEditor value={el.fill} onChange={(f) => update({ fill: f, colorRole: null } as Partial<CoverElement>, "fill")} swatches={swatches} allowTransparent />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" value={el.width} min={4} onChange={(v) => update({ width: Math.max(4, v) } as Partial<CoverElement>, "w")} />
            <NumberField label="Height" value={el.height} min={4} onChange={(v) => update({ height: Math.max(4, v) } as Partial<CoverElement>, "h")} />
            {el.type === "rect" && <NumberField label="Corner radius" value={el.cornerRadius} min={0} onChange={(v) => update({ cornerRadius: Math.max(0, v) } as Partial<CoverElement>, "cr")} />}
            <NumberField label="Border width" value={el.strokeWidth} min={0} onChange={(v) => update({ strokeWidth: v, stroke: v > 0 ? (el.stroke ?? "#ffffff") : null } as Partial<CoverElement>, "sw")} />
          </div>
          {el.strokeWidth > 0 && <ColorField label="Border colour" value={el.stroke ?? "#ffffff"} onChange={(c) => update({ stroke: c } as Partial<CoverElement>, "stroke")} swatches={swatches} />}
        </>
      )}
      {el.type === "line" && (
        <>
          <ColorField label="Colour" value={el.stroke} onChange={(c) => update({ stroke: c, colorRole: null } as Partial<CoverElement>, "stroke")} swatches={swatches} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Length" value={el.width} min={4} onChange={(v) => update({ width: Math.max(4, v) } as Partial<CoverElement>, "w")} />
            <NumberField label="Thickness" value={el.strokeWidth} min={1} onChange={(v) => update({ strokeWidth: Math.max(1, v) } as Partial<CoverElement>, "sw")} />
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox checked={el.dash} onCheckedChange={(v) => update({ dash: !!v } as Partial<CoverElement>)} /> Dashed
          </label>
        </>
      )}
      {el.type === "image" && (
        <>
          {el.source === "brand-logo" ? <p className="text-xs text-muted-foreground">Shows the logo from the project&apos;s brand kit.</p> : <Button size="sm" variant="outline" onClick={onUpload}><ImagePlus /> Replace image</Button>}
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Width" value={el.width} min={4} onChange={(v) => update({ width: Math.max(4, v) } as Partial<CoverElement>, "w")} />
            <NumberField label="Height" value={el.height} min={4} onChange={(v) => update({ height: Math.max(4, v) } as Partial<CoverElement>, "h")} />
            <NumberField label="Corners" value={el.cornerRadius} min={0} onChange={(v) => update({ cornerRadius: Math.max(0, v) } as Partial<CoverElement>, "cr")} />
          </div>
        </>
      )}
      <Separator />
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="X" value={el.x} onChange={(v) => update({ x: v }, "x")} />
        <NumberField label="Y" value={el.y} onChange={(v) => update({ y: v }, "y")} />
        <NumberField label="Rotation" value={el.rotation} onChange={(v) => update({ rotation: v }, "rot")} />
      </div>
      <div className="grid gap-1">
        <Label className="text-[11px] text-muted-foreground">Opacity {Math.round(el.opacity * 100)}%</Label>
        <Slider value={[el.opacity * 100]} min={0} max={100} step={1} onValueChange={([v]) => update({ opacity: v / 100 }, "opacity")} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */
export function CoverEditor({ editor, project, kit }: { editor: AssetEditor<"cover">; project: Project; kit: BrandKit | null }) {
  const data = editor.data!;
  const router = useRouter();
  const history = useCoverHistory(editor);
  const { data: kits } = useBrandKits();
  const { data: mainDoc } = useAsset<"document">(project.mainDocumentId);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [images, setImages] = React.useState<ImageMap>(new Map());
  const [logo, setLogo] = React.useState<HTMLImageElement | null>(null);
  const [fontsReady, setFontsReady] = React.useState(0);
  const [zoom, setZoom] = React.useState<number | null>(null);
  const [box, setBox] = React.useState({ w: 800, h: 600 });
  const stageRef = React.useRef<Konva.Stage | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const uploadRef = React.useRef<HTMLInputElement>(null);
  const uploadTarget = React.useRef<"new" | "replace" | "background">("new");
  const selected = data.elements.find((e) => e.id === selectedId) ?? null;
  const swatches = kit ? [kit.colors.primary, kit.colors.secondary, kit.colors.accent, kit.colors.dark, kit.colors.light, ...kit.palette] : ["#5b4df5", "#1e1b4b", "#f5b544", "#0f1222", "#ffffff"];

  // Fit the stage to the available space.
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const fit = Math.max(0.05, Math.min((box.w - 48) / data.width, (box.h - 48) / data.height));
  const scale = zoom ?? fit;

  // Load images & fonts used by the design.
  const imageKey = JSON.stringify([data.backgroundImageFileId, data.elements.filter((e) => e.type === "image").map((e) => (e as { fileId: string | null }).fileId), kit?.logoFileId]);
  React.useEffect(() => {
    let active = true;
    loadCoverImages(data, kit?.logoFileId ?? null).then((r) => {
      if (!active) return;
      setImages(r.images);
      setLogo(r.logo);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);
  const fontKey = JSON.stringify(data.elements.filter((e) => e.type === "text").map((e) => [(e as CoverTextElement).fontFamily, (e as CoverTextElement).fontWeight, (e as CoverTextElement).italic]));
  React.useEffect(() => {
    let active = true;
    ensureCoverFonts(data).then(() => active && setFontsReady((n) => n + 1));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);

  // Regenerate the list thumbnail after edits settle.
  const designSig = React.useMemo(() => JSON.stringify({ ...data, thumbnail: null, renderedAt: null }), [data]);
  const thumbSig = React.useRef<string | null>(data.thumbnail ? designSig : null);
  React.useEffect(() => {
    if (thumbSig.current === designSig) return;
    const t = setTimeout(async () => {
      try {
        const thumb = await coverThumbnail(data, kit?.logoFileId ?? null);
        thumbSig.current = designSig;
        editor.update((d) => ({ ...d, thumbnail: thumb, renderedAt: new Date().toISOString() }));
      } catch {
        /* thumbnails are optional */
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designSig]);

  const updateEl = React.useCallback((id: string, patch: Partial<CoverElement>, key?: string) => history.commit((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as CoverElement) : e)) }), key ? `${id}:${key}` : undefined), [history]);
  const addEl = (el: CoverElement) => {
    history.commit((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  };
  const removeEl = (id: string) => {
    history.commit((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
    setSelectedId(null);
  };
  const duplicateEl = (id: string) => {
    const src = data.elements.find((e) => e.id === id);
    if (!src) return;
    addEl({ ...deepClone(src), id: uid("el"), name: `${src.name} copy`, x: src.x + 30, y: src.y + 30 });
  };
  const reorder = (id: string, to: "up" | "down" | "top" | "bottom") =>
    history.commit((d) => {
      const arr = [...d.elements];
      const i = arr.findIndex((e) => e.id === id);
      if (i < 0) return d;
      const [el] = arr.splice(i, 1);
      const j = to === "top" ? arr.length : to === "bottom" ? 0 : to === "up" ? Math.min(arr.length, i + 1) : Math.max(0, i - 1);
      arr.splice(j, 0, el);
      return { ...d, elements: arr };
    });

  const projectTexts = (): Partial<TemplateText> => ({
    title: mainDoc?.title || project.name.replace(/^SAMPLE\s*[—-]\s*/i, ""),
    subtitle: mainDoc?.data.subtitle || "",
    author: mainDoc?.data.author || kit?.authorName || "",
    tagline: kit?.tagline || "",
    brand: kit?.brandName || "",
  });

  // Keyboard shortcuts.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        history.redo();
        return;
      }
      if (!selected) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeEl(selected.id);
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateEl(selected.id);
      } else if (e.key === "Escape") setSelectedId(null);
      else if (e.key.startsWith("Arrow") && !selected.locked) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        updateEl(selected.id, { x: selected.x + dx, y: selected.y + dy }, "nudge");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onUpload = async (file: File) => {
    try {
      const stored = await storeImageUpload(file, project.id, "image");
      if (uploadTarget.current === "background") history.commit((d) => ({ ...d, backgroundImageFileId: stored.id }));
      else if (uploadTarget.current === "replace" && selected?.type === "image") updateEl(selected.id, { fileId: stored.id, source: "file" } as Partial<CoverElement>);
      else {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode().catch(() => undefined);
        const ratio = img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
        const w = data.width * 0.5;
        addEl(imageEl(file.name.replace(/\.[^.]+$/, ""), data.width * 0.25, data.height * 0.3, w, w * ratio, { fileId: stored.id }));
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const W = data.width;
  const H = data.height;
  const addButtons = [
    { label: "Heading", icon: <Heading />, make: () => textEl("Heading", W * 0.1, H * 0.4, W * 0.8, "Heading", { fontSize: Math.round(W / 11), fontFamily: kit?.headingFont ?? "montserrat", fill: "#ffffff" }) },
    { label: "Text", icon: <Type />, make: () => textEl("Text", W * 0.15, H * 0.55, W * 0.7, "Add your text", { fontSize: Math.round(W / 28), fontWeight: 500, fontFamily: kit?.bodyFont ?? "inter", fontRole: "body", fill: "#ffffff" }) },
    { label: "Rectangle", icon: <Square />, make: () => rectEl("Rectangle", W * 0.3, H * 0.3, W * 0.4, W * 0.25, solid(kit?.colors.accent ?? "#f5b544"), { cornerRadius: 0 }) },
    { label: "Circle", icon: <Circle />, make: () => ellipseEl("Circle", W * 0.35, H * 0.3, W * 0.3, W * 0.3, solid(kit?.colors.accent ?? "#f5b544")) },
    { label: "Line", icon: <Minus />, make: () => lineEl("Line", W * 0.3, H * 0.5, W * 0.4, "#ffffff", Math.max(4, Math.round(W / 200))) },
  ];

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0 lg:flex-row">
      {/* Left: add + layers (below the canvas on small screens) */}
      <aside className="order-3 flex w-full shrink-0 flex-col border-t bg-card lg:order-none lg:w-[220px] lg:border-t-0 lg:border-r">
        <div className="grid grid-cols-2 gap-1.5 border-b p-3">
          {addButtons.map((b) => (
            <Button key={b.label} size="sm" variant="outline" className="justify-start" onClick={() => addEl(b.make())} data-testid={`add-${b.label.toLowerCase()}`}>
              {b.icon} {b.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => {
              uploadTarget.current = "new";
              uploadRef.current?.click();
            }}
          >
            <ImagePlus /> Image
          </Button>
          <Tooltip content={kit?.logoFileId ? "Add the brand kit logo" : "Link a brand kit with a logo to use this"}>
            <span>
              <Button size="sm" variant="outline" className="w-full justify-start" disabled={!kit?.logoFileId} onClick={async () => {
                  // Keep the logo's own proportions.
                  const img = await loadFileImage(kit?.logoFileId).catch(() => null);
                  const ratio = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
                  const w = ratio > 1 ? (W * 0.14) / ratio : W * 0.14;
                  const h = w * ratio;
                  addEl(imageEl("Brand logo", W * 0.92 - w, H * 0.97 - h - W * 0.04, w, h, { source: "brand-logo" }));
                }}>
                <Stamp /> Logo
              </Button>
            </span>
          </Tooltip>
        </div>
        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Layers</p>
        <ul className="plr-scroll max-h-64 min-h-0 flex-1 overflow-y-auto px-2 pb-3 lg:max-h-none" data-testid="cover-layers">
          {[...data.elements].reverse().map((el) => (
            <li key={el.id} className={cn("group flex items-center gap-1 rounded-md px-1.5 py-1", el.id === selectedId ? "bg-primary-soft" : "hover:bg-secondary")}>
              <button type="button" onClick={() => setSelectedId(el.id)} className="min-w-0 flex-1 truncate text-left text-[12.5px]">
                {el.name}
              </button>
              <button type="button" onClick={() => updateEl(el.id, { visible: !el.visible })} className="text-muted-foreground opacity-60 hover:opacity-100" aria-label={el.visible ? "Hide" : "Show"}>
                {el.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </button>
              <button type="button" onClick={() => updateEl(el.id, { locked: !el.locked })} className="text-muted-foreground opacity-60 hover:opacity-100" aria-label={el.locked ? "Unlock" : "Lock"}>
                {el.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Centre: canvas */}
      <section className="order-1 flex h-[62dvh] min-w-0 shrink-0 flex-col lg:order-none lg:h-auto lg:flex-1 lg:shrink">
        <div className="flex h-11 shrink-0 items-center gap-1 border-b bg-card px-2">
          <Tooltip content="Undo" shortcut="Ctrl+Z">
            <Button variant="ghost" size="icon-xs" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo" data-testid="cover-undo">
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip content="Redo" shortcut="Ctrl+Shift+Z">
            <Button variant="ghost" size="icon-xs" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo">
              <Redo2 />
            </Button>
          </Tooltip>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button variant="ghost" size="icon-xs" onClick={() => setZoom(Math.max(0.05, scale / 1.25))} aria-label="Zoom out">
            <ZoomOut />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon-xs" onClick={() => setZoom(Math.min(2, scale * 1.25))} aria-label="Zoom in">
            <ZoomIn />
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setZoom(null)}>
            <Maximize /> Fit
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {data.width} × {data.height}px
          </span>
        </div>
        <div ref={wrapRef} className="plr-scroll relative min-h-0 flex-1 overflow-auto bg-[repeating-conic-gradient(#eceef3_0_25%,#f6f7f9_0_50%)] bg-[length:24px_24px]">
          <div className="flex min-h-full min-w-full items-center justify-center p-6" style={{ width: zoom ? data.width * scale + 48 : undefined, height: zoom ? data.height * scale + 48 : undefined }}>
            <div className="shadow-[0_12px_40px_rgba(15,18,34,0.25)]" key={fontsReady} data-testid="cover-stage">
              <CoverCanvas data={data} scale={scale} images={images} logo={logo} selectedId={selectedId} onSelect={setSelectedId} onChange={(id, patch) => updateEl(id, patch)} stageRef={stageRef} />
            </div>
          </div>
        </div>
      </section>

      {/* Right: properties */}
      <aside className="plr-scroll order-2 w-full shrink-0 border-t bg-card lg:order-none lg:w-[300px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
        {selected ? (
          <div className="grid gap-3 p-3">
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="capitalize">
                {selected.type === "rect" ? "rectangle" : selected.type === "ellipse" ? "circle" : selected.type}
              </Badge>
              <div className="ml-auto flex gap-0.5">
                <Tooltip content="Bring forward"><Button size="icon-xs" variant="ghost" onClick={() => reorder(selected.id, "up")} aria-label="Bring forward"><ArrowUp /></Button></Tooltip>
                <Tooltip content="Send backward"><Button size="icon-xs" variant="ghost" onClick={() => reorder(selected.id, "down")} aria-label="Send backward"><ArrowDown /></Button></Tooltip>
                <Tooltip content="Bring to front"><Button size="icon-xs" variant="ghost" onClick={() => reorder(selected.id, "top")} aria-label="Bring to front"><ArrowUpToLine /></Button></Tooltip>
                <Tooltip content="Send to back"><Button size="icon-xs" variant="ghost" onClick={() => reorder(selected.id, "bottom")} aria-label="Send to back"><ArrowDownToLine /></Button></Tooltip>
                <Tooltip content="Duplicate" shortcut="Ctrl+D"><Button size="icon-xs" variant="ghost" onClick={() => duplicateEl(selected.id)} aria-label="Duplicate"><Copy /></Button></Tooltip>
                <Tooltip content="Delete" shortcut="Del"><Button size="icon-xs" variant="ghost" onClick={() => removeEl(selected.id)} aria-label="Delete element" data-testid="cover-delete"><Trash2 /></Button></Tooltip>
              </div>
            </div>
            <ElementPanel
              el={selected}
              update={(p, k) => updateEl(selected.id, p, k)}
              swatches={swatches}
              onUpload={() => {
                uploadTarget.current = "replace";
                uploadRef.current?.click();
              }}
            />
          </div>
        ) : (
          <Tabs defaultValue="canvas" className="p-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
              <TabsTrigger value="brand">Brand</TabsTrigger>
            </TabsList>
            <TabsContent value="canvas" className="mt-3 grid gap-4">
              <Field label="Size">
                <NativeSelect
                  value={COVER_SIZES.find((s) => s.w === data.width && s.h === data.height)?.id ?? "custom"}
                  onChange={(e) => {
                    const s = COVER_SIZES.find((x) => x.id === e.target.value);
                    if (!s) return;
                    const fx = s.w / data.width;
                    const fy = s.h / data.height;
                    const f = Math.min(fx, fy);
                    history.commit((d) => ({
                      ...d,
                      width: s.w,
                      height: s.h,
                      category: s.category === "custom" ? d.category : s.category,
                      elements: d.elements.map((el) => ({ ...el, x: el.x * fx, y: el.y * fy, ...("width" in el ? { width: el.width * f } : {}), ...("height" in el ? { height: (el as { height: number }).height * f } : {}), ...(el.type === "text" ? { fontSize: Math.round(el.fontSize * f) } : {}) }) as CoverElement),
                    }));
                  }}
                >
                  {COVER_SIZES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                  <option value="custom" disabled>
                    Custom ({data.width} × {data.height})
                  </option>
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Width (px)" value={data.width} min={200} max={6000} onChange={(v) => history.commit((d) => ({ ...d, width: Math.max(200, Math.min(6000, Math.round(v))) }), "cw")} />
                <NumberField label="Height (px)" value={data.height} min={200} max={6000} onChange={(v) => history.commit((d) => ({ ...d, height: Math.max(200, Math.min(6000, Math.round(v))) }), "ch")} />
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium">Background</p>
                <FillEditor value={data.background} onChange={(f) => history.commit((d) => ({ ...d, background: f }), "bg")} swatches={swatches} />
              </div>
              <div className="grid gap-2">
                <p className="text-[13px] font-medium">Background image</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      uploadTarget.current = "background";
                      uploadRef.current?.click();
                    }}
                  >
                    <ImagePlus /> {data.backgroundImageFileId ? "Replace" : "Upload"}
                  </Button>
                  {data.backgroundImageFileId && (
                    <Button size="sm" variant="ghost" onClick={() => history.commit((d) => ({ ...d, backgroundImageFileId: null }))}>
                      Remove
                    </Button>
                  )}
                </div>
                {data.backgroundImageFileId && (
                  <div className="grid gap-1">
                    <Label className="text-[11px] text-muted-foreground">Image opacity {Math.round(data.backgroundImageOpacity * 100)}%</Label>
                    <Slider value={[data.backgroundImageOpacity * 100]} min={0} max={100} onValueChange={([v]) => history.commit((d) => ({ ...d, backgroundImageOpacity: v / 100 }), "bgo")} />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Click an element on the cover to edit it. Drag to move (snaps to centre and edges), use the handles to resize and rotate.</p>
            </TabsContent>
            <TabsContent value="brand" className="mt-3 grid gap-4">
              <div className="grid gap-2">
                <p className="text-[13px] font-medium">Fill text from project</p>
                <p className="text-xs text-muted-foreground">Updates linked text (title, subtitle, author, tagline, brand) from the main document and brand kit.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    history.commit((d) => fillBoundText(d, projectTexts()));
                    toast.success("Linked text updated");
                  }}
                  data-testid="fill-from-project"
                >
                  <Wand2 /> Fill from project
                </Button>
              </div>
              <Separator />
              <div className="grid gap-2">
                <p className="text-[13px] font-medium">Apply a brand kit</p>
                <p className="text-xs text-muted-foreground">Recolours brand-linked elements and swaps heading/body fonts.</p>
                {kits?.length ? (
                  kits.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => {
                        history.commit((d) => applyPalette(d, k.colors, { heading: k.headingFont, body: k.bodyFont }));
                        toast.success(`Applied ${k.name}`);
                      }}
                      className="flex items-center gap-2 rounded-lg border p-2 text-left text-sm hover:bg-secondary"
                    >
                      <span className="flex overflow-hidden rounded">
                        {(["primary", "secondary", "accent"] as const).map((c) => (
                          <span key={c} className="size-5" style={{ background: k.colors[c] }} />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{k.name}</span>
                      {k.id === project.brandKitId && <Badge>Project</Badge>}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No brand kits yet.</p>
                )}
              </div>
              <Separator />
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await updateProject(project.id, { coverAssetId: editor.asset!.id });
                  toast.success("Set as the project's main cover");
                }}
              >
                <Palette /> Set as project&apos;s main cover
              </Button>
              <Button
                size="sm"
                variant="soft"
                onClick={async () => {
                  await editor.save();
                  const m = await createAsset(project.id, "mockup", { title: `${editor.title} mockup`, data: { kind: "ebook-3d", sources: [{ id: uid("src"), kind: "cover", refId: editor.asset!.id }] }, sourceAssetIds: [editor.asset!.id] });
                  router.push(`/mockups?id=${m.id}`);
                }}
                data-testid="open-in-mockup"
              >
                <Boxes /> Create a mockup from this cover
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </aside>
      <input
        ref={uploadRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onUpload(f);
        }}
      />
    </div>
  );
}
