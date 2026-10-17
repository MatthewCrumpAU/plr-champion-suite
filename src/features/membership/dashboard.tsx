"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarRange, FileText, FolderDown, GraduationCap, Hammer, LibraryBig, Settings2, Sparkles, Wand2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageContainer, Progress, SectionTitle, Spinner, Stat } from "@/components/ui/primitives";
import { toggleFavourite } from "@/lib/membership/member-actions";
import { isLive } from "@/lib/membership/access";
import { courseStats, currentRelease, isThisMonth } from "@/lib/membership/progress";
import { cn, errorMessage, formatBytes, plural, timeAgo } from "@/lib/utils";
import { useMember, useMemberActivity, useVisibleProducts } from "./member-context";
import { ProductCard, ProductCover, StoredImage } from "./ui";

const TOOLS = [
  { path: "tools/editor", label: "PLR Editor", text: "Open any library product and make it yours.", icon: FileText },
  { path: "tools/rebrand", label: "Rebrand Studio", text: "Swap names, brands and links in one pass.", icon: Wand2 },
  { path: "tools/builder", label: "Product Builder", text: "Turn chapters into workbooks and courses.", icon: Hammer },
  { path: "tools/profit-map", label: "Profit Map", text: "Plan the funnel that sells it.", icon: Workflow },
];

