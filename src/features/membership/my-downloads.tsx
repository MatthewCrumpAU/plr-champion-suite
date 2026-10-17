"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileArchive, FileText, GraduationCap, History, Package, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Input, PageContainer, PageHeader, Spinner, Stat } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm";
import { clearDownloadHistory, downloadAttachment, downloadBundle, downloadStoredFile } from "@/lib/membership/member-actions";
import type { DownloadRecord } from "@/lib/membership/types";
import { errorMessage, formatBytes, formatDateTime, plural } from "@/lib/utils";
import { useMember, useMemberActivity, useVisibleProducts } from "./member-context";

const KIND_ICON = { file: FileText, bundle: FileArchive, resource: Package, lesson: GraduationCap } as const;
const KIND_LABEL = { file: "File", bundle: "ZIP bundle", resource: "Resource", lesson: "Lesson file" } as const;

export function MyDownloads() {
  const m = useMember();
  const confirm = useConfirm();
  const { products, catalog, loading } = useVisibleProducts();
  const { data: activity } = useMemberActivity();
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  if (loading || !catalog || !activity) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }

  const list = activity.downloads.filter((d) => !q.trim() || `${d.fileName} ${d.productTitle}`.toLowerCase().includes(q.trim().toLowerCase()));
  const totalBytes = activity.downloads.reduce((n, d) => n + d.size, 0);
  const uniqueProducts = new Set(activity.downloads.map((d) => d.productId).filter(Boolean)).size;

  /** Works out how to fetch the same thing again; null when it's no longer available. */
  const againAction = (d: DownloadRecord): (() => Promise<unknown>) | null => {
    if (d.kind === "file") {
      const p = products.find((x) => x.id === d.productId);
      const att = p?.files.find((f) => f.id === d.attachmentId);
      if (!p || !att || !m.canUse(p)) return null;
      return () => downloadAttachment(p, att, m.account.id);
    }
    if (d.kind === "bundle") {
      const p = d.productId ? products.find((x) => x.id === d.productId) : null;
      if (!p || !m.canUse(p)) return null;
      return () => downloadBundle([p], m.account.id, m.brand.name);
    }
    return () => downloadStoredFile(m.brandId, d.attachmentId, d.fileName, m.account.id, d.kind, d.productTitle);
  };

  const run = async (d: DownloadRecord) => {
    const fn = againAction(d);
    if (!fn) return;
    setBusy(d.id);
    try {
      await fn();
      toast.success(`Downloading ${d.fileName}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow={m.brand.name}
        title="My Downloads"
        description="Everything you've downloaded from the membership, newest first. Download any file again in one click."
        actions={
          activity.downloads.length > 0 && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!(await confirm({ title: "Clear your download history?", description: "This only clears the list — it doesn't delete any files or products.", confirmLabel: "Clear history" }))) return;
                await clearDownloadHistory(m.brandId, m.account.id);
                toast.success("Download history cleared");
              }}
            >
              <Trash2 /> Clear history
            </Button>
          )
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Downloads" value={activity.downloads.length} />
        <Stat label="Products" value={uniqueProducts} />
        <Stat label="Total size" value={formatBytes(totalBytes)} />
      </div>

      {activity.downloads.length === 0 ? (
        <EmptyState icon={<History />} title="No downloads yet" description="When you download a product, bundle or resource it's listed here." action={<Button asChild><Link href={m.href("library")}>Browse the library</Link></Button>} />
      ) : (
        <>
          <div className="relative mb-3 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your downloads" className="pl-8" aria-label="Search your downloads" />
          </div>
          <Card className="overflow-hidden">
            <ul className="divide-y" data-testid="download-history">
              {list.map((d) => {
                const Icon = KIND_ICON[d.kind];
                const product = d.productId ? products.find((p) => p.id === d.productId) : null;
                const available = !!againAction(d);
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.fileName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {product ? (
                          <Link href={m.href(`library/${product.slug}`)} className="hover:text-foreground hover:underline">
                            {d.productTitle}
                          </Link>
                        ) : (
                          d.productTitle
                        )}{" "}
                        · {formatDateTime(d.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline">{KIND_LABEL[d.kind]}</Badge>
                    <span className="w-16 text-right text-xs text-muted-foreground">{formatBytes(d.size)}</span>
                    <Button size="xs" variant="outline" onClick={() => run(d)} loading={busy === d.id} disabled={!available} title={available ? undefined : "No longer available"}>
                      <Download /> Again
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
          {list.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No downloads match “{q}”.</p>}
          <p className="mt-3 text-xs text-muted-foreground">{plural(activity.downloads.length, "download")} recorded in this browser.</p>
        </>
      )}
    </PageContainer>
  );
}
