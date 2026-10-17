"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, BookImage, Boxes, ImagePlus, Laptop, Layers, NotebookPen, Plus, RotateCcw, Square, Tablet, Trash2, BookOpen, Package, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import type { Asset, BrandKit, Project } from "@/lib/data/types";
import type { Fill, MockupData, MockupKind, MockupSource } from "@/lib/models/design";
import { defaultMockupData, linear, solid } from "@/lib/models/design";
import { defaultAngleFor, FLAT_KINDS, renderMockup, sourcesNeeded, type MockupSourceImage } from "@/lib/mockups/render";
import { storeImageUpload, fileObjectUrl } from "@/lib/services/files";
import { loadSourceImage } from "@/lib/mockups/sources";
import { exportMockup } from "@/lib/mockups/export";
import { createAsset } from "@/lib/services/assets";
import { useAssets, useBrandKit } from "@/lib/data/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Field, Input, Label, NativeSelect, Separator, Slider, Spinner, Switch } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from "@/components/ui/overlays";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import { ColorField, FillEditor, FontSelect } from "@/components/common/design-fields";
import { ensureFontLoaded } from "@/lib/fonts";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage, uid } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Catalogue                                                            */
/* ------------------------------------------------------------------ */
export const MOCKUP_KINDS: { kind: MockupKind; label: string; hint: string; icon: React.ReactNode }[] = [
  { kind: "ebook-3d", label: "3D ebook", hint: "Hardcover-style book with spine", icon: <BookOpen /> },
  { kind: "flat", label: "Flat cover", hint: "Straight cover with shadow", icon: <Square /> },
  { kind: "paperback", label: "Paperback", hint: "Cover with visible page block", icon: <BookImage /> },
  { kind: "workbook", label: "Workbook", hint: "Spiral-bound with stacked pages", icon: <NotebookPen /> },
  { kind: "tablet", label: "Tablet", hint: "Cover on a tablet screen", icon: <Tablet /> },
  { kind: "laptop", label: "Laptop", hint: "Cover or course image on a laptop", icon: <Laptop /> },
  { kind: "bundle", label: "Product bundle", hint: "3–5 books fanned out together", icon: <Package /> },
  { kind: "course-bundle", label: "Course bundle", hint: "Laptop, tablet and book together", icon: <GraduationCap /> },
];
const KIND_LABEL = Object.fromEntries(MOCKUP_KINDS.map((k) => [k.kind, k.label])) as Record<MockupKind, string>;

const CANVAS_SIZES = [
  { id: "landscape", label: "Landscape 4:3 (1600 × 1200)", w: 1600, h: 1200 },
  { id: "wide", label: "Wide 16:9 (1920 × 1080)", w: 1920, h: 1080 },
  { id: "square", label: "Square (1400 × 1400)", w: 1400, h: 1400 },
  { id: "portrait", label: "Portrait 4:5 (1200 × 1500)", w: 1200, h: 1500 },
  { id: "banner", label: "Sales page banner (2400 × 1000)", w: 2400, h: 1000 },
];

const BACKGROUND_PRESETS: { label: string; fill: Fill | { kind: "transparent" } }[] = [
  { label: "Soft lavender", fill: linear(135, "#eef0ff", "#f8fafc") },
  { label: "White", fill: solid("#ffffff") },
  { label: "Studio grey", fill: { kind: "radial", stops: [{ offset: 0, color: "#ffffff" }, { offset: 1, color: "#d9dce3" }] } },
  { label: "Warm sand", fill: linear(160, "#fff7ed", "#fde7c7") },
  { label: "Mint", fill: linear(150, "#ecfdf5", "#d1fae5") },
  { label: "Navy night", fill: { kind: "radial", stops: [{ offset: 0, color: "#1e2a4a" }, { offset: 1, color: "#0b1122" }] } },
  { label: "Indigo glow", fill: linear(140, "#312e81", "#5b4df5") },
  { label: "Transparent", fill: { kind: "transparent" } },
];

const bgCss = (f: MockupData["background"]) => {
  if (f.kind === "transparent") return "repeating-conic-gradient(#e5e7eb 0 25%, #fff 0 50%) 0 0 / 12px 12px";
  if (f.kind === "solid") return f.color;
  const stops = f.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ");
  return f.kind === "linear" ? `linear-gradient(${f.angle}deg, ${stops})` : `radial-gradient(circle, ${stops})`;
};

