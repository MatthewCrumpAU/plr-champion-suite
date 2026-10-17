"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Eye, FileText, ImagePlus, Rocket, ScanText, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, EmptyState, Field, Input, NativeSelect, PageContainer, Spinner, Switch, Textarea } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm";
import { FileDrop } from "@/components/common/file-drop";
import { SaveStatus } from "@/components/common/save-status";
import { importFile } from "@/lib/import";
import { useMemberLive } from "@/lib/membership/hooks";
import { addProductFile, defaultLicence, deleteProduct, duplicateProduct, removeGalleryImage, removeProductFile, saveProduct, setProductImage } from "@/lib/membership/catalog";
import { MAX_IMAGE_BYTES, MAX_PRODUCT_FILE_BYTES } from "@/lib/membership/files";
import {
  ACCESS_TIERS,
  ACCESS_TIER_LABELS,
  LICENCE_RIGHTS,
  LICENCE_TYPE_LABELS,
  PRODUCT_FILE_KIND_LABELS,
  PRODUCT_FORMAT_LABELS,
  PUBLISH_STATUS_LABELS,
  RIGHT_VALUE_LABELS,
  type AccessTier,
  type LicenceType,
  type Product,
  type ProductFileKind,
  type ProductFormat,
  type PublishStatus,
  type RightValue,
} from "@/lib/membership/types";
import { errorMessage, formatBytes, plural } from "@/lib/utils";
import { useCatalog, useMember } from "../member-context";
import { Markdown, ProductCover, StatusBadge, StoredImage } from "../ui";
import { AdminGate } from "./admin-gate";
import { useDraft } from "./use-draft";

export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function ProductEditor() {
  return (
    <AdminGate>
      <ProductEditorInner />
    </AdminGate>
  );
}

function ProductEditorInner() {
  const { productId } = useParams<{ productId: string }>();
  const { data: stored, loading } = useMemberLive((r) => r.products.get(productId), [productId]);
  const m = useMember();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  if (!stored || stored.brandId !== m.brandId) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<FileText />} title="Product not found" action={<Button asChild><Link href={m.adminHref("products")}>All products</Link></Button>} />
      </PageContainer>
    );
  }
  return <EditorForm key={stored.id} stored={stored} />;
}