export function MemberDashboard() {
  const m = useMember();
  const { products, catalog, loading } = useVisibleProducts();
  const { data: activity } = useMemberActivity();

  if (loading || !catalog) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }

  const usable = products.filter((p) => m.canUse(p));
  const newThisMonth = products.filter((p) => isThisMonth(p.publishAt));
  const drop = currentRelease(catalog.releases, (r) => isLive(r));
  const dropProducts = drop ? products.filter((p) => drop.productIds.includes(p.id)) : [];
  const nextDrop = catalog.releases.filter((r) => r.status === "scheduled" && r.publishAt && new Date(r.publishAt) > new Date()).sort((a, b) => a.month.localeCompare(b.month))[0];
  const featured = products.filter((p) => p.featured).slice(0, 4);
  const courses = catalog.courses.filter((c) => m.canSee({ status: c.status, publishAt: null }));
  const stats = courses.map((c) => ({ c, s: courseStats(c, activity?.progress ?? []) }));
  const learning = stats.filter((x) => x.s.completed > 0 && x.s.completed < x.s.total).sort((a, b) => (b.s.lastActivity ?? "").localeCompare(a.s.lastActivity ?? ""));
  const suggested = learning.length ? learning.slice(0, 2) : stats.filter((x) => x.c.kind === "course").slice(0, 2);
  const lessonsDone = (activity?.progress ?? []).filter((p) => p.completedAt).length;
  const recent = products.slice(0, 5);
  const fav = activity?.favourites ?? new Set<string>();

  const drafts = catalog.products.filter((p) => p.status === "draft").length;
  const scheduled = catalog.products.filter((p) => p.status === "scheduled" || (p.publishAt && new Date(p.publishAt) > new Date() && p.status === "published")).length;

  return (
    <PageContainer width="wide">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl p-6 text-white shadow-sm sm:p-8" style={{ background: `linear-gradient(120deg, ${m.brand.theme.sidebar} 0%, ${m.brand.theme.sidebarAccent} 45%, ${m.brand.theme.primary} 130%)` }}>
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-25 blur-2xl" style={{ background: m.brand.theme.highlight }} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: m.brand.theme.highlight }}>
          {m.brand.tagline}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {m.account.displayName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-[15px]">{m.brand.promise}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild className="bg-white text-foreground hover:bg-white/90">
            <Link href={m.href("library")}>
              <LibraryBig /> Browse the library
            </Link>
          </Button>
          {drop && (
            <Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href={m.href(`drops/${drop.id}`)}>
                <CalendarRange /> {drop.title} drop
              </Link>
            </Button>
          )}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Products you can use" value={usable.length} hint={`${products.length} in the library`} />
        <Stat label="New this month" value={newThisMonth.length} hint={drop ? drop.theme : undefined} />
        <Stat label="Your downloads" value={activity?.downloads.length ?? 0} hint={activity?.downloads[0] ? `Last ${timeAgo(activity.downloads[0].createdAt)}` : "Nothing yet"} />
        <Stat label="Lessons completed" value={lessonsDone} hint={`${courses.length} courses & tutorials`} />
      </div>

      {m.isAdmin && (
        <Card className="mt-6 flex flex-col gap-3 border-dashed p-4 sm:flex-row sm:items-center" data-testid="admin-snapshot">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Settings2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Membership admin</p>
            <p className="text-muted-foreground">
              {plural(catalog.products.length, "product")} · {plural(drafts, "draft")} · {scheduled} scheduled · {plural(catalog.releases.length, "release")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={m.adminHref("products")}>Manage products</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={m.adminHref()}>Open admin</Link>
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid grid-cols-1 min-w-0 gap-8">
          {drop && (
            <section>
              <SectionTitle action={<Link href={m.href("drops")} className="text-xs font-medium text-primary hover:underline">All {m.brand.dropName.toLowerCase()}s</Link>}>This month&apos;s drop</SectionTitle>
              <Card className="grid grid-cols-1 gap-5 overflow-hidden p-0 sm:grid-cols-[180px_minmax(0,1fr)]">
                <StoredImage fileId={drop.coverFileId} alt={`${drop.title} drop`} className="h-full max-h-60 w-full sm:max-h-none" />
                <div className="p-5 sm:pl-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{drop.title}</Badge>
                    <span className="text-xs text-muted-foreground">{plural(dropProducts.length, "product")}</span>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">{drop.theme}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{drop.description}</p>
                  <div className="mt-4 flex -space-x-3">
                    {dropProducts.slice(0, 5).map((p) => (
                      <Link key={p.id} href={m.href(`library/${p.slug}`)} className="w-14 shrink-0 transition hover:z-10 hover:-translate-y-1" title={p.title}>
                        <ProductCover product={p} className="rounded-md shadow-md ring-2 ring-card" />
                      </Link>
                    ))}
                  </div>
                  <Button asChild size="sm" className="mt-4">
                    <Link href={m.href(`drops/${drop.id}`)}>
                      View the drop <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </Card>
              {nextDrop && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Coming next: <span className="font-medium text-foreground">{nextDrop.theme || nextDrop.title}</span> on {new Date(nextDrop.publishAt!).toLocaleDateString(undefined, { day: "numeric", month: "long" })}
                </p>
              )}
            </section>
          )}

          {featured.length > 0 && (
            <section>
              <SectionTitle action={<Link href={m.href("library")} className="text-xs font-medium text-primary hover:underline">Browse all</Link>}>Featured products</SectionTitle>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {featured.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    href={m.href(`library/${p.slug}`)}
                    categories={catalog.categories}
                    lock={m.lockReason(p)}
                    favourite={fav.has(p.id)}
                    onToggleFavourite={() => toggleFavourite(m.brandId, m.account.id, p.id).catch((e) => toast.error(errorMessage(e)))}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle>Build with your membership</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TOOLS.map((t) => (
                <Link key={t.path} href={m.href(t.path)} className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <t.icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-semibold">
                      {t.label} <ArrowRight className="size-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{t.text}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="grid grid-cols-1 content-start gap-6">
          <section>
            <SectionTitle action={<Link href={m.href("training")} className="text-xs font-medium text-primary hover:underline">Training Centre</Link>}>{learning.length ? "Continue learning" : "Start learning"}</SectionTitle>
            <div className="grid grid-cols-1 gap-3">
              {suggested.map(({ c, s }) => (
                <Link key={c.id} href={m.href(`courses/${c.id}${s.next ? `?lesson=${s.next.lesson.id}` : ""}`)} className="flex gap-3 rounded-xl border bg-card p-3 transition hover:shadow-sm">
                  <StoredImage fileId={c.coverFileId} alt="" className="aspect-video w-20 shrink-0 self-center rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.next ? `Next: ${s.next.lesson.title}` : `${s.total} lessons`}</p>
                    <Progress value={s.pct} className="mt-2 h-1.5" />
                  </div>
                </Link>
              ))}
              {!suggested.length && (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  <GraduationCap className="mb-1 size-4" /> Training will appear here once courses are published.
                </p>
              )}
            </div>
          </section>

          <section>
            <SectionTitle>Recently added</SectionTitle>
            <ul className="grid grid-cols-1 gap-1">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link href={m.href(`library/${p.slug}`)} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-card">
                    <ProductCover product={p} className="w-9 rounded shadow-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                      <span className="block text-xs text-muted-foreground">{timeAgo(p.publishAt ?? p.createdAt)}</span>
                    </span>
                    {!m.canUse(p) && <Badge variant="outline">Locked</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionTitle action={<Link href={m.href("my-downloads")} className="text-xs font-medium text-primary hover:underline">History</Link>}>Your recent downloads</SectionTitle>
            {activity?.downloads.length ? (
              <ul className="grid grid-cols-1 gap-2">
                {activity.downloads.slice(0, 4).map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm">
                    <FolderDown className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{d.fileName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(d.size)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn("rounded-xl border border-dashed p-4 text-sm text-muted-foreground")}>
                <Sparkles className="mb-1 size-4" /> Files you download appear here so you can grab them again.
              </p>
            )}
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
