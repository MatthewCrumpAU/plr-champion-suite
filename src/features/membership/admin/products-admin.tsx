"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Eye, MoreHorizontal, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Input, NativeSelect, PageContainer, PageHeader, Spinner } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { deleteProduct, duplicateProduct, newProduct, saveProduct } from "@/lib/membership/catalog";
import { PUBLISH_STATUS_LABELS, type Product, type PublishStatus } from "@/lib/membership/types";
import { errorMessage, plural, timeAgo } from "@/lib/utils";
import { useCatalog, useMember } from "../member-context";
import { AccessBadge, FormatBadge, ProductCover, StatusBadge } from "../ui";
import { AdminGate } from "./admin-gate";

export function ProductsAdmin() {
  return (
    <AdminGate>
      <ProductsAdminInner />
    </AdminGate>
  );
}

function ProductsAdminInner() {
  const m = useMember();
  const router = useRouter();
  const confirm = useConfirm();
  const { data, loading } = useCatalog();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<PublishStatus | "">("");
  const [creating, setCreating] = React.useState(false);

  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }

  const list = data.products
    .filter((p) => (!status || p.status === status) && (!q.trim() || `${p.title} ${p.subtitle} ${p.tags.join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const counts = (s: PublishStatus) => data.products.filter((p) => p.status === s).length;

  const create = async () => {
    setCreating(true);
    try {
      const p = await saveProduct(newProduct(m.brandId, { title: "Untitled product" }));
      router.push(m.adminHref(`products/${p.id}`));
    } catch (e) {
      toast.error(errorMessage(e));
      setCreating(false);
    }
  };

  const setProductStatus = async (p: Product, s: PublishStatus) => {
    try {
      await saveProduct({ ...p, status: s, publishAt: s === "published" ? (p.publishAt && new Date(p.publishAt) <= new Date() ? p.publishAt : new Date().toISOString()) : p.publishAt });
      toast.success(`“${p.title}” is now ${PUBLISH_STATUS_LABELS[s].toLowerCase()}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Membership Admin"
        title="Products"
        description="Upload PLR products with covers, files and licence details. Drafts are only visible to you until you publish them."
        actions={
          <Button onClick={create} loading={creating} data-testid="new-product">
            <Plus /> New product
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="pl-8" aria-label="Search products" />
        </div>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as PublishStatus | "")} className="w-auto" aria-label="Status">
          <option value="">All statuses ({data.products.length})</option>
          {(["published", "scheduled", "draft", "archived"] as PublishStatus[]).map((s) => (
            <option key={s} value={s}>
              {PUBLISH_STATUS_LABELS[s]} ({counts(s)})
            </option>
          ))}
        </NativeSelect>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Upload />} title={data.products.length ? "No products match" : "No products yet"} description={data.products.length ? "Try another search or status." : "Create your first product, then upload its cover, files and licence."} action={!data.products.length && <Button onClick={create}>New product</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y" data-testid="admin-products">
            {list.map((p) => {
              const release = data.releases.find((r) => r.id === p.releaseId);
              const missing = [!p.coverFileId && "cover", !p.files.length && "files", !p.categoryIds.length && "category"].filter(Boolean) as string[];
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <ProductCover product={p} className="w-10 shrink-0 rounded shadow-sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={m.adminHref(`products/${p.id}`)} className="block truncate font-medium hover:text-primary">
                      {p.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <StatusBadge status={p.status} publishAt={p.publishAt} />
                      <AccessBadge tier={p.access} />
                      <FormatBadge product={p} />
                      {release && <Badge variant="outline">{release.title}</Badge>}
                      {p.isSample && <Badge variant="sample">Sample</Badge>}
                      {missing.length > 0 && <span className="text-warning">Missing {missing.join(", ")}</span>}
                    </div>
                  </div>
                  <span className="hidden w-24 text-right text-xs text-muted-foreground md:block">{plural(p.files.length, "file")}</span>
                  <span className="hidden w-28 text-right text-xs text-muted-foreground lg:block">Edited {timeAgo(p.updatedAt)}</span>
                  <Button asChild size="xs" variant="outline">
                    <Link href={m.adminHref(`products/${p.id}`)}>
                      <Pencil /> Edit
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-xs" aria-label={`More actions for ${p.title}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem asChild>
                        <Link href={m.href(`library/${p.slug}`)}>
                          <Eye /> View product page
                        </Link>
                      </DropdownMenuItem>
                      {p.status !== "published" && <DropdownMenuItem onSelect={() => setProductStatus(p, "published")}>Publish now</DropdownMenuItem>}
                      {p.status === "published" && <DropdownMenuItem onSelect={() => setProductStatus(p, "draft")}>Unpublish (back to draft)</DropdownMenuItem>}
                      {p.status !== "archived" && (
                        <DropdownMenuItem onSelect={() => setProductStatus(p, "archived")}>
                          <Archive /> Archive
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={async () => {
                          try {
                            const c = await duplicateProduct(p.id);
                            if (c) toast.success(`Duplicated as “${c.title}”`);
                          } catch (e) {
                            toast.error(errorMessage(e));
                          }
                        }}
                      >
                        <Copy /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onSelect={async () => {
                          if (!(await confirm({ title: `Delete “${p.title}”?`, description: "The product, its files and its images are permanently removed from the library. Members' download history keeps the file names only.", confirmLabel: "Delete product", destructive: true }))) return;
                          await deleteProduct(p.id);
                          toast.success("Product deleted");
                        }}
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </PageContainer>
  );
}
