"use client";

import * as React from "react";
import Link from "next/link";
import { FileArchive, FolderDown, PackageOpen, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Checkbox, EmptyState, Input, NativeSelect, PageContainer, PageHeader, Progress, Spinner } from "@/components/ui/primitives";
import { downloadBundle, type BundleProgress } from "@/lib/membership/member-actions";
import { filterProducts, EMPTY_QUERY } from "@/lib/membership/search";
import { isLive } from "@/lib/membership/access";
import type { Product } from "@/lib/membership/types";
import { cn, errorMessage, formatBytes, plural } from "@/lib/utils";
import { useMember, useMemberActivity, useVisibleProducts } from "./member-context";
import { AccessBadge, ProductCover } from "./ui";

const bytesOf = (p: Product) => p.files.reduce((n, f) => n + f.size, 0);

export function DownloadManager() {
  const m = useMember();
  const { products, catalog, loading } = useVisibleProducts();
  const { data: activity } = useMemberActivity();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [text, setText] = React.useState("");
  const [drop, setDrop] = React.useState("");
  const [cat, setCat] = React.useState("");
  const [onlyNew, setOnlyNew] = React.useState(false);
  const [progress, setProgress] = React.useState<BundleProgress | null>(null);

  if (loading || !catalog) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }

  const usable = products.filter((p) => m.canUse(p) && p.files.length > 0);
  const locked = products.length - products.filter((p) => m.canUse(p)).length;
  const downloadedIds = new Set((activity?.downloads ?? []).map((d) => d.productId).filter(Boolean) as string[]);
  const shown = filterProducts(usable, { ...EMPTY_QUERY, text, releaseId: drop || null, categoryIds: cat ? [cat] : [] }).filter((p) => !onlyNew || !downloadedIds.has(p.id));
  const chosen = usable.filter((p) => selected.has(p.id));
  const totalBytes = chosen.reduce((n, p) => n + bytesOf(p), 0);
  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const drops = catalog.releases.filter((r) => isLive(r) || m.isAdmin);

  const build = async (list: Product[]) => {
    if (!list.length) return;
    setProgress({ done: 0, total: 1, current: "Starting…" });
    try {
      const r = await downloadBundle(list, m.account.id, m.brand.name, setProgress);
      toast.success(`Downloading ${r.fileName}`, { description: `${plural(list.length, "product")} · ${formatBytes(r.size)}` });
      setSelected(new Set());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <PageContainer width="wide">
      <PageHeader eyebrow={m.brand.name} title="Download Manager" description="Choose products and download them together as one ZIP. Every product gets its own folder with a licence summary." />

      {drops.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {drops.slice(0, 4).map((r) => {
            const inDrop = usable.filter((p) => p.releaseId === r.id);
            return (
              <Card key={r.id} className="flex items-center gap-3 p-3">
                <PackageOpen className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.theme || m.brand.dropName}</p>
                </div>
                <Button size="xs" variant="outline" disabled={!inDrop.length || !!progress} onClick={() => build(inDrop)} data-testid={`drop-zip-${r.month}`}>
                  <FileArchive /> {inDrop.length ? `All ${inDrop.length}` : "None"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter by title or tag" className="pl-8" aria-label="Filter products" />
        </div>
        <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto" aria-label="Category">
          <option value="">All categories</option>
          {catalog.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={drop} onChange={(e) => setDrop(e.target.value)} className="w-auto" aria-label="Drop">
          <option value="">All drops</option>
          {drops.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={onlyNew} onCheckedChange={(v) => setOnlyNew(!!v)} aria-label="Not downloaded yet" /> Not downloaded yet
        </label>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<FolderDown />} title="Nothing to download here" description={usable.length ? "No products match these filters." : "Products you have access to will appear here."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b bg-secondary/40 px-4 py-2.5 text-sm">
            <Checkbox
              checked={allShownSelected}
              onCheckedChange={() =>
                setSelected((s) => {
                  const n = new Set(s);
                  for (const p of shown) {
                    if (allShownSelected) n.delete(p.id);
                    else n.add(p.id);
                  }
                  return n;
                })
              }
              aria-label="Select all shown"
              data-testid="select-all"
            />
            <span className="flex-1 font-medium">{plural(shown.length, "product")}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">Size</span>
          </div>
          <ul className="divide-y">
            {shown.map((p) => (
              <li key={p.id}>
                <label className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-secondary/40", selected.has(p.id) && "bg-primary-soft/50")}>
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={`Select ${p.title}`} />
                  <ProductCover product={p} className="w-9 shrink-0 rounded shadow-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {plural(p.files.length, "file")} · {p.files.map((f) => f.name.split(".").pop()?.toUpperCase()).filter((x, i, a) => a.indexOf(x) === i).join(", ")}
                    </span>
                  </span>
                  {downloadedIds.has(p.id) && <Badge variant="secondary" className="hidden sm:inline-flex">Downloaded</Badge>}
                  <AccessBadge tier={p.access} className="hidden md:inline-flex" />
                  <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{formatBytes(bytesOf(p))}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {locked > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {plural(locked, "product")} {locked === 1 ? "isn't" : "aren't"} included because {locked === 1 ? "it needs" : "they need"} a higher access level. <Link href={m.href("library")} className="text-primary hover:underline">See them in the library</Link>.
        </p>
      )}

      <div className="pointer-events-none sticky bottom-4 z-20 mt-6 flex justify-center">
        <div className={cn("pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border bg-card p-3 shadow-xl transition", !chosen.length && !progress && "translate-y-2 opacity-90")} data-testid="download-bar">
          {progress ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Building your ZIP… {progress.current}</p>
              <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} className="mt-2" />
            </div>
          ) : (
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{chosen.length ? `${plural(chosen.length, "product")} selected` : "Select products to download"}</p>
              <p className="text-xs text-muted-foreground">{chosen.length ? `About ${formatBytes(totalBytes)} before compression` : "Tick the boxes above, or download a whole drop."}</p>
            </div>
          )}
          {chosen.length > 0 && !progress && (
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          )}
          <Button onClick={() => build(chosen)} disabled={!chosen.length || !!progress} loading={!!progress} data-testid="download-selected">
            <FileArchive /> Download ZIP
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
