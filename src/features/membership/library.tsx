"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Filter, LayoutGrid, List, Search, SearchX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Checkbox, EmptyState, Input, Label, NativeSelect, PageContainer, PageHeader, Spinner } from "@/components/ui/primitives";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/overlays";
import { EMPTY_QUERY, filterProducts, paramsToQuery, queryToParams, SORT_LABELS, type SearchQuery, type SortKey } from "@/lib/membership/search";
import { toggleFavourite } from "@/lib/membership/member-actions";
import { ACCESS_TIERS, ACCESS_TIER_LABELS, PRODUCT_FORMAT_LABELS, type LicenceRightKey, type Product } from "@/lib/membership/types";
import { cn, errorMessage, formatDate, formatNumber, plural } from "@/lib/utils";
import { useMember, useMemberActivity, useVisibleProducts, type BrandCatalog } from "./member-context";
import { AccessBadge, CategoryIcon, FormatBadge, ProductCard, ProductCover, StatusBadge } from "./ui";

const RIGHT_FILTERS: { key: LicenceRightKey; label: string }[] = [
  { key: "edit", label: "Can edit & rebrand" },
  { key: "sell", label: "Can sell" },
  { key: "giveAway", label: "Can give away" },
  { key: "addToMembership", label: "Can add to a membership" },
  { key: "breakUp", label: "Can break into articles/emails" },
];