/* ------------------------------------------------------------------ */
/* Source loading                                                       */
/* ------------------------------------------------------------------ */
interface ResolvedSource {
  source: MockupSource;
  image: MockupSourceImage | null;
  label: string;
  missing: boolean;
}

function useResolvedSources(sources: MockupSource[], covers: Asset<"cover">[] | undefined, kit: BrandKit | null, targetHeight: number) {
  const [resolved, setResolved] = React.useState<ResolvedSource[] | null>(null);
  const coverMap = React.useMemo(() => new Map((covers ?? []).map((c) => [c.id, c])), [covers]);
  const sig = JSON.stringify(sources.map((s) => [s.id, s.kind, s.refId, coverMap.get(s.refId)?.updatedAt ?? ""])) + `|${targetHeight}|${kit?.logoFileId ?? ""}|${covers ? 1 : 0}`;
  React.useEffect(() => {
    if (!covers) return;
    let active = true;
    Promise.all(
      sources.map(async (s): Promise<ResolvedSource> => {
        const cover = s.kind === "cover" ? coverMap.get(s.refId) : undefined;
        const image = await loadSourceImage(s, cover, kit?.logoFileId ?? null, targetHeight);
        return { source: s, image, label: s.kind === "cover" ? (cover?.title ?? "Missing cover") : "Uploaded image", missing: !image };
      }),
    ).then((r) => active && setResolved(r));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return resolved;
}

/* ------------------------------------------------------------------ */
/* Source picker dialog                                                 */
/* ------------------------------------------------------------------ */
function CoverThumb({ cover }: { cover: Asset<"cover"> }) {
  return cover.data.thumbnail ? <img src={cover.data.thumbnail} alt="" className="h-full w-auto rounded shadow" /> : <BookImage className="size-6 text-muted-foreground" />;
}

function FileThumb({ fileId }: { fileId: string }) {
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true;
    fileObjectUrl(fileId).then((u) => active && setSrc(u));
    return () => {
      active = false;
    };
  }, [fileId]);
  return src ? <img src={src} alt="" className="h-full w-auto rounded shadow" /> : <ImagePlus className="size-6 text-muted-foreground" />;
}

