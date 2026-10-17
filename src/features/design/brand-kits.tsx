"use client";

import * as React from "react";
import { ArrowLeft, Check, Copy, ImagePlus, Link2, Palette, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { BrandKit } from "@/lib/data/types";
import { useActiveProject, useBrandKit, useBrandKits, useFileUrl, useProjects } from "@/lib/data/hooks";
import { createBrandKit, deleteBrandKit, duplicateBrandKit, updateBrandKit } from "@/lib/services/brand-kits";
import { storeImageUpload } from "@/lib/services/files";
import { updateProject } from "@/lib/services/projects";
import { fontCss, fontById } from "@/lib/fonts";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Field, Input, PageContainer, PageHeader, Spinner, Textarea } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm";
import { ColorField, FontSelect } from "@/components/common/design-fields";
import { SaveStatus, type SaveState } from "@/components/common/save-status";
import { useAssetParam } from "@/components/common/asset-workspace";
import { useBreadcrumb } from "@/components/shell/app-shell";
import { cn, errorMessage, timeAgo } from "@/lib/utils";

function KitLogo({ kit, className }: { kit: BrandKit; className?: string }) {
  const url = useFileUrl(kit.logoFileId);
  if (url) return <img src={url} alt={`${kit.brandName || kit.name} logo`} className={cn("object-contain", className)} />;
  return (
    <span className={cn("flex items-center justify-center rounded-lg text-lg font-bold text-white", className)} style={{ background: kit.colors.primary, fontFamily: fontCss(kit.headingFont) }}>
      {(kit.brandName || kit.name).slice(0, 1).toUpperCase()}
    </span>
  );
}

