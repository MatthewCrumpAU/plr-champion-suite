"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, CalendarRange, CircleAlert, Database, GraduationCap, Package, Plus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, PageContainer, PageHeader, SectionTitle, Spinner, Stat } from "@/components/ui/primitives";
import { useMemberLive } from "@/lib/membership/hooks";
import { formatBytes, plural, timeAgo } from "@/lib/utils";
import { useCatalog, useMember } from "../member-context";
import { ProductCover, StatusBadge } from "../ui";
import { AdminGate } from "./admin-gate";

export function AdminHome() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  );
}

function Inner() {
  const m = useMember();
  const { data, loading } = useCatalog();
  const { data: bytes } = useMemberLive(async (r) => (await r.files.listMeta()).filter((f) => f.brandId === m.brandId).reduce((n, f) => n + f.size, 0), [m.brandId]);
  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const now = new Date();
  const published = data.products.filter((p) => p.status === "published" && (!p.publishAt || new Date(p.publishAt) <= now)).length;
  const scheduled = data.products.filter((p) => (p.status === "scheduled" || p.status === "published") && p.publishAt && new Date(p.publishAt) > now).length;
  const drafts = data.products.filter((p) => p.status === "draft");
  const issues = data.products
    .filter((p) => p.status !== "archived")
    .map((p) => ({ p, missing: [!p.coverFileId && "cover", !p.files.length && "files", !p.categoryIds.length && "category", !p.description.trim() && "description"].filter(Boolean) as string[] }))
    .filter((x) => x.missing.length);
  const recent = [...data.products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const sections = [
    { path: "products", label: "Products", text: `${plural(data.products.length, "product")} · ${drafts.length} drafts`, icon: Archive },
    { path: "categories", label: "Categories", text: plural(data.categories.length, "category", "categories"), icon: Tags },
    { path: "releases", label: "Releases", text: plural(data.releases.length, "release"), icon: CalendarRange },
    { path: "courses", label: "Training", text: plural(data.courses.length, "course or tutorial", "courses and tutorials"), icon: GraduationCap },
    { path: "resources", label: "Resources", text: plural(data.resources.length, "resource"), icon: Package },
    { path: "data", label: "Data & backup", text: `${formatBytes(bytes ?? 0)} stored in this browser`, icon: Database },
  ];

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow={`${m.brand.name} · Membership Admin`}
        title="Admin overview"
        description="Upload products, organise them into categories and monthly releases, and manage training and resources. Everything is stored in this browser until the move to a hosted database."
        actions={
          <Button asChild>
            <Link href={m.adminHref("products")}>
              <Plus /> Add a product
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Live products" value={published} />
        <Stat label="Scheduled" value={scheduled} />
        <Stat label="Drafts" value={drafts.length} />
        <Stat label="Storage used" value={formatBytes(bytes ?? 0)} hint="Product files, images and attachments" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <SectionTitle>Manage</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sections.map((s) => (
              <Link key={s.path} href={m.adminHref(s.path)} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <s.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{s.label}</span>
                  <span className="block text-sm text-muted-foreground">{s.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 content-start gap-6">
          <section>
            <SectionTitle>Needs attention</SectionTitle>
            {issues.length ? (
              <Card className="divide-y">
                {issues.slice(0, 6).map(({ p, missing }) => (
                  <Link key={p.id} href={m.adminHref(`products/${p.id}`)} className="flex items-center gap-3 p-3 text-sm hover:bg-secondary/40">
                    <CircleAlert className="size-4 shrink-0 text-warning" />
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">no {missing.join(", ")}</span>
                  </Link>
                ))}
              </Card>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Every product has a cover, files, a category and a description.</p>
            )}
          </section>
          <section>
            <SectionTitle>Recently edited</SectionTitle>
            <Card className="divide-y">
              {recent.map((p) => (
                <Link key={p.id} href={m.adminHref(`products/${p.id}`)} className="flex items-center gap-3 p-3 hover:bg-secondary/40">
                  <ProductCover product={p} className="w-8 shrink-0 rounded-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="block text-xs text-muted-foreground">{timeAgo(p.updatedAt)}</span>
                  </span>
                  <StatusBadge status={p.status} publishAt={p.publishAt} />
                </Link>
              ))}
            </Card>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
