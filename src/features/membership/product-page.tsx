"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarRange, Check, Download, FileArchive, FilePen, FileText, Heart, Pencil, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageContainer, Spinner } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTitle, Tooltip } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { downloadAttachment, downloadBundle, toggleFavourite } from "@/lib/membership/member-actions";
import { openProductInEditor } from "@/lib/membership/editor-bridge";
import { PRODUCT_FILE_KIND_LABELS, type Product, type ProductAttachment } from "@/lib/membership/types";
import { cn, errorMessage, formatBytes, formatDate, formatNumber, plural } from "@/lib/utils";
import { useMember, useMemberActivity, useVisibleProducts } from "./member-context";
import { AccessBadge, CategoryChip, FormatBadge, LicenceSummary, LockNotice, Markdown, ProductCard, ProductCover, StatusBadge, StoredImage } from "./ui";

function EditButton({ product, att, disabled }: { product: Product; att: ProductAttachment; disabled: boolean }) {
  const m = useMember();
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);
  const right = product.licence.rights.edit;
  if (!att.editable) return null;
  const blocked = right === "no";
  const run = async () => {
    if (right !== "yes") {
      const ok = await confirm({
        title: "Check the licence first",
        description: right === "conditional" ? "This licence only allows editing under certain conditions. Read the licence terms on this page before you sell an edited version." : "This licence doesn't say whether you may edit the content. Assume you can't sell an edited version until you've confirmed it with the supplier.",
        confirmLabel: "Open a working copy",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await openProductInEditor(product, att);
      toast.success(`Opened “${product.title}” in the PLR Editor`, { description: `${plural(r.chapters, "chapter")} found. Your library copy is unchanged.` });
      router.push(m.href(`tools/editor?id=${r.documentId}`));
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <Tooltip content={blocked ? "The licence doesn't allow editing this product" : disabled ? null : "Creates a new project with this file split into chapters"}>
      <span>
        <Button size="xs" variant="soft" onClick={run} loading={busy} disabled={disabled || blocked} data-testid={`edit-${att.name}`}>
          <FilePen /> Edit in PLR Editor
        </Button>
      </span>
    </Tooltip>
  );
}

export function ProductPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug);
  const m = useMember();
  const { products, catalog, loading } = useVisibleProducts();
  const { data: activity } = useMemberActivity();
  const [zipBusy, setZipBusy] = React.useState(false);
  const [busyFile, setBusyFile] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  if (loading || !catalog) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const product = products.find((p) => p.slug === slug);
  if (!product) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<FileText />} title="Product not available" description="It may have been removed, isn't published yet, or the link is wrong." action={<Button asChild><Link href={m.href("library")}>Back to the library</Link></Button>} />
      </PageContainer>
    );
  }

  const lock = m.lockReason(product);
  const usable = !lock;
  const cats = catalog.categories.filter((c) => product.categoryIds.includes(c.id));
  const release = product.releaseId ? catalog.releases.find((r) => r.id === product.releaseId) : null;
  const favourite = activity?.favourites.has(product.id) ?? false;
  const related = products.filter((p) => p.id !== product.id && p.categoryIds.some((c) => product.categoryIds.includes(c))).slice(0, 4);
  const licenceFile = product.files.find((f) => f.fileId === product.licence.fileId);

  const downloadOne = async (att: ProductAttachment) => {
    setBusyFile(att.id);
    try {
      await downloadAttachment(product, att, m.account.id);
      toast.success(`Downloading ${att.name}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyFile(null);
    }
  };
  const downloadAll = async () => {
    setZipBusy(true);
    try {
      const r = await downloadBundle([product], m.account.id, m.brand.name);
      toast.success(`Downloading ${r.fileName}`, { description: formatBytes(r.size) });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <PageContainer width="wide">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
        <Link href={m.href("library")} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Library
        </Link>
        {cats[0] && (
          <>
            <span>/</span>
            <Link href={`${m.href("library")}?cat=${cats[0].id}`} className="hover:text-foreground">
              {cats[0].name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid grid-cols-1 content-start gap-4">
          <div className="rounded-2xl bg-secondary/60 p-6">
            <ProductCover product={product} className="mx-auto max-w-[260px] shadow-xl ring-1 ring-black/5" />
          </div>
          {product.galleryFileIds.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {product.galleryFileIds.map((id, i) => (
                <button key={id} type="button" onClick={() => setPreview(id)} className="overflow-hidden rounded-md border transition hover:ring-2 hover:ring-primary" aria-label={`Preview image ${i + 1}`}>
                  <StoredImage fileId={id} alt="" className="aspect-[3/4] w-full" />
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={downloadAll} loading={zipBusy} disabled={!usable || !product.files.length} data-testid="download-all">
              <FileArchive /> Download everything (ZIP)
            </Button>
            <Button variant="outline" onClick={() => toggleFavourite(m.brandId, m.account.id, product.id).catch((e) => toast.error(errorMessage(e)))} aria-pressed={favourite} data-testid="favourite">
              <Heart className={cn(favourite && "fill-rose-500 text-rose-500")} /> {favourite ? "Saved" : "Save for later"}
            </Button>
            {m.isAdmin && (
              <Button asChild variant="ghost">
                <Link href={m.adminHref(`products/${product.id}`)}>
                  <Pencil /> Edit product
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <AccessBadge tier={product.access} />
            <FormatBadge product={product} />
            {m.isAdmin && <StatusBadge status={product.status} publishAt={product.publishAt} />}
            {product.isSample && <Badge variant="sample">Sample</Badge>}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{product.title}</h1>
          {product.subtitle && <p className="mt-1.5 text-lg text-muted-foreground">{product.subtitle}</p>}
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {product.wordCount ? <span>{formatNumber(product.wordCount)} words</span> : null}
            {product.pageCount ? <span>about {plural(product.pageCount, "page")}</span> : null}
            <span>{plural(product.files.length, "file")}</span>
            <span>Added {formatDate(product.publishAt ?? product.createdAt)}</span>
            {release && (
              <Link href={m.href(`drops/${release.id}`)} className="inline-flex items-center gap-1 text-primary hover:underline">
                <CalendarRange className="size-3.5" /> {release.title} drop
              </Link>
            )}
          </p>

          {lock && <LockNotice reason={lock} className="mt-5" />}

          {product.highlights.length > 0 && (
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {product.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Check className="size-3" />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <Markdown source={product.description} />
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent>
              {product.files.length ? (
                <ul className="divide-y" data-testid="product-files">
                  {product.files.map((att) => (
                    <li key={att.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                        {att.kind === "licence" ? <ScrollText className="size-4" /> : <FileText className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{att.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {PRODUCT_FILE_KIND_LABELS[att.kind]} · {formatBytes(att.size)}
                          {att.editable && " · opens in the PLR Editor"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <EditButton product={product} att={att} disabled={!usable} />
                        <Button size="xs" variant="outline" onClick={() => downloadOne(att)} loading={busyFile === att.id} disabled={!usable} data-testid={`download-${att.name}`}>
                          <Download /> Download
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No files have been attached yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4" id="licence">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Licence</CardTitle>
              {licenceFile && usable && (
                <Button size="xs" variant="ghost" onClick={() => downloadOne(licenceFile)}>
                  <Download /> Full licence
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <LicenceSummary licence={product.licence} />
            </CardContent>
          </Card>

          {(cats.length > 0 || product.tags.length > 0) && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {cats.map((c) => (
                <CategoryChip key={c.id} category={c} href={`${m.href("library")}?cat=${c.id}`} />
              ))}
              {product.tags.map((t) => (
                <Link key={t} href={`${m.href("library")}?q=${encodeURIComponent(`"${t}"`)}`} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:bg-secondary/70">
                  #{t}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">More like this</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} href={m.href(`library/${p.slug}`)} categories={catalog.categories} lock={m.lockReason(p)} />
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-xl">
          <DialogTitle className="sr-only">Preview image</DialogTitle>
          {preview && <StoredImage fileId={preview} alt={`${product.title} preview`} className="max-h-[75vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