function AddSourceDialog({ project, open, onOpenChange, onAdd }: { project: Project; open: boolean; onOpenChange: (o: boolean) => void; onAdd: (s: MockupSource[]) => void }) {
  const { data: covers } = useAssets<"cover">(project.id, "cover");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (open) setPicked([]);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add covers or images</DialogTitle>
          <DialogDescription>Covers are rendered live from Cover Creator, so later edits to a cover flow into this mockup automatically.</DialogDescription>
        </DialogHeader>
        {covers?.length ? (
          <div className="grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-4" data-testid="mockup-cover-picker">
            {covers.map((c) => {
              const on = picked.includes(c.id);
              return (
                <button key={c.id} type="button" onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))} className={cn("grid gap-1.5 rounded-xl border p-2 text-left transition", on ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50")}>
                  <span className="flex h-36 items-center justify-center rounded-lg bg-secondary/60 p-2">
                    <CoverThumb cover={c} />
                  </span>
                  <span className="truncate text-xs font-medium">{c.title}</span>
                  {on && <Badge className="w-fit">#{picked.indexOf(c.id) + 1}</Badge>}
                </button>
              );
            })}
          </div>
        ) : (
          <Callout tone="info" title="No covers in this project yet">
            Design one in <Link href="/covers" className="font-medium text-primary underline">Cover Creator</Link>, or upload a finished cover image below.
          </Callout>
        )}
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>
            <ImagePlus /> Upload image
          </Button>
          <Button
            disabled={!picked.length}
            onClick={() => {
              onAdd(picked.map((id) => ({ id: uid("src"), kind: "cover", refId: id })));
              onOpenChange(false);
            }}
            data-testid="mockup-add-selected"
          >
            Add {picked.length || ""} {picked.length === 1 ? "cover" : "covers"}
          </Button>
        </DialogFooter>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploading(true);
            try {
              const stored = await storeImageUpload(f, project.id);
              onAdd([{ id: uid("src"), kind: "file", refId: stored.id }]);
              onOpenChange(false);
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setUploading(false);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* New mockup dialog                                                    */
/* ------------------------------------------------------------------ */
function NewMockupDialog({ project, open, onOpenChange, onCreated }: { project: Project; open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { data: covers } = useAssets<"cover">(project.id, "cover");
  const [kind, setKind] = React.useState<MockupKind>("ebook-3d");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setPicked(project.coverAssetId ? [project.coverAssetId] : covers?.[0] ? [covers[0].id] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const create = async () => {
    setBusy(true);
    try {
      const data = defaultMockupData({ kind, sources: picked.map((id) => ({ id: uid("src"), kind: "cover" as const, refId: id })) });
      data.layout.angle = defaultAngleFor(kind);
      const first = covers?.find((c) => c.id === picked[0]);
      const a = await createAsset(project.id, "mockup", { title: `${first?.title.split(" — ")[0] ?? project.name} — ${KIND_LABEL[kind]}`, data, sourceAssetIds: picked });
      onOpenChange(false);
      onCreated(a.id);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const need = sourcesNeeded(kind);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>New mockup</DialogTitle>
          <DialogDescription>Choose a mockup style and the covers to show. You can change both later.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="mockup-kinds">
          {MOCKUP_KINDS.map((k) => (
            <button key={k.kind} type="button" onClick={() => setKind(k.kind)} className={cn("grid gap-1 rounded-xl border p-3 text-left transition [&_svg]:size-5", kind === k.kind ? "border-primary bg-primary-soft" : "hover:border-primary/50")}>
              <span className="text-primary">{k.icon}</span>
              <span className="text-sm font-semibold">{k.label}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{k.hint}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium">
            Covers {need > 1 && <span className="font-normal text-muted-foreground">— this style shows up to {need}; pick them in order (fewer are repeated)</span>}
          </p>
          {covers?.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {covers.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : need === 1 ? [c.id] : [...p, c.id].slice(0, need)))}
                    className={cn("relative flex h-28 w-20 shrink-0 items-center justify-center rounded-lg border bg-secondary/50 p-1.5", on ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50")}
                    title={c.title}
                  >
                    <CoverThumb cover={c} />
                    {on && <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{picked.indexOf(c.id) + 1}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No covers yet — you can upload a cover image inside the mockup editor, or design one in Cover Creator first.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void create()} loading={busy} data-testid="mockup-create">
            Create mockup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */
function SliderRow({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-[12px]">
        <Label className="text-[12px] font-normal text-muted-foreground">{label}</Label>
        <span className="tabular-nums text-muted-foreground">{format ? format(value) : value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  );
}

export function MockupEditor({ editor, project }: { editor: AssetEditor<"mockup">; project: Project }) {
  const data = editor.data!;
  const { data: covers } = useAssets<"cover">(project.id, "cover");
  const { data: kit } = useBrandKit(project.brandKitId);
  const [addOpen, setAddOpen] = React.useState(false);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const PREVIEW_SCALE = 0.5;
  const resolved = useResolvedSources(data.sources, covers, kit ?? null, Math.round(data.canvas.height * PREVIEW_SCALE * 0.9 * Math.max(1, data.layout.scale)));
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [fontTick, setFontTick] = React.useState(0);
  const captionFont = data.caption.enabled && data.caption.text ? (data.caption.font ?? "montserrat") : null;
  React.useEffect(() => {
    if (!captionFont) return;
    let active = true;
    ensureFontLoaded(captionFont, 700)
      .then(() => active && setFontTick((n) => n + 1))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [captionFont]);

  const set = (fn: (d: MockupData) => MockupData) => editor.update(fn);
  const setLayout = (patch: Partial<MockupData["layout"]>) => set((d) => ({ ...d, layout: { ...d.layout, ...patch } }));
  const setShadow = (patch: Partial<MockupData["shadow"]>) => set((d) => ({ ...d, shadow: { ...d.shadow, ...patch } }));
  const setCaption = (patch: Partial<MockupData["caption"]>) => set((d) => ({ ...d, caption: { ...d.caption, ...patch } }));

  // Live preview: re-render whenever the design or the source images change.
  const designSig = React.useMemo(() => JSON.stringify({ ...data, thumbnail: null, thumbnailKey: null }), [data]);
  React.useEffect(() => {
    if (!resolved) return;
    const images = resolved.map((r) => r.image).filter((x): x is MockupSourceImage => !!x);
    const raf = requestAnimationFrame(() => {
      const canvas = renderMockup(data, images, { scale: PREVIEW_SCALE });
      setPreviewUrl(canvas.toDataURL("image/png"));
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designSig, resolved, fontTick]);

  // List thumbnail, regenerated after edits settle (skipped on open when one already exists).
  const sourceSig = data.sources.map((s) => covers?.find((c) => c.id === s.refId)?.updatedAt ?? s.refId).join("|");
  const thumbKey = `${designSig}#${sourceSig}`;
  const thumbSig = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!resolved || !covers) return;
    if (thumbSig.current === null && data.thumbnail) {
      // First load with an existing thumbnail: only regenerate if a source changed since it was made.
      thumbSig.current = data.thumbnailKey === thumbKey ? thumbKey : "";
    }
    if (thumbSig.current === thumbKey) return;
    const t = setTimeout(() => {
      const images = resolved.map((r) => r.image).filter((x): x is MockupSourceImage => !!x);
      if (!images.length) return;
      const c = renderMockup(data, images, { scale: 360 / data.canvas.width });
      const flat = document.createElement("canvas");
      flat.width = c.width;
      flat.height = c.height;
      const fctx = flat.getContext("2d")!;
      fctx.fillStyle = "#ffffff";
      fctx.fillRect(0, 0, c.width, c.height);
      fctx.drawImage(c, 0, 0);
      thumbSig.current = thumbKey;
      editor.update((d) => ({ ...d, thumbnail: flat.toDataURL("image/jpeg", 0.82), thumbnailKey: thumbKey }));
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbKey, resolved]);

  const changeKind = (kind: MockupKind) =>
    set((d) => ({ ...d, kind, layout: { ...d.layout, angle: defaultAngleFor(kind) } }));
  const moveSource = (i: number, dir: -1 | 1) =>
    set((d) => {
      const s = [...d.sources];
      const j = i + dir;
      if (j < 0 || j >= s.length) return d;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...d, sources: s };
    });

  const isFlat = FLAT_KINDS.includes(data.kind);
  const hasBook = data.kind === "ebook-3d" || data.kind === "bundle" || data.kind === "course-bundle";
  const hasDevice = data.kind === "tablet" || data.kind === "laptop" || data.kind === "course-bundle";
  const multi = data.kind === "bundle" || data.kind === "course-bundle";
  const need = sourcesNeeded(data.kind);
  const missing = resolved?.filter((r) => r.missing) ?? [];
  const sizeId = CANVAS_SIZES.find((s) => s.w === data.canvas.width && s.h === data.canvas.height)?.id ?? "custom";

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0 lg:flex-row">
      {/* Left: type + sources */}
      <aside className="plr-scroll order-3 flex w-full shrink-0 flex-col border-t bg-card lg:order-none lg:w-[250px] lg:overflow-y-auto lg:border-t-0 lg:border-r">
        <p className="px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mockup type</p>
        <div className="grid grid-cols-2 gap-1.5 px-3" data-testid="mockup-kind-picker">
          {MOCKUP_KINDS.map((k) => (
            <Tooltip key={k.kind} content={k.hint}>
              <button
                type="button"
                onClick={() => changeKind(k.kind)}
                className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[12px] font-medium [&_svg]:size-4", data.kind === k.kind ? "border-primary bg-primary-soft text-primary" : "hover:bg-secondary")}
                data-testid={`kind-${k.kind}`}
              >
                {k.icon}
                <span className="truncate">{k.label}</span>
              </button>
            </Tooltip>
          ))}
        </div>
        <div className="mt-4 flex items-center px-3 pb-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {multi ? `Covers (${data.sources.length}/${need})` : "Cover"}
          </p>
          <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setAddOpen(true)} data-testid="mockup-add-source">
            <Plus /> Add
          </Button>
        </div>
        <ul className="grid gap-1.5 px-3 pb-3" data-testid="mockup-sources">
          {data.sources.map((s, i) => {
            const r = resolved?.find((x) => x.source.id === s.id);
            const cover = s.kind === "cover" ? covers?.find((c) => c.id === s.refId) : undefined;
            const unused = i >= need;
            return (
              <li key={s.id} className={cn("flex items-center gap-2 rounded-lg border p-1.5", unused && "opacity-50")}>
                <span className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-secondary">{cover ? <CoverThumb cover={cover} /> : s.kind === "file" ? <FileThumb fileId={s.refId} /> : <AlertTriangle className="size-4 text-warning" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium">{r?.label ?? (cover?.title || "Loading…")}</p>
                  <p className="text-[10.5px] text-muted-foreground">{r?.missing ? "Not found" : unused ? "Not shown in this style" : s.kind === "cover" ? "Live from Cover Creator" : "Uploaded image"}</p>
                </div>
                <div className="flex flex-col">
                  <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0} onClick={() => moveSource(i, -1)} aria-label="Move up">
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === data.sources.length - 1} onClick={() => moveSource(i, 1)} aria-label="Move down">
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
                <button type="button" onClick={() => set((d) => ({ ...d, sources: d.sources.filter((x) => x.id !== s.id) }))} className="text-muted-foreground hover:text-destructive" aria-label="Remove source">
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
          {!data.sources.length && (
            <li>
              <button type="button" onClick={() => setAddOpen(true)} className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground hover:border-primary hover:text-primary">
                <ImagePlus className="size-5" /> Add a cover or upload an image
              </button>
            </li>
          )}
        </ul>
        {multi && data.sources.length > 0 && data.sources.length < need && (
          <p className="px-3 pb-3 text-[11px] text-muted-foreground">Add up to {need} covers. With fewer, covers are repeated to fill the composition.</p>
        )}
        {missing.length > 0 && (
          <div className="px-3 pb-3">
            <Callout tone="warning">One or more sources could not be loaded (deleted or moved to the Trash). Remove them or restore the cover.</Callout>
          </div>
        )}
      </aside>

      {/* Centre: preview */}
      <section className="order-1 flex h-[62dvh] min-w-0 shrink-0 flex-col lg:order-none lg:h-auto lg:flex-1 lg:shrink">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-card px-3 text-xs text-muted-foreground">
          <Badge variant="secondary">{KIND_LABEL[data.kind]}</Badge>
          <span>
            {data.canvas.width} × {data.canvas.height}px
          </span>
          <span className="ml-auto hidden sm:inline">Preview at 50% — exports render at full resolution from the same composition.</span>
        </div>
        <div ref={previewRef} className="plr-scroll flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[repeating-conic-gradient(#eceef3_0_25%,#f6f7f9_0_50%)] bg-[length:24px_24px] p-6">
          {previewUrl ? (
            <img src={previewUrl} alt="Mockup preview" className="max-h-full max-w-full rounded-md shadow-[0_12px_40px_rgba(15,18,34,0.18)]" style={{ aspectRatio: `${data.canvas.width} / ${data.canvas.height}` }} data-testid="mockup-preview" />
          ) : (
            <Spinner className="text-muted-foreground" />
          )}
        </div>
      </section>

      {/* Right: settings */}
      <aside className="plr-scroll order-2 w-full shrink-0 border-t bg-card lg:order-none lg:w-[300px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
        <Tabs defaultValue="layout" className="p-3">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="scene">Scene</TabsTrigger>
            <TabsTrigger value="text">Caption</TabsTrigger>
          </TabsList>
          <TabsContent value="layout" className="mt-3 grid gap-3.5">
            <SliderRow label="Size" value={Math.round(data.layout.scale * 100)} min={40} max={135} onChange={(v) => setLayout({ scale: v / 100 })} format={(v) => `${v}%`} />
            <SliderRow label="Horizontal position" value={Math.round(data.layout.offsetX * 100)} min={-35} max={35} onChange={(v) => setLayout({ offsetX: v / 100 })} format={(v) => `${v > 0 ? "+" : ""}${v}`} />
            <SliderRow label="Vertical position" value={Math.round(data.layout.offsetY * 100)} min={-30} max={30} onChange={(v) => setLayout({ offsetY: v / 100 })} format={(v) => `${v > 0 ? "+" : ""}${v}`} />
            {data.kind !== "laptop" && (
              <SliderRow
                label={isFlat ? "Tilt" : "Turn angle"}
                value={data.layout.angle}
                min={isFlat ? -15 : 4}
                max={isFlat ? 15 : 45}
                onChange={(v) => setLayout({ angle: v })}
                format={(v) => `${v}°`}
              />
            )}
            {multi && <SliderRow label="Spacing" value={Math.round(data.layout.spacing * 100)} min={30} max={100} onChange={(v) => setLayout({ spacing: v / 100 })} format={(v) => `${v}%`} />}
            {hasBook && (
              <>
                <SliderRow label="Spine thickness" value={Math.round(data.layout.spineWidth * 100)} min={2} max={20} onChange={(v) => setLayout({ spineWidth: v / 100 })} format={(v) => `${v}%`} />
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[12px] font-normal text-muted-foreground">Spine colour</Label>
                    <label className="flex items-center gap-1.5 text-[12px]">
                      <Switch checked={data.layout.spineColor === null} onCheckedChange={(v) => setLayout({ spineColor: v ? null : (kit?.colors.dark ?? "#1e1b4b") })} /> Auto
                    </label>
                  </div>
                  {data.layout.spineColor !== null && <ColorField value={data.layout.spineColor} onChange={(c) => setLayout({ spineColor: c })} swatches={kit ? Object.values(kit.colors) : undefined} />}
                </div>
              </>
            )}
            {hasDevice && (
              <Field label="Device colour">
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1 text-xs">
                  {(["dark", "silver", "light"] as const).map((c) => (
                    <button key={c} type="button" onClick={() => setLayout({ deviceColor: c })} className={cn("rounded-md py-1 font-medium capitalize", data.layout.deviceColor === c ? "bg-card shadow-sm" : "text-muted-foreground")}>
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Button
              size="xs"
              variant="ghost"
              className="justify-self-start"
              onClick={() => set((d) => ({ ...d, layout: { ...defaultMockupData().layout, angle: defaultAngleFor(d.kind), spineColor: d.layout.spineColor, deviceColor: d.layout.deviceColor } }))}
            >
              <RotateCcw /> Reset layout
            </Button>
          </TabsContent>
          <TabsContent value="scene" className="mt-3 grid gap-3.5">
            <Field label="Canvas size">
              <NativeSelect value={sizeId} onChange={(e) => {
                const s = CANVAS_SIZES.find((x) => x.id === e.target.value);
                if (s) set((d) => ({ ...d, canvas: { width: s.w, height: s.h } }));
              }} data-testid="mockup-size">
                {CANVAS_SIZES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
                {sizeId === "custom" && <option value="custom">Custom</option>}
              </NativeSelect>
            </Field>
            <div className="grid gap-2">
              <p className="text-[13px] font-medium">Background</p>
              <div className="grid grid-cols-4 gap-1.5">
                {BACKGROUND_PRESETS.map((p) => (
                  <Tooltip key={p.label} content={p.label}>
                    <button type="button" onClick={() => set((d) => ({ ...d, background: p.fill }))} className="h-9 rounded-md border shadow-sm hover:ring-2 hover:ring-primary/30" style={{ background: bgCss(p.fill) }} aria-label={p.label} />
                  </Tooltip>
                ))}
              </div>
              {data.background.kind === "transparent" ? (
                <p className="text-xs text-muted-foreground">Transparent background — PNG exports keep transparency; JPG exports use white.</p>
              ) : (
                <FillEditor value={data.background} onChange={(f) => set((d) => ({ ...d, background: f }))} swatches={kit ? Object.values(kit.colors) : undefined} />
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium">Drop shadow</p>
              <Switch checked={data.shadow.enabled} onCheckedChange={(v) => setShadow({ enabled: v })} aria-label="Drop shadow" />
            </div>
            {data.shadow.enabled && (
              <>
                <SliderRow label="Softness" value={data.shadow.blur} min={0} max={120} onChange={(v) => setShadow({ blur: v })} />
                <SliderRow label="Strength" value={Math.round(data.shadow.opacity * 100)} min={0} max={90} onChange={(v) => setShadow({ opacity: v / 100 })} format={(v) => `${v}%`} />
                <SliderRow label="Offset X" value={data.shadow.offsetX} min={-80} max={80} onChange={(v) => setShadow({ offsetX: v })} />
                <SliderRow label="Offset Y" value={data.shadow.offsetY} min={-80} max={80} onChange={(v) => setShadow({ offsetY: v })} />
                <label className="flex items-center justify-between text-[13px]">
                  Floor shadow
                  <Switch checked={data.shadow.floor} onCheckedChange={(v) => setShadow({ floor: v })} disabled={data.layout.reflection} />
                </label>
              </>
            )}
            <label className="flex items-center justify-between text-[13px]">
              <span>
                Reflection
                <span className="block text-[11px] text-muted-foreground">Glossy floor reflection (replaces floor shadow)</span>
              </span>
              <Switch checked={data.layout.reflection} onCheckedChange={(v) => setLayout({ reflection: v })} data-testid="mockup-reflection" />
            </label>
          </TabsContent>
          <TabsContent value="text" className="mt-3 grid gap-3.5">
            <label className="flex items-center justify-between text-[13px]">
              Show caption
              <Switch checked={data.caption.enabled} onCheckedChange={(v) => setCaption({ enabled: v })} />
            </label>
            <Field label="Caption text">
              <Input value={data.caption.text} onChange={(e) => setCaption({ text: e.target.value, enabled: data.caption.enabled || !!e.target.value })} placeholder="e.g. The Complete Calm Productivity Bundle" />
            </Field>
            <FontSelect label="Font" value={data.caption.font ?? "montserrat"} onChange={(v) => setCaption({ font: v })} />
            <SliderRow label="Size" value={data.caption.size} min={20} max={120} onChange={(v) => setCaption({ size: v })} />
            <ColorField label="Colour" value={data.caption.color} onChange={(c) => setCaption({ color: c })} swatches={kit ? Object.values(kit.colors) : undefined} />
            <p className="text-xs text-muted-foreground">Captions use your own words only — no ratings, results or claims are added automatically.</p>
          </TabsContent>
        </Tabs>
      </aside>
      <AddSourceDialog project={project} open={addOpen} onOpenChange={setAddOpen} onAdd={(s) => set((d) => ({ ...d, sources: [...d.sources, ...s] }))} />
    </div>
  );
}

/** List preview: shows the stored thumbnail instantly, then a live render so cover edits are always reflected. */
function MockupListThumb({ mockup, covers, kit }: { mockup: Asset<"mockup">; covers: Asset<"cover">[] | undefined; kit: BrandKit | null }) {
  const resolved = useResolvedSources(mockup.data.sources, covers, kit, 320);
  const [src, setSrc] = React.useState<string | null>(mockup.data.thumbnail);
  React.useEffect(() => {
    if (!resolved) return;
    const images = resolved.map((r) => r.image).filter((x): x is MockupSourceImage => !!x);
    if (!images.length) return;
    setSrc(renderMockup(mockup.data, images, { scale: 360 / mockup.data.canvas.width }).toDataURL("image/png"));
  }, [resolved, mockup.data]);
  return src ? <img src={src} alt="" className="h-full w-auto rounded" /> : <Layers className="size-8 text-muted-foreground" />;
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */
export function MockupStudio({ project }: { project: Project }) {
  const { data: covers } = useAssets<"cover">(project.id, "cover");
  const { data: kit } = useBrandKit(project.brandKitId);
  return (
    <AssetWorkspace
      project={project}
      type="mockup"
      tool="Mockup Studio"
      eyebrow="Design Studio"
      icon={<Boxes />}
      description="Turn your covers into 3D ebooks, paperbacks, workbooks, device screens and bundle images for sales pages and social posts. Everything renders in your browser from your real covers."
      createLabel="New mockup"
      createDialog={(p) => <NewMockupDialog project={project} {...p} />}
      itemMeta={(a) => `${KIND_LABEL[a.data.kind]} · ${a.data.canvas.width} × ${a.data.canvas.height}`}
      itemPreview={(a) => (
        <div className="flex h-44 items-center justify-center p-2">
          <MockupListThumb mockup={a} covers={covers} kit={kit ?? null} />
        </div>
      )}
      fullHeight
      renderEditor={(editor) => <MockupEditor editor={editor} project={project} />}
      versionPreview={(d) => {
        const data = d as { thumbnail?: string | null };
        return data.thumbnail ? <img src={data.thumbnail} alt="Version preview" className="mx-auto max-h-[50vh] rounded shadow" /> : <p className="text-sm text-muted-foreground">No preview stored for this version.</p>;
      }}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "png", label: "PNG (full resolution)", run: () => exportMockup(editor.getData()!, covers ?? [], kit ?? null, editor.title, "png", 1) },
            { id: "png-2x", label: "PNG (2× for retina)", run: () => exportMockup(editor.getData()!, covers ?? [], kit ?? null, editor.title, "png", 2) },
            { id: "jpg", label: "JPG (full resolution)", run: () => exportMockup(editor.getData()!, covers ?? [], kit ?? null, editor.title, "jpg", 1) },
          ]}
        />
      )}
    />
  );
}
