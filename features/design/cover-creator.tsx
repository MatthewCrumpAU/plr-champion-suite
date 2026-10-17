"use client";

import * as React from "react";
import { BookImage, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import type { Asset, BrandKit, Project } from "@/lib/data/types";
import type { CoverCategory } from "@/lib/models/design";
import { COVER_SIZES, COVER_TEMPLATES, blankCover, buildFromTemplate, type CoverTemplate, type TemplateText } from "@/lib/covers/templates";
import { coverThumbnail } from "@/lib/covers/render";
import { exportCover } from "@/lib/covers/export";
import { createAsset } from "@/lib/services/assets";
import { useAsset, useBrandKit } from "@/lib/data/hooks";
import { Button } from "@/components/ui/button";
import { Checkbox, NativeSelect, Spinner } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import { cn, errorMessage } from "@/lib/utils";
import { CoverEditor } from "./cover-editor";

const CATEGORY_LABELS: Record<CoverCategory, string> = { ebook: "Ebook", report: "Report", workbook: "Workbook", course: "Course", "lead-magnet": "Lead magnet", custom: "Custom" };

function useProjectTexts(project: Project, kit: BrandKit | null): TemplateText {
  const { data: mainDoc } = useAsset<"document">(project.mainDocumentId);
  return React.useMemo(
    () => ({
      title: mainDoc?.title || project.name.replace(/^SAMPLE\s*[—-]\s*/i, "") || "Your Product Title",
      subtitle: mainDoc?.data.subtitle || "A short subtitle that explains the promise",
      author: mainDoc?.data.author || kit?.authorName || "Author Name",
      tagline: kit?.tagline || "",
      brand: kit?.brandName || "",
    }),
    [mainDoc, project.name, kit],
  );
}

function TemplateThumb({ tpl, texts, kit, useKit }: { tpl: CoverTemplate; texts: TemplateText; kit: BrandKit | null; useKit: boolean }) {
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true;
    const data = buildFromTemplate(tpl, texts, useKit && kit ? { palette: kit.colors, heading: kit.headingFont, body: kit.bodyFont } : {});
    coverThumbnail(data, kit?.logoFileId ?? null, 220)
      .then((s) => active && setSrc(s))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [tpl, texts, kit, useKit]);
  return src ? <img src={src} alt={`${tpl.name} template`} className="h-full w-full object-contain" /> : <Spinner className="text-muted-foreground" />;
}