function EditorForm({ stored }: { stored: Product }) {
  const m = useMember();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: catalog } = useCatalog();
  const { draft, update, flush, adopt, state, lastSavedAt } = useDraft<Product>(stored, (p) => saveProduct(p));
  const [preview, setPreview] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [slugTouched, setSlugTouched] = React.useState(stored.status !== "draft" || !stored.slug.startsWith("untitled-product"));
  const [highlights, setHighlights] = React.useState(stored.highlights.join("\n"));
  const [tags, setTags] = React.useState(stored.tags.join(", "));
  const licenceInput = React.useRef<HTMLInputElement>(null);

  if (!draft || !catalog) return null;
  const p = draft;

  /** Runs a storage operation on the latest saved copy, then adopts its result. */
  const op = async (label: string, fn: (latest: Product) => Promise<Product>) => {
    setBusy(label);
    try {
      const latest = (await flush()) ?? p;
      adopt(await fn(latest));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const detectLength = async (latest: Product, attId?: string) => {
    const att = latest.files.find((f) => (attId ? f.id === attId : f.editable && f.kind !== "licence"));
    if (!att) throw new Error("Add a DOCX, PDF, TXT, Markdown or HTML file first.");
    const { getMembershipRepos } = await import("@/lib/membership/db");
    const f = await getMembershipRepos().files.get(att.fileId);
    if (!f) throw new Error("The file is missing from storage.");
    const res = await importFile(new File([f.blob], att.name, { type: f.mime }));
    if (res.empty) throw new Error("No text could be read from that file.");
    return saveProduct({ ...latest, wordCount: res.wordCount, pageCount: res.pageCount ?? Math.max(1, Math.round(res.wordCount / 250)) });
  };

  const onFiles = (files: File[]) =>
    op("files", async (latest) => {
      let cur = latest;
      for (const f of files) {
        if (f.size > MAX_PRODUCT_FILE_BYTES) {
          toast.error(`${f.name} is larger than ${formatBytes(MAX_PRODUCT_FILE_BYTES)}.`);
          continue;
        }
        cur = await addProductFile(cur, f, f.name);
      }
      toast.success(`Added ${plural(files.length, "file")}`);
      const added = cur.files[cur.files.length - 1];
      if (cur.wordCount == null && added?.editable) {
        try {
          cur = await detectLength(cur, added.id);
        } catch {
          /* length is optional */
        }
      }
      return cur;
    });

  const onImage = (slot: "cover" | "gallery") => (files: File[]) =>
    op(slot, async (latest) => {
      let cur = latest;
      for (const f of files) {
        if (!f.type.startsWith("image/")) {
          toast.error(`${f.name} isn't an image.`);
          continue;
        }
        if (f.size > MAX_IMAGE_BYTES) {
          toast.error(`${f.name} is larger than ${formatBytes(MAX_IMAGE_BYTES)}.`);
          continue;
        }
        cur = await setProductImage(cur, slot, f, f.name);
      }
      return cur;
    });

  const publishNow = () => {
    update({ status: "published", publishAt: p.publishAt && new Date(p.publishAt) <= new Date() ? p.publishAt : new Date().toISOString() });
    toast.success("Published — members can see it now");
  };

  const problems = [!p.coverFileId && "a cover image", !p.files.length && "at least one file", !p.categoryIds.length && "a category", !p.description.trim() && "a description"].filter(Boolean) as string[];

  return (
    <PageContainer width="wide">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={m.adminHref("products")}>
            <ArrowLeft /> Products
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">{p.title || "Untitled product"}</h1>
            <StatusBadge status={p.status} publishAt={p.publishAt} />
            {p.isSample && <Badge variant="sample">Sample</Badge>}
          </div>
        </div>
        <SaveStatus state={state} lastSavedAt={lastSavedAt} onRetry={() => void flush()} />
        <Button asChild variant="outline" size="sm">
          <Link href={m.href(`library/${p.slug}`)} onClick={() => void flush()}>
            <Eye /> View page
          </Link>
        </Button>
        {p.status === "published" ? (
          <Button variant="outline" size="sm" onClick={() => update({ status: "draft" })} data-testid="unpublish">
            <Undo2 /> Unpublish
          </Button>
        ) : (
          <Button size="sm" onClick={publishNow} data-testid="publish-now">
            <Rocket /> Publish now
          </Button>
        )}
      </div>

      {problems.length > 0 && p.status !== "archived" && (
        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Before publishing, add {problems.join(", ").replace(/, ([^,]*)$/, " and $1")}.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Product details</CardTitle>
              <CardDescription>What members see on the product page.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Title" htmlFor="pe-title">
                <Input id="pe-title" value={p.title} onChange={(e) => update(slugTouched ? { title: e.target.value } : { title: e.target.value, slug: "" })} data-testid="pe-title" />
              </Field>
              <Field label="Subtitle" htmlFor="pe-subtitle" optional>
                <Input id="pe-subtitle" value={p.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Format" htmlFor="pe-format">
                  <NativeSelect id="pe-format" value={p.format} onChange={(e) => update({ format: e.target.value as ProductFormat })}>
                    {Object.entries(PRODUCT_FORMAT_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Page address" htmlFor="pe-slug" hint={`…/library/${p.slug || "(set when saved)"}`}>
                  <Input
                    id="pe-slug"
                    value={p.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") });
                    }}
                  />
                </Field>
              </div>
              <Field
                label={
                  <span className="flex w-full items-center justify-between">
                    Description
                    <Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={() => setPreview((x) => !x)}>
                      {preview ? "Edit" : "Preview"}
                    </Button>
                  </span>
                }
                htmlFor="pe-desc"
                hint="Markdown: **bold**, *italic*, - lists, ### headings."
              >
                {preview ? <Markdown source={p.description} className="min-h-40 rounded-lg border p-3" /> : <Textarea id="pe-desc" rows={8} value={p.description} onChange={(e) => update({ description: e.target.value })} data-testid="pe-description" />}
              </Field>
              <Field label="Highlights" htmlFor="pe-hl" hint="One per line — shown as ticks on the product page." optional>
                <Textarea
                  id="pe-hl"
                  rows={4}
                  value={highlights}
                  onChange={(e) => {
                    setHighlights(e.target.value);
                    update({ highlights: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) });
                  }}
                />
              </Field>
              <Field label="Tags" htmlFor="pe-tags" hint="Comma separated. Used by search." optional>
                <Input
                  id="pe-tags"
                  value={tags}
                  onChange={(e) => {
                    setTags(e.target.value);
                    update({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) });
                  }}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
              <CardDescription>Everything members download. DOCX, PDF, TXT, Markdown and HTML files can also be opened in the PLR Editor.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <FileDrop accept="*/*" multiple onFiles={onFiles} compact disabled={!!busy} title={busy === "files" ? "Uploading…" : "Drop product files here, or click to browse"} hint={`Up to ${formatBytes(MAX_PRODUCT_FILE_BYTES)} each`} testId="pe-files" />
              {p.files.length > 0 && (
                <ul className="divide-y rounded-lg border" data-testid="pe-file-list">
                  {p.files.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(f.size)}
                          {f.editable && " · editable"}
                          {f.fileId === p.licence.fileId && " · licence document"}
                        </p>
                      </div>
                      <NativeSelect value={f.kind} onChange={(e) => update({ files: p.files.map((x) => (x.id === f.id ? { ...x, kind: e.target.value as ProductFileKind } : x)) })} className="h-8 w-auto text-xs" aria-label={`Type of ${f.name}`}>
                        {Object.entries(PRODUCT_FILE_KIND_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </NativeSelect>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${f.name}`}
                        onClick={async () => {
                          if (!(await confirm({ title: `Remove ${f.name}?`, description: "The file is deleted from the library.", confirmLabel: "Remove", destructive: true }))) return;
                          await op("remove", async (latest) => {
                            const next = await removeProductFile(latest, f.id);
                            return next.licence.fileId === f.fileId ? saveProduct({ ...next, licence: { ...next.licence, fileId: null } }) : next;
                          });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted-foreground">{p.wordCount ? `${p.wordCount.toLocaleString()} words · about ${plural(p.pageCount ?? 1, "page")}` : "Length not measured yet"}</span>
                <Button size="xs" variant="outline" disabled={!p.files.some((f) => f.editable) || !!busy} loading={busy === "length"} onClick={() => op("length", (latest) => detectLength(latest))}>
                  <ScanText /> Measure from file
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Licence</CardTitle>
              <CardDescription>Shown to members on the product page and included as LICENCE-SUMMARY.txt in every ZIP.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Licence type" htmlFor="pe-lic" className="min-w-[220px] flex-1">
                  <NativeSelect id="pe-lic" value={p.licence.type} onChange={(e) => update({ licence: { ...p.licence, type: e.target.value as LicenceType } })}>
                    {Object.entries(LICENCE_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Button variant="outline" size="sm" onClick={() => update({ licence: { ...p.licence, rights: defaultLicence(p.licence.type).rights } })}>
                  Use typical {p.licence.type.toUpperCase()} rights
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {LICENCE_RIGHTS.map(([k, label]) => (
                  <label key={k} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[13px]">
                    <span className="min-w-0">{label}</span>
                    <NativeSelect value={p.licence.rights[k]} onChange={(e) => update({ licence: { ...p.licence, rights: { ...p.licence.rights, [k]: e.target.value as RightValue } } })} className="h-8 w-[150px] shrink-0 text-xs" aria-label={label}>
                      {Object.entries(RIGHT_VALUE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                ))}
              </div>
              <Field label="Conditions" htmlFor="pe-terms" hint="Minimum prices, platforms that aren't allowed, attribution rules…" optional>
                <Textarea id="pe-terms" rows={3} value={p.licence.terms} onChange={(e) => update({ licence: { ...p.licence, terms: e.target.value } })} />
              </Field>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {p.licence.fileId ? (
                  <Badge variant="success">Licence document attached</Badge>
                ) : (
                  <span className="text-muted-foreground">No licence document attached</span>
                )}
                <input
                  ref={licenceInput}
                  type="file"
                  className="hidden"
                  aria-label="Upload licence document"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    void op("licence", async (latest) => {
                      const withFile = await addProductFile(latest, f, f.name, "licence");
                      const att = withFile.files[withFile.files.length - 1];
                      const old = latest.licence.fileId ? latest.files.find((x) => x.fileId === latest.licence.fileId) : null;
                      const next = await saveProduct({ ...withFile, files: withFile.files.map((x) => (x.id === att.id ? { ...x, editable: false } : x)), licence: { ...withFile.licence, fileId: att.fileId } });
                      return old ? removeProductFile(next, old.id) : next;
                    });
                  }}
                />
                <Button size="xs" variant="outline" loading={busy === "licence"} onClick={() => licenceInput.current?.click()}>
                  {p.licence.fileId ? "Replace licence document" : "Upload licence document"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Status" htmlFor="pe-status">
                <NativeSelect id="pe-status" value={p.status} onChange={(e) => update({ status: e.target.value as PublishStatus })} data-testid="pe-status">
                  {Object.entries(PUBLISH_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Available from" htmlFor="pe-date" hint={p.status === "scheduled" ? "Members see it from this date and time." : "Used for “newest” sorting and scheduled releases."}>
                <Input id="pe-date" type="datetime-local" value={toLocalInput(p.publishAt)} onChange={(e) => update({ publishAt: fromLocalInput(e.target.value) })} />
              </Field>
              <Field label="Access level" htmlFor="pe-access">
                <NativeSelect id="pe-access" value={p.access} onChange={(e) => update({ access: e.target.value as AccessTier })} data-testid="pe-access">
                  {ACCESS_TIERS.map((t) => (
                    <option key={t} value={t}>
                      {ACCESS_TIER_LABELS[t]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={m.brand.dropName} htmlFor="pe-release">
                <NativeSelect id="pe-release" value={p.releaseId ?? ""} onChange={(e) => update({ releaseId: e.target.value || null })}>
                  <option value="">Not in a drop</option>
                  {catalog.releases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                      {r.theme ? ` — ${r.theme}` : ""}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="block font-medium">Featured</span>
                  <span className="block text-xs text-muted-foreground">Shown on the member dashboard</span>
                </span>
                <Switch checked={p.featured} onCheckedChange={(v) => update({ featured: v })} aria-label="Featured" />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              {catalog.categories.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={p.categoryIds.includes(c.id)} onCheckedChange={(v) => update({ categoryIds: v ? [...p.categoryIds, c.id] : p.categoryIds.filter((x) => x !== c.id) })} aria-label={c.name} />
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </label>
              ))}
              <Link href={m.adminHref("categories")} className="mt-1 text-xs text-primary hover:underline">
                Manage categories
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
              <CardDescription>A cover plus optional preview images (inside pages, mockups).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div className="flex items-start gap-4">
                <ProductCover product={p} className="w-24 shrink-0 shadow-md" />
                <div className="grid grid-cols-1 gap-2">
                  <FileDrop accept="image/*" onFiles={onImage("cover")} compact disabled={!!busy} title={busy === "cover" ? "Uploading…" : p.coverFileId ? "Replace cover" : "Upload cover"} hint="PNG, JPG, WebP or SVG" testId="pe-cover" />
                </div>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium">Preview images</p>
                <div className="grid grid-cols-3 gap-2">
                  {p.galleryFileIds.map((id) => (
                    <div key={id} className="group relative overflow-hidden rounded-md border">
                      <StoredImage fileId={id} alt="" className="aspect-[3/4] w-full" />
                      <button type="button" onClick={() => op("gallery-remove", (latest) => removeGalleryImage(latest, id))} className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100" aria-label="Remove image">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground transition hover:bg-secondary/50">
                    <ImagePlus className="size-4" />
                    Add
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = "";
                        if (files.length) void onImage("gallery")(files);
                      }}
                    />
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid grid-cols-1 gap-2 pt-5">
              <Button
                variant="outline"
                onClick={async () => {
                  await flush();
                  const c = await duplicateProduct(p.id);
                  if (c) {
                    toast.success("Duplicated");
                    router.push(m.adminHref(`products/${c.id}`));
                  }
                }}
              >
                <Copy /> Duplicate product
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:bg-red-50 hover:text-destructive"
                onClick={async () => {
                  if (!(await confirm({ title: `Delete “${p.title}”?`, description: "The product, its files and images are permanently removed.", confirmLabel: "Delete product", destructive: true }))) return;
                  await flush();
                  await deleteProduct(p.id);
                  toast.success("Product deleted");
                  router.push(m.adminHref("products"));
                }}
              >
                <Trash2 /> Delete product
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
