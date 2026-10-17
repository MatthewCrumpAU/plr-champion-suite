"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, CalendarRange, Eye, Pencil, Rocket, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, EmptyState, Field, Input, PageContainer, PageHeader, Spinner, Textarea } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm";
import { FileDrop } from "@/components/common/file-drop";
import { SaveStatus } from "@/components/common/save-status";
import { useMemberLive } from "@/lib/membership/hooks";
import { deleteRelease, monthStart, monthTitle, newRelease, publishRelease, saveRelease } from "@/lib/membership/catalog";
import { deleteMemberFiles, MAX_IMAGE_BYTES, storeMemberFile } from "@/lib/membership/files";
import type { Release } from "@/lib/membership/types";
import { errorMessage, formatBytes, plural } from "@/lib/utils";
import { useCatalog, useMember } from "../member-context";
import { ProductCover, StatusBadge, StoredImage } from "../ui";
import { AdminGate } from "./admin-gate";
import { fromLocalInput, toLocalInput } from "./product-editor";
import { useDraft } from "./use-draft";

function thisMonth(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ReleasesAdmin() {
  return (
    <AdminGate>
      <ReleasesList />
    </AdminGate>
  );
}

function ReleasesList() {
  const m = useMember();
  const router = useRouter();
  const confirm = useConfirm();
  const { data, loading } = useCatalog();
  const [month, setMonth] = React.useState(thisMonth(1));
  const [busy, setBusy] = React.useState(false);
  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const create = async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) return toast.error("Choose a month.");
    setBusy(true);
    try {
      const r = await saveRelease(newRelease(m.brandId, month));
      router.push(m.adminHref(`releases/${r.id}`));
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <PageContainer>
      <PageHeader eyebrow="Membership Admin" title={`${m.brand.dropName}s`} description="Group products into a monthly release, then publish it now or schedule it for the 1st of the month. Publishing a release also publishes its draft products." />
      <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
        <Field label="New release for" htmlFor="rel-month" className="w-48">
          <Input id="rel-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Button onClick={create} loading={busy} data-testid="new-release">
          <CalendarPlus /> Create release
        </Button>
        {data.releases.some((r) => r.month === month) && <p className="text-xs text-warning">There is already a release for {monthTitle(month)}.</p>}
      </Card>
      {data.releases.length === 0 ? (
        <EmptyState icon={<CalendarRange />} title="No releases yet" />
      ) : (
        <div className="grid grid-cols-1 gap-3" data-testid="admin-releases">
          {data.releases.map((r) => (
            <Card key={r.id} className="flex items-center gap-4 p-3">
              <StoredImage fileId={r.coverFileId} alt="" className="aspect-[3/4] w-14 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{r.title}</p>
                  <StatusBadge status={r.status} publishAt={r.publishAt} />
                  {r.isSample && <Badge variant="sample">Sample</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {r.theme || "No theme yet"} · {plural(r.productIds.length, "product")}
                </p>
              </div>
              <Button asChild size="xs" variant="ghost">
                <Link href={m.href(`drops/${r.id}`)}>
                  <Eye /> View
                </Link>
              </Button>
              <Button asChild size="xs" variant="outline">
                <Link href={m.adminHref(`releases/${r.id}`)}>
                  <Pencil /> Edit
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete ${r.title}`}
                onClick={async () => {
                  if (!(await confirm({ title: `Delete the ${r.title} release?`, description: "Its products stay in the library — they're just no longer grouped in this drop.", confirmLabel: "Delete release", destructive: true }))) return;
                  await deleteRelease(r.id);
                  toast.success("Release deleted");
                }}
              >
                <Trash2 />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

export function ReleaseEditor() {
  return (
    <AdminGate>
      <ReleaseEditorInner />
    </AdminGate>
  );
}

function ReleaseEditorInner() {
  const { releaseId } = useParams<{ releaseId: string }>();
  const m = useMember();
  const { data: stored, loading } = useMemberLive((r) => r.releases.get(releaseId), [releaseId]);
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
        <EmptyState icon={<CalendarRange />} title="Release not found" action={<Button asChild><Link href={m.adminHref("releases")}>All releases</Link></Button>} />
      </PageContainer>
    );
  }
  return <ReleaseForm key={stored.id} stored={stored} />;
}

function ReleaseForm({ stored }: { stored: Release }) {
  const m = useMember();
  const { data: catalog } = useCatalog();
  const { draft, update, flush, adopt, state, lastSavedAt } = useDraft<Release>(stored, (r) => saveRelease(r));
  const [busy, setBusy] = React.useState<string | null>(null);
  const [when, setWhen] = React.useState(toLocalInput(stored.publishAt ?? monthStart(stored.month)));
  if (!draft || !catalog) return null;
  const r = draft;

  const run = async (label: string, fn: (latest: Release) => Promise<Release>, done?: string) => {
    setBusy(label);
    try {
      const latest = (await flush()) ?? r;
      adopt(await fn(latest));
      if (done) toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const products = [...catalog.products].sort((a, b) => Number(b.releaseId === r.id) - Number(a.releaseId === r.id) || a.title.localeCompare(b.title));
  const whenIso = fromLocalInput(when);
  const future = whenIso ? new Date(whenIso) > new Date() : false;

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={m.adminHref("releases")}>
            <ArrowLeft /> Releases
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{r.title}</h1>
        <StatusBadge status={r.status} publishAt={r.publishAt} />
        <SaveStatus state={state} lastSavedAt={lastSavedAt} onRetry={() => void flush()} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid grid-cols-1 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Release details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Title" htmlFor="re-title">
                  <Input id="re-title" value={r.title} onChange={(e) => update({ title: e.target.value })} />
                </Field>
                <Field label="Month" htmlFor="re-month">
                  <Input id="re-month" type="month" value={r.month} onChange={(e) => e.target.value && update({ month: e.target.value, title: r.title === monthTitle(r.month) ? monthTitle(e.target.value) : r.title })} />
                </Field>
              </div>
              <Field label="Theme" htmlFor="re-theme" hint="A short name for the drop, e.g. “Healthy Home”.">
                <Input id="re-theme" value={r.theme} onChange={(e) => update({ theme: e.target.value })} data-testid="re-theme" />
              </Field>
              <Field label="Description" htmlFor="re-desc" hint="Markdown supported." optional>
                <Textarea id="re-desc" rows={4} value={r.description} onChange={(e) => update({ description: e.target.value })} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Products in this drop</CardTitle>
              <CardDescription>A product belongs to one drop. Ticking a product that&apos;s in another drop moves it here.</CardDescription>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add products first.</p>
              ) : (
                <ul className="divide-y rounded-lg border" data-testid="release-products">
                  {products.map((p) => {
                    const on = r.productIds.includes(p.id);
                    const other = !on && p.releaseId ? catalog.releases.find((x) => x.id === p.releaseId) : null;
                    return (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-secondary/40">
                          <Checkbox checked={on} onCheckedChange={(v) => update({ productIds: v ? [...r.productIds, p.id] : r.productIds.filter((x) => x !== p.id) })} aria-label={p.title} />
                          <ProductCover product={p} className="w-8 shrink-0 rounded-sm" />
                          <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                          {other && <span className="text-xs text-muted-foreground">in {other.title}</span>}
                          <StatusBadge status={p.status} publishAt={p.publishAt} />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Release</CardTitle>
              <CardDescription>Members see the drop and its products from this moment.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3">
              <Field label="Release date and time" htmlFor="re-when">
                <Input id="re-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </Field>
              <Button onClick={() => whenIso && run("publish", (latest) => publishRelease(latest, whenIso), future ? `Scheduled for ${new Date(whenIso).toLocaleString()}` : "Released to members")} loading={busy === "publish"} disabled={!whenIso} data-testid="publish-release">
                <Rocket /> {future ? "Schedule release" : "Release now"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => run("now", (latest) => publishRelease(latest, new Date().toISOString()), "Released to members")} loading={busy === "now"} disabled={r.status === "published" && !future}>
                Release immediately
              </Button>
              {r.status !== "draft" && (
                <Button variant="ghost" size="sm" onClick={() => update({ status: "draft" })}>
                  <Undo2 /> Back to draft
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Releasing also publishes any draft products in this drop on the same date.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cover</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3">
              {r.coverFileId && <StoredImage fileId={r.coverFileId} alt="" className="aspect-[3/4] w-32 rounded-md shadow" />}
              <FileDrop
                accept="image/*"
                compact
                title={r.coverFileId ? "Replace cover" : "Upload cover"}
                disabled={!!busy}
                onFiles={([f]) => {
                  if (!f.type.startsWith("image/")) return toast.error("Choose an image.");
                  if (f.size > MAX_IMAGE_BYTES) return toast.error(`Images must be under ${formatBytes(MAX_IMAGE_BYTES)}.`);
                  void run("cover", async (latest) => {
                    const file = await storeMemberFile(f, f.name, m.brandId);
                    const saved = await saveRelease({ ...latest, coverFileId: file.id });
                    if (latest.coverFileId) await deleteMemberFiles([latest.coverFileId]);
                    return saved;
                  });
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