function TemplateGallery({ project, open, onOpenChange, onCreated }: { project: Project; open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { data: kit } = useBrandKit(project.brandKitId);
  const texts = useProjectTexts(project, kit ?? null);
  const [category, setCategory] = React.useState<CoverCategory>("ebook");
  const [useKit, setUseKit] = React.useState(true);
  const [blankSize, setBlankSize] = React.useState("ebook");
  const [busy, setBusy] = React.useState<string | null>(null);

  const create = async (tpl: CoverTemplate | null) => {
    setBusy(tpl?.id ?? "blank");
    try {
      const size = COVER_SIZES.find((s) => s.id === blankSize) ?? COVER_SIZES[0];
      const data = tpl ? buildFromTemplate(tpl, texts, useKit && kit ? { palette: kit.colors, heading: kit.headingFont, body: kit.bodyFont } : {}) : blankCover({ w: size.w, h: size.h }, size.category);
      const a = await createAsset(project.id, "cover", { title: `${texts.title} — ${tpl ? tpl.name : "cover"}`, data });
      onOpenChange(false);
      onCreated(a.id);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const list = COVER_TEMPLATES.filter((t) => t.category === category);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Choose a starting point</DialogTitle>
          <DialogDescription>Every template is fully editable — text, fonts, colours, shapes and images. Text is pre-filled from your project.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={category} onValueChange={(v) => setCategory(v as CoverCategory)}>
            <TabsList>
              {(["ebook", "report", "workbook", "course", "lead-magnet"] as CoverCategory[]).map((c) => (
                <TabsTrigger key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {kit && (
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Checkbox checked={useKit} onCheckedChange={(v) => setUseKit(!!v)} /> Use “{kit.name}” colours &amp; fonts
            </label>
          )}
        </div>
        <div className="grid max-h-[60vh] grid-cols-2 gap-4 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-4" data-testid="cover-templates">
          {list.map((t) => (
            <button key={t.id} type="button" onClick={() => void create(t)} disabled={!!busy} className={cn("group grid gap-2 rounded-xl border bg-card p-2 text-left transition hover:border-primary hover:shadow-md", busy === t.id && "opacity-60")}>
              <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-secondary">
                <TemplateThumb tpl={t} texts={texts} kit={kit ?? null} useKit={useKit} />
              </div>
              <span className="px-1 text-sm font-medium">{t.name}</span>
            </button>
          ))}
          <div className="grid content-start gap-2 rounded-xl border border-dashed p-3">
            <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
              <LayoutTemplate className="size-8" />
            </div>
            <NativeSelect value={blankSize} onChange={(e) => setBlankSize(e.target.value)} className="h-8 text-xs" aria-label="Blank canvas size">
              {COVER_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
            <Button size="sm" variant="outline" onClick={() => void create(null)} loading={busy === "blank"} data-testid="blank-cover">
              Blank canvas
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** List preview: stored thumbnail, or a one-off render for covers that do not have one yet (e.g. sample content). */
function CoverListThumb({ cover, logoFileId }: { cover: Asset<"cover">; logoFileId: string | null }) {
  const [src, setSrc] = React.useState<string | null>(cover.data.thumbnail);
  React.useEffect(() => {
    if (cover.data.thumbnail) return setSrc(cover.data.thumbnail);
    let active = true;
    coverThumbnail(cover.data, logoFileId)
      .then((t) => active && setSrc(t))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [cover.data, logoFileId]);
  return src ? <img src={src} alt="" className="h-full w-auto rounded shadow-md" /> : <Spinner className="text-muted-foreground" />;
}

function CoverEditorWithKit({ editor, project }: { editor: Parameters<typeof CoverEditor>[0]["editor"]; project: Project }) {
  const { data: kit } = useBrandKit(project.brandKitId);
  return <CoverEditor editor={editor} project={project} kit={kit ?? null} />;
}

export function CoverCreator({ project }: { project: Project }) {
  const { data: kit } = useBrandKit(project.brandKitId);
  return (
    <AssetWorkspace
      project={project}
      type="cover"
      tool="Cover Creator"
      eyebrow="Design Studio"
      icon={<BookImage />}
      description="Design ebook, report, workbook, course and lead magnet covers in the browser. Start from a template, customise every element, and export PNG, JPG or PDF at full resolution."
      createLabel="New cover"
      createDialog={(p) => <TemplateGallery project={project} {...p} />}
      itemMeta={(a) => `${CATEGORY_LABELS[a.data.category]} · ${a.data.width} × ${a.data.height}`}
      itemPreview={(a) => (
        <div className="flex h-48 items-center justify-center p-3">
          <CoverListThumb cover={a} logoFileId={kit?.logoFileId ?? null} />
        </div>
      )}
      fullHeight
      renderEditor={(editor) => <CoverEditorWithKit editor={editor} project={project} />}
      versionPreview={(d) => {
        const data = d as { thumbnail?: string | null; width: number; height: number };
        return data.thumbnail ? <img src={data.thumbnail} alt="Version preview" className="mx-auto max-h-[50vh] rounded shadow" /> : <p className="text-sm text-muted-foreground">No preview stored for this version.</p>;
      }}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "png", label: "PNG (full resolution)", run: () => exportCover(editor.getData()!, editor.title, "png", kit?.logoFileId ?? null) },
            { id: "jpg", label: "JPG (full resolution)", run: () => exportCover(editor.getData()!, editor.title, "jpg", kit?.logoFileId ?? null) },
            { id: "pdf", label: "PDF", run: () => exportCover(editor.getData()!, editor.title, "pdf", kit?.logoFileId ?? null) },
            { id: "png-2x", label: "PNG (2× for print)", run: () => exportCover(editor.getData()!, `${editor.title}@2x`, "png", kit?.logoFileId ?? null, 2) },
          ]}
        />
      )}
    />
  );
}