function KitCard({ kit, onOpen, inUse }: { kit: BrandKit; onOpen: () => void; inUse: number }) {
  return (
    <Card className="group relative overflow-hidden transition hover:border-primary/40 hover:shadow-md">
      <button type="button" className="absolute inset-0 z-0" onClick={onOpen} aria-label={`Open ${kit.name}`} />
      <div className="flex h-16">
        {(["primary", "secondary", "accent", "dark", "light"] as const).map((k) => (
          <div key={k} className="flex-1" style={{ background: kit.colors[k] }} />
        ))}
      </div>
      <div className="pointer-events-none flex items-center gap-3 p-4">
        <KitLogo kit={kit} className="size-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{kit.name}</p>
          <p className="truncate text-sm" style={{ fontFamily: fontCss(kit.headingFont) }}>
            {kit.brandName || "Brand name not set"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {fontById(kit.headingFont).label} / {fontById(kit.bodyFont).label}
          </p>
        </div>
      </div>
      <div className="pointer-events-none flex items-center gap-2 px-4 pb-3">
        {kit.isSample && <Badge variant="sample">Sample</Badge>}
        {inUse > 0 && <Badge variant="secondary">Used by {inUse} project{inUse === 1 ? "" : "s"}</Badge>}
        <span className="ml-auto text-[11px] text-muted-foreground">Updated {timeAgo(kit.updatedAt)}</span>
      </div>
    </Card>
  );
}

function KitEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: stored, loading } = useBrandKit(id);
  const [kit, setKit] = React.useState<BrandKit | null>(null);
  const [save, setSave] = React.useState<SaveState>("saved");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = React.useRef<Partial<BrandKit>>({});
  const { project } = useActiveProject();
  const confirm = useConfirm();
  const fileRef = React.useRef<HTMLInputElement>(null);
  useBreadcrumb(kit?.name ?? null);

  React.useEffect(() => {
    if (stored && !kit) setKit(stored);
  }, [stored, kit]);

  const flush = React.useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    setSave("saving");
    try {
      await updateBrandKit(id, patch);
      setSave("saved");
    } catch (e) {
      setSave("error");
      toast.error(errorMessage(e));
    }
  }, [id]);

  React.useEffect(() => () => void flush(), [flush]);

  const set = (patch: Partial<BrandKit>) => {
    setKit((k) => (k ? { ...k, ...patch, colors: { ...k.colors, ...(patch.colors ?? {}) } } : k));
    // Callers always pass complete objects for nested fields (colors, palette).
    pending.current = { ...pending.current, ...patch };
    setSave("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  };

  if (loading && !kit) return <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</div>;
  if (!kit) return <PageContainer><EmptyState icon={<Palette />} title="Brand kit not found" action={<Button onClick={onBack}>Back</Button>} /></PageContainer>;

  const swatches = [kit.colors.primary, kit.colors.secondary, kit.colors.accent, kit.colors.dark, kit.colors.light, ...kit.palette];

  return (
    <PageContainer width="wide">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={async () => { await flush(); onBack(); }} aria-label="Back">
          <ArrowLeft />
        </Button>
        <input value={kit.name} onChange={(e) => set({ name: e.target.value })} className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xl font-semibold outline-none hover:border-border focus:border-primary" aria-label="Kit name" data-testid="kit-name" />
        <SaveStatus state={save} lastSavedAt={kit.updatedAt} onRetry={() => void flush()} />
        {project && (
          <Button
            variant={project.brandKitId === kit.id ? "soft" : "outline"}
            size="sm"
            onClick={async () => {
              await updateProject(project.id, { brandKitId: project.brandKitId === kit.id ? null : kit.id });
              toast.success(project.brandKitId === kit.id ? "Unlinked from project" : `Linked to ${project.name}`);
            }}
          >
            {project.brandKitId === kit.id ? <Check /> : <Link2 />} {project.brandKitId === kit.id ? "Used by active project" : "Use in active project"}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-6">
          <Card className="grid gap-4 p-5">
            <p className="text-sm font-semibold">Identity</p>
            <div className="flex flex-wrap items-center gap-4">
              <KitLogo kit={kit} className="size-20 rounded-xl border bg-white p-1" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImagePlus /> {kit.logoFileId ? "Replace logo" : "Upload logo"}
                </Button>
                {kit.logoFileId && (
                  <Button size="sm" variant="ghost" onClick={() => set({ logoFileId: null })}>
                    <X /> Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    const stored = await storeImageUpload(f, null, "logo");
                    set({ logoFileId: stored.id });
                    toast.success("Logo uploaded");
                  } catch (err) {
                    toast.error(errorMessage(err));
                  }
                }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand name" htmlFor="k-brand">
                <Input id="k-brand" value={kit.brandName} onChange={(e) => set({ brandName: e.target.value })} />
              </Field>
              <Field label="Tagline" htmlFor="k-tag" optional>
                <Input id="k-tag" value={kit.tagline} onChange={(e) => set({ tagline: e.target.value })} />
              </Field>
              <Field label="Author name" htmlFor="k-author">
                <Input id="k-author" value={kit.authorName} onChange={(e) => set({ authorName: e.target.value })} />
              </Field>
              <Field label="Website" htmlFor="k-web" optional>
                <Input id="k-web" value={kit.website} onChange={(e) => set({ website: e.target.value })} placeholder="example.com" />
              </Field>
              <Field label="Contact email" htmlFor="k-email" optional>
                <Input id="k-email" type="email" value={kit.email} onChange={(e) => set({ email: e.target.value })} />
              </Field>
            </div>
          </Card>
          <Card className="grid gap-4 p-5">
            <p className="text-sm font-semibold">Voice & positioning</p>
            <Field label="Brand voice" htmlFor="k-voice" hint="Used by the AI Writer, Rebrand Assistant and marketing tools.">
              <Textarea id="k-voice" value={kit.voice} onChange={(e) => set({ voice: e.target.value })} rows={3} placeholder="e.g. Warm, practical and encouraging. Short sentences. No hype." />
            </Field>
            <Field label="Product positioning" htmlFor="k-pos">
              <Textarea id="k-pos" value={kit.positioning} onChange={(e) => set({ positioning: e.target.value })} rows={3} />
            </Field>
            <Field label="Target audience" htmlFor="k-aud">
              <Textarea id="k-aud" value={kit.audience} onChange={(e) => set({ audience: e.target.value })} rows={2} />
            </Field>
            <Field label="Notes" htmlFor="k-notes" optional>
              <Textarea id="k-notes" value={kit.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
            </Field>
          </Card>
        </div>
        <div className="grid content-start gap-6">
          <Card className="grid gap-3 p-5">
            <p className="text-sm font-semibold">Colours</p>
            {(["primary", "secondary", "accent", "dark", "light"] as const).map((k) => (
              <ColorField key={k} label={k[0].toUpperCase() + k.slice(1)} value={kit.colors[k]} onChange={(c) => set({ colors: { ...kit.colors, [k]: c } })} />
            ))}
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Extra palette colours</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {kit.palette.map((c, i) => (
                  <span key={`${c}-${i}`} className="group relative">
                    <input type="color" value={c} onChange={(e) => set({ palette: kit.palette.map((x, j) => (j === i ? e.target.value : x)) })} className="size-8 cursor-pointer rounded-md border" aria-label={`Palette colour ${i + 1}`} />
                    <button type="button" onClick={() => set({ palette: kit.palette.filter((_, j) => j !== i) })} className="absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full bg-foreground text-background group-hover:flex" aria-label="Remove colour">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {kit.palette.length < 8 && (
                  <Button size="icon-sm" variant="outline" onClick={() => set({ palette: [...kit.palette, kit.colors.accent] })} aria-label="Add colour">
                    <Plus />
                  </Button>
                )}
              </div>
            </div>
          </Card>
          <Card className="grid gap-3 p-5">
            <p className="text-sm font-semibold">Fonts</p>
            <FontSelect id="k-hfont" label="Headings" value={kit.headingFont} onChange={(v) => set({ headingFont: v })} />
            <FontSelect id="k-bfont" label="Body text" value={kit.bodyFont} onChange={(v) => set({ bodyFont: v })} />
            <div className="rounded-xl border p-4" style={{ background: kit.colors.light }}>
              <p className="text-2xl font-bold leading-tight" style={{ fontFamily: fontCss(kit.headingFont), color: kit.colors.dark }}>
                {kit.brandName || "Your brand"}
              </p>
              <p className="mt-1 text-sm" style={{ fontFamily: fontCss(kit.bodyFont), color: kit.colors.dark }}>
                {kit.tagline || "A short tagline in your body font."}
              </p>
              <span className="mt-3 inline-block rounded-lg px-3 py-1.5 text-sm font-semibold text-white" style={{ background: kit.colors.primary, fontFamily: fontCss(kit.bodyFont) }}>
                Button
              </span>
              <span className="ml-2 inline-block size-4 rounded-full align-middle" style={{ background: kit.colors.accent }} />
            </div>
          </Card>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const c = await duplicateBrandKit(kit.id);
                toast.success("Brand kit duplicated");
                window.location.assign(`/brand-kits?id=${c.id}`);
              }}
            >
              <Copy /> Duplicate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={async () => {
                if (!(await confirm({ title: `Delete “${kit.name}”?`, description: "Projects using this kit will be unlinked. Designs keep their current colours.", confirmLabel: "Delete", destructive: true }))) return;
                const n = await deleteBrandKit(kit.id);
                toast.success(`Brand kit deleted${n ? ` and unlinked from ${n} project(s)` : ""}`);
                onBack();
              }}
            >
              <Trash2 /> Delete
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Swatches available in Cover Creator: {swatches.length} colours.</p>
        </div>
      </div>
    </PageContainer>
  );
}

export function BrandKits() {
  const [id, setId] = useAssetParam();
  const { data: kits, loading } = useBrandKits();
  const { data: projects } = useProjects({ includeArchived: true });
  if (id) return <KitEditor key={id} id={id} onBack={() => setId(null)} />;
  const create = async () => {
    const k = await createBrandKit({ name: "New brand kit" });
    setId(k.id);
  };
  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Design Studio"
        title="Brand Kits"
        description="Reusable brand profiles — logo, colours, fonts, author, website, voice, positioning and audience. Link a kit to a project and every tool picks it up: covers, mockups, sales pages, AI writing and rebrands."
        actions={
          <Button onClick={() => void create()} data-testid="create-kit">
            <Plus /> New brand kit
          </Button>
        }
      />
      {loading ? (
        <Spinner />
      ) : !kits?.length ? (
        <EmptyState icon={<Palette />} title="No brand kits yet" description="Create one for each brand or pen name you publish under." action={<Button onClick={() => void create()}><Plus /> New brand kit</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kits.map((k) => (
            <KitCard key={k.id} kit={k} onOpen={() => setId(k.id)} inUse={projects?.filter((p) => p.brandKitId === k.id).length ?? 0} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