function useUrlQuery(): [SearchQuery, (patch: Partial<SearchQuery>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = React.useMemo(() => paramsToQuery(new URLSearchParams(params.toString())), [params]);
  const set = React.useCallback(
    (patch: Partial<SearchQuery>) => {
      const next = queryToParams({ ...query, ...patch }).toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [query, router, pathname],
  );
  return [query, set];
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function FilterPanel({ query, set, catalog, products }: { query: SearchQuery; set: (p: Partial<SearchQuery>) => void; catalog: BrandCatalog; products: Product[] }) {
  const m = useMember();
  const formats = [...new Set(products.map((p) => p.format))];
  const releases = catalog.releases.filter((r) => m.canSee(r));
  const active = queryToParams({ ...query, text: "", sort: "relevance" }).toString().length > 0;
  return (
    <div className="grid grid-cols-1 gap-6 text-sm" data-testid="filter-panel">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Filters</p>
        {active && (
          <Button variant="link" size="xs" className="h-auto p-0" onClick={() => set({ ...EMPTY_QUERY, text: query.text, sort: query.sort })}>
            Clear all
          </Button>
        )}
      </div>
      <fieldset className="grid grid-cols-1 gap-2">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Category</legend>
        {catalog.categories.map((c) => {
          const count = products.filter((p) => p.categoryIds.includes(c.id)).length;
          return (
            <label key={c.id} className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={query.categoryIds.includes(c.id)} onCheckedChange={() => set({ categoryIds: toggle(query.categoryIds, c.id) })} aria-label={c.name} />
              <CategoryIcon icon={c.icon} className="size-3.5" />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-muted-foreground">{count}</span>
            </label>
          );
        })}
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-2">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Format</legend>
        {formats.map((f) => (
          <label key={f} className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={query.formats.includes(f)} onCheckedChange={() => set({ formats: toggle(query.formats, f) })} aria-label={PRODUCT_FORMAT_LABELS[f]} />
            <span className="flex-1">{PRODUCT_FORMAT_LABELS[f]}</span>
            <span className="text-xs text-muted-foreground">{products.filter((p) => p.format === f).length}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-2">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Licence allows</legend>
        {RIGHT_FILTERS.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={query.rights.includes(r.key)} onCheckedChange={() => set({ rights: toggle(query.rights, r.key) })} aria-label={r.label} />
            <span>{r.label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-2">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Access level</legend>
        {ACCESS_TIERS.map((t) => (
          <label key={t} className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={query.access.includes(t)} onCheckedChange={() => set({ access: toggle(query.access, t) })} aria-label={`${ACCESS_TIER_LABELS[t]} access`} />
            <span>{ACCESS_TIER_LABELS[t]}</span>
          </label>
        ))}
      </fieldset>
      {releases.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          <Label htmlFor="f-drop" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {m.brand.dropName}
          </Label>
          <NativeSelect id="f-drop" value={query.releaseId ?? ""} onChange={(e) => set({ releaseId: e.target.value || null })}>
            <option value="">Any drop</option>
            {releases.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
                {r.theme ? ` — ${r.theme}` : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2">
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={query.editableOnly} onCheckedChange={(v) => set({ editableOnly: !!v })} aria-label="Opens in the PLR Editor" />
          <span>Opens in the PLR Editor</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={query.favouritesOnly} onCheckedChange={(v) => set({ favouritesOnly: !!v })} aria-label="Saved products only" />
          <span>Saved products only</span>
        </label>
      </div>
    </div>
  );
}

function ResultRow({ p, catalog }: { p: Product; catalog: BrandCatalog }) {
  const m = useMember();
  const cats = catalog.categories.filter((c) => p.categoryIds.includes(c.id));
  const lock = m.lockReason(p);
  const yes = (k: LicenceRightKey) => p.licence.rights[k] === "yes";
  return (
    <li className="relative flex gap-4 rounded-xl border bg-card p-3 transition hover:shadow-sm" data-testid="result-row">
      <ProductCover product={p} className="w-16 shrink-0 rounded-md shadow-sm sm:w-20" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <AccessBadge tier={p.access} />
          <FormatBadge product={p} />
          {m.isAdmin && <StatusBadge status={p.status} publishAt={p.publishAt} />}
          {lock && <Badge variant="outline">{lock}</Badge>}
        </div>
        <Link href={m.href(`library/${p.slug}`)} className="mt-1 block font-semibold after:absolute after:inset-0 hover:text-primary">
          {p.title}
        </Link>
        <p className="line-clamp-1 text-sm text-muted-foreground">{p.subtitle}</p>
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{cats.map((c) => c.name).join(", ") || "Uncategorised"}</span>
          <span>{p.licence.type.toUpperCase()}: {[yes("edit") && "edit", yes("sell") && "sell", yes("giveAway") && "give away"].filter(Boolean).join(" · ") || "see licence"}</span>
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3" /> {plural(p.files.length, "file")}
          </span>
          {p.wordCount ? <span>{formatNumber(p.wordCount)} words</span> : null}
          <span>{formatDate(p.publishAt ?? p.createdAt)}</span>
        </p>
      </div>
    </li>
  );
}

export function Library({ advanced = false }: { advanced?: boolean }) {
  const m = useMember();
  const { products, catalog, loading } = useVisibleProducts();
  const { data: activity } = useMemberActivity();
  const [query, set] = useUrlQuery();
  const [text, setText] = React.useState(query.text);
  const [view, setView] = React.useState<"grid" | "list">(advanced ? "list" : "grid");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // Keep the box in sync when the URL changes (e.g. header search), and push typing to the URL.
  React.useEffect(() => setText(query.text), [query.text]);
  React.useEffect(() => {
    if (text === query.text) return;
    const t = setTimeout(() => set({ text }), 250);
    return () => clearTimeout(t);
  }, [text, query.text, set]);

  if (loading || !catalog) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading the library…
      </div>
    );
  }

  const categoryNames = Object.fromEntries(catalog.categories.map((c) => [c.id, c.name]));
  const results = filterProducts(products, query, { favourites: activity?.favourites, categoryNames });
  const fav = activity?.favourites ?? new Set<string>();
  const panel = <FilterPanel query={query} set={set} catalog={catalog} products={products} />;
  const activeFilters = queryToParams({ ...query, text: "", sort: "relevance" }).toString().length > 0;

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow={m.brand.name}
        title={advanced ? "Advanced Search" : "PLR Product Library"}
        description={advanced ? "Search titles, descriptions, tags and file names, then narrow by category, format, licence rights, access level and drop. Use “quotes” for exact phrases." : `${plural(products.length, "product")} ready to download, rebrand and sell.`}
      />

      {!advanced && catalog.categories.length > 0 && (
        <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 plr-scroll-none">
          <button type="button" onClick={() => set({ categoryIds: [] })} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition", !query.categoryIds.length ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary")}>
            All products
          </button>
          {catalog.categories.map((c) => {
            const on = query.categoryIds.length === 1 && query.categoryIds[0] === c.id;
            return (
              <button key={c.id} type="button" onClick={() => set({ categoryIds: on ? [] : [c.id] })} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary")}>
                <CategoryIcon icon={c.icon} className="size-3.5" /> {c.name}
              </button>
            );
          })}
        </div>
      )}

      <div className={cn("grid gap-6", advanced && "lg:grid-cols-[240px_minmax(0,1fr)]")}>
        {advanced && <aside className="hidden lg:block">{panel}</aside>}
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={advanced ? 'Try: budget "morning routine"' : "Search products"} className="pl-8" aria-label="Search products" data-testid="library-search" />
            </div>
            {advanced && (
              <Button variant="outline" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                <Filter /> Filters
              </Button>
            )}
            <NativeSelect value={query.sort} onChange={(e) => set({ sort: e.target.value as SortKey })} className="w-auto" aria-label="Sort by">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </NativeSelect>
            <div className="flex rounded-lg border bg-card p-0.5">
              <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon-xs" onClick={() => setView("grid")} aria-label="Grid view" aria-pressed={view === "grid"}>
                <LayoutGrid />
              </Button>
              <Button variant={view === "list" ? "secondary" : "ghost"} size="icon-xs" onClick={() => setView("list")} aria-label="List view" aria-pressed={view === "list"}>
                <List />
              </Button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span data-testid="result-count">{plural(results.length, "result")}</span>
            {query.text && (
              <Badge variant="secondary">
                “{query.text}”
                <button type="button" onClick={() => set({ text: "" })} aria-label="Clear search">
                  <X />
                </button>
              </Badge>
            )}
            {!advanced && activeFilters && (
              <Link href={`${m.href("search")}?${queryToParams(query).toString()}`} className="text-xs font-medium text-primary hover:underline">
                Refine in Advanced Search
              </Link>
            )}
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title="No products match"
              description={products.length ? "Try fewer words or remove a filter." : "Nothing has been published yet."}
              action={
                products.length ? (
                  <Button variant="outline" onClick={() => set(EMPTY_QUERY)}>
                    Clear search and filters
                  </Button>
                ) : m.isAdmin ? (
                  <Button asChild>
                    <Link href={m.adminHref("products")}>Add a product</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : view === "grid" ? (
            <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3", advanced ? "xl:grid-cols-4" : "lg:grid-cols-4 2xl:grid-cols-5")}>
              {results.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  href={m.href(`library/${p.slug}`)}
                  categories={catalog.categories}
                  lock={m.lockReason(p)}
                  showStatus={m.isAdmin && p.status !== "published"}
                  favourite={fav.has(p.id)}
                  onToggleFavourite={() => toggleFavourite(m.brandId, m.account.id, p.id).catch((e) => toast.error(errorMessage(e)))}
                />
              ))}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {results.map((p) => (
                <ResultRow key={p.id} p={p} catalog={catalog} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-[300px] overflow-y-auto p-5">
          <SheetTitle className="sr-only">Filters</SheetTitle>
          {panel}
        </SheetContent>
      </Sheet>
    </PageContainer>
  );
}

