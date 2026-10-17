"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, CalendarRange, FileArchive, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageContainer, PageHeader, Spinner } from "@/components/ui/primitives";
import { isLive } from "@/lib/membership/access";
import { downloadBundle, toggleFavourite } from "@/lib/membership/member-actions";
import type { Release } from "@/lib/membership/types";
import { errorMessage, formatBytes, formatDate, plural } from "@/lib/utils";
import { useMember, useMemberActivity, useVisibleProducts } from "./member-context";
import { Markdown, ProductCard, ProductCover, StatusBadge, StoredImage } from "./ui";

function upcoming(r: Release) {
  return r.status === "scheduled" && !!r.publishAt && new Date(r.publishAt) > new Date();
}

export function DropsPage() {
  const m = useMember();
  const { products, catalog, loading } = useVisibleProducts();
  if (loading || !catalog) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const visible = catalog.releases.filter((r) => m.canSee(r));
  const teasers = m.isAdmin ? [] : catalog.releases.filter(upcoming);
  return (
    <PageContainer width="wide">
      <PageHeader eyebrow={m.brand.name} title={`${m.brand.dropName}s`} description="New products are released every month around a theme. Open a drop to see everything in it, or download the whole drop at once." actions={m.isAdmin ? <Button asChild variant="outline"><Link href={m.adminHref("releases")}>Manage releases</Link></Button> : undefined} />
      {teasers.map((r) => (
        <Card key={r.id} className="mb-6 flex items-center gap-4 border-dashed p-4" data-testid="upcoming-drop">
          <CalendarClock className="size-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Coming {formatDate(r.publishAt, { day: "numeric", month: "long" })}: {r.theme || r.title}</p>
            <p className="text-sm text-muted-foreground">{r.description}</p>
          </div>
        </Card>
      ))}
      {visible.length === 0 ? (
        <EmptyState icon={<CalendarRange />} title="No drops yet" />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visible.map((r) => {
            const inDrop = products.filter((p) => r.productIds.includes(p.id));
            return (
              <Link key={r.id} href={m.href(`drops/${r.id}`)} className="group grid overflow-hidden rounded-2xl border bg-card transition hover:shadow-md sm:grid-cols-[160px_minmax(0,1fr)]" data-testid="drop-card">
                <StoredImage fileId={r.coverFileId} alt="" className="h-40 w-full sm:h-full" />
                <div className="flex flex-col gap-2 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{r.title}</Badge>
                    {m.isAdmin && <StatusBadge status={r.status} publishAt={r.publishAt} />}
                    <span className="text-xs text-muted-foreground">{plural(inDrop.length, "product")}</span>
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">{r.theme || r.title}</h2>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{r.description.replace(/[*_#>`]/g, "")}</p>
                  <div className="mt-auto flex -space-x-2 pt-2">
                    {inDrop.slice(0, 6).map((p) => (
                      <ProductCover key={p.id} product={p} className="w-10 rounded-sm shadow ring-2 ring-card" />
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

export function DropPage() {
  const { releaseId } = useParams<{ releaseId: string }>();
  const m = useMember();
  const { products, catalog, loading } = useVisibleProducts();
  const { data: activity } = useMemberActivity();
  const [busy, setBusy] = React.useState(false);
  if (loading || !catalog) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const r = catalog.releases.find((x) => x.id === releaseId && m.canSee(x));
  if (!r) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<CalendarRange />} title="This drop isn't available" description={catalog.releases.some((x) => x.id === releaseId) ? "It hasn't been released yet." : "The link may be wrong."} action={<Button asChild><Link href={m.href("drops")}>All drops</Link></Button>} />
      </PageContainer>
    );
  }
  const inDrop = products.filter((p) => r.productIds.includes(p.id));
  const usable = inDrop.filter((p) => m.canUse(p) && p.files.length);
  const fav = activity?.favourites ?? new Set<string>();
  return (
    <PageContainer width="wide">
      <Link href={m.href("drops")} className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All drops
      </Link>
      <section className="grid grid-cols-1 overflow-hidden rounded-2xl border bg-card sm:grid-cols-[220px_minmax(0,1fr)]">
        <StoredImage fileId={r.coverFileId} alt={`${r.title} drop cover`} className="h-56 w-full sm:h-full" />
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{r.title}</Badge>
            {m.isAdmin && <StatusBadge status={r.status} publishAt={r.publishAt} />}
            {!isLive(r) && !m.isAdmin && <Badge variant="warning">Coming soon</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{r.theme || r.title}</h1>
          <Markdown source={r.description} className="mt-2 text-sm text-muted-foreground" />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await downloadBundle(usable, m.account.id, `${m.brand.name} ${r.title}`);
                  toast.success(`Downloading ${res.fileName}`, { description: formatBytes(res.size) });
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
              loading={busy}
              disabled={!usable.length}
              data-testid="download-drop"
            >
              <FileArchive /> Download the whole drop ({usable.length})
            </Button>
            {m.isAdmin && (
              <Button asChild variant="outline">
                <Link href={m.adminHref(`releases/${r.id}`)}>
                  <Pencil /> Edit release
                </Link>
              </Button>
            )}
          </div>
          {usable.length < inDrop.length && <p className="mt-2 text-xs text-muted-foreground">{plural(inDrop.length - usable.length, "product")} in this drop need a higher access level.</p>}
        </div>
      </section>
      <h2 className="mb-4 mt-8 text-lg font-semibold tracking-tight">In this drop</h2>
      {inDrop.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {inDrop.map((p) => (
            <ProductCard key={p.id} product={p} href={m.href(`library/${p.slug}`)} categories={catalog.categories} lock={m.lockReason(p)} showStatus={m.isAdmin && p.status !== "published"} favourite={fav.has(p.id)} onToggleFavourite={() => toggleFavourite(m.brandId, m.account.id, p.id).catch((e) => toast.error(errorMessage(e)))} />
          ))}
        </div>
      ) : (
        <EmptyState title="No products in this drop yet" />
      )}
    </PageContainer>
  );
}
