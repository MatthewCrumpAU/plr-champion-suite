"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Copy, Download, FileText, FolderKanban, Search, ShieldCheck } from "lucide-react";
import Papa from "papaparse";
import type { Asset, Project, ProjectStage } from "@/lib/data/types";
import { PROJECT_STAGE_LABELS } from "@/lib/data/types";
import { DOCUMENT_ROLE_LABELS } from "@/lib/models/document";
import { useAllAssets, useBrandKits, useExportLog, useProjects, setActiveProjectId } from "@/lib/data/hooks";
import { assetHref, assetInfo } from "@/lib/data/asset-types";
import { findDuplicateGroups } from "@/lib/services/projects";
import { projectFunnel } from "@/lib/profit/funnel";
import { money } from "@/lib/profit/calc";
import { docWords } from "@/lib/doc/text";
import { downloadFile, safeFileName, textFile } from "@/lib/export/download";
import { PRODUCT_TYPES } from "@/components/common/project-gate";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, Checkbox, EmptyState, Input, NativeSelect, PageContainer, PageHeader, Spinner } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { cn, formatDate, normalizeTitle, timeAgo } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = Object.fromEntries(PRODUCT_TYPES);
const CAMPAIGN_TYPES = new Set(["sales-page", "email-campaign", "social-campaign"]);
const PRODUCT_ROLES = new Set(["main", "rebrand", "product", "bonus", "lead-magnet"]);

interface Row {
  project: Project;
  assets: Asset[];
  brand: string;
  price: number | null;
  priceCurrency: string;
  funnels: Asset<"funnel">[];
  campaigns: Asset[];
  products: Asset<"document">[];
  exports: number;
  lastExport: string | null;
  rightsReviewed: boolean;
}

function useRows(includeArchived: boolean) {
  const { data: projects, loading } = useProjects({ includeArchived });
  const { data: assets } = useAllAssets();
  const { data: kits } = useBrandKits();
  const { data: exports } = useExportLog(null);
  const rows: Row[] = React.useMemo(() => {
    if (!projects) return [];
    const byProject = new Map<string, Asset[]>();
    for (const a of assets ?? []) if (!a.deletedAt) byProject.set(a.projectId, [...(byProject.get(a.projectId) ?? []), a]);
    const kitName = new Map((kits ?? []).map((k) => [k.id, k.name]));
    return projects.map((p) => {
      const list = byProject.get(p.id) ?? [];
      const sales = list.filter((a) => a.type === "sales-page") as Asset<"sales-page">[];
      const priced = sales.find((s) => s.data.price.amount !== null);
      const ex = (exports ?? []).filter((e) => e.projectId === p.id);
      return {
        project: p,
        assets: list,
        brand: p.brandKitId ? (kitName.get(p.brandKitId) ?? "—") : "—",
        price: p.plannedPrice ?? priced?.data.price.amount ?? null,
        priceCurrency: p.plannedPrice !== null ? p.currency || "USD" : (priced?.data.price.currency ?? p.currency ?? "USD"),
        funnels: list.filter((a) => a.type === "funnel") as Asset<"funnel">[],
        campaigns: list.filter((a) => CAMPAIGN_TYPES.has(a.type)),
        products: list.filter((a) => a.type === "document" && PRODUCT_ROLES.has((a as Asset<"document">).data.role)) as Asset<"document">[],
        exports: ex.length,
        lastExport: ex.map((e) => e.createdAt).sort().at(-1) ?? null,
        rightsReviewed: list.some((a) => a.type === "rights-review" && !!(a as Asset<"rights-review">).data.reviewedAt),
      };
    });
  }, [projects, assets, kits, exports]);
  return { rows, loading, projects: projects ?? [], exports: exports ?? [] };
}

function assetCounts(list: Asset[]) {
  const m = new Map<string, number>();
  for (const a of list) m.set(a.type, (m.get(a.type) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Detail({ r, exportsList }: { r: Row; exportsList: { id: string; projectId: string | null; label: string; format: string; fileName: string; createdAt: string }[] }) {
  const ex = exportsList.filter((e) => e.projectId === r.project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const activate = () => setActiveProjectId(r.project.id);
  return (
    <div className="grid gap-4 border-t bg-secondary/30 p-4 lg:grid-cols-4" data-testid="portfolio-detail">
      <div className="grid content-start gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Products ({r.products.length})</p>
        {r.products.length ? (
          r.products.map((d) => (
            <Link key={d.id} href={assetHref(d)} onClick={activate} className="flex items-center gap-1.5 truncate text-[13px] hover:text-primary">
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{d.title}</span>
              <Badge variant="secondary" className="ml-auto shrink-0">
                {DOCUMENT_ROLE_LABELS[d.data.role]}
              </Badge>
            </Link>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">None yet</p>
        )}
      </div>
      <div className="grid content-start gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Funnels ({r.funnels.length})</p>
        {r.funnels.length ? (
          r.funnels.map((f) => (
            <Link key={f.id} href={assetHref(f)} onClick={activate} className="text-[13px] hover:text-primary">
              {f.title} <span className="text-[11px] text-muted-foreground">· {f.data.nodes.length} steps · {money(projectFunnel(f.data).totalRevenue, f.data.assumptions.currency || "USD", 0)} hypothetical</span>
            </Link>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No funnel attached</p>
        )}
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Campaigns ({r.campaigns.length})</p>
        {r.campaigns.map((c) => (
          <Link key={c.id} href={assetHref(c)} onClick={activate} className="truncate text-[13px] hover:text-primary">
            {assetInfo(c.type).label}: {c.title}
          </Link>
        ))}
      </div>
      <div className="grid content-start gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">All linked assets ({r.assets.length})</p>
        <div className="flex flex-wrap gap-1">
          {assetCounts(r.assets).map(([t, n]) => (
            <Badge key={t} variant="outline">
              {n} {n === 1 ? assetInfo(t as never).label.toLowerCase() : assetInfo(t as never).plural.toLowerCase()}
            </Badge>
          ))}
        </div>
      </div>
      <div className="grid content-start gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Export history ({r.exports})</p>
        {ex.length ? (
          ex.map((e) => (
            <p key={e.id} className="truncate text-[12px]">
              <span className="font-medium">{e.fileName}</span> <span className="text-muted-foreground">· {timeAgo(e.createdAt)}</span>
            </p>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Nothing exported yet</p>
        )}
      </div>
    </div>
  );
}

export function Portfolio() {
  const [includeArchived, setIncludeArchived] = React.useState(true);
  const { rows, loading, projects, exports } = useRows(includeArchived);
  const { data: allDocs } = useAllAssets<"document">("document");
  const [view, setView] = React.useState<"projects" | "products">("projects");
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("");
  const [stage, setStage] = React.useState<ProjectStage | "">("");
  const [brand, setBrand] = React.useState("");
  const [onlyDupes, setOnlyDupes] = React.useState(false);
  const [sort, setSort] = React.useState<"updated" | "created" | "name" | "price">("updated");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const dupes = React.useMemo(() => findDuplicateGroups(projects, normalizeTitle), [projects]);
  const dupeIds = new Set(dupes.flatMap((g) => g.projectIds));
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const brands = [...new Set(rows.map((r) => r.brand).filter((b) => b !== "—"))];
  const term = q.trim().toLowerCase();

  const filtered = rows
    .filter((r) => {
      const p = r.project;
      if (term && ![p.name, p.niche, p.description, p.audience, ...(p.tags ?? []), ...r.products.map((d) => d.title)].some((x) => (x ?? "").toLowerCase().includes(term))) return false;
      if (type && p.productType !== type) return false;
      if (stage && p.stage !== stage) return false;
      if (brand && r.brand !== brand) return false;
      if (onlyDupes && !dupeIds.has(p.id)) return false;
      return true;
    })
    .sort((a, b) => (sort === "name" ? a.project.name.localeCompare(b.project.name) : sort === "created" ? b.project.createdAt.localeCompare(a.project.createdAt) : sort === "price" ? (b.price ?? -1) - (a.price ?? -1) : b.project.updatedAt.localeCompare(a.project.updatedAt)));

  const products = (allDocs ?? []).filter((d) => !d.deletedAt && PRODUCT_ROLES.has(d.data.role) && names.has(d.projectId) && (!term || d.title.toLowerCase().includes(term) || (names.get(d.projectId) ?? "").toLowerCase().includes(term)));

  const exportCsv = () => {
    const csv = Papa.unparse(
      filtered.map((r) => ({
        product: r.project.name,
        type: TYPE_LABEL[r.project.productType] ?? r.project.productType,
        niche: r.project.niche,
        brand: r.brand,
        price: r.price ?? "",
        currency: r.price !== null ? r.priceCurrency : "",
        created: r.project.createdAt.slice(0, 10),
        status: r.project.status === "archived" ? "Archived" : PROJECT_STAGE_LABELS[r.project.stage],
        linked_assets: r.assets.length,
        product_documents: r.products.map((d) => d.title).join("; "),
        funnels: r.funnels.map((f) => f.title).join("; "),
        campaigns: r.campaigns.map((c) => c.title).join("; "),
        exports: r.exports,
        licence_reviewed: r.rightsReviewed ? "yes" : "no",
      })),
    );
    downloadFile(textFile(csv, safeFileName("product-portfolio", "csv"), "text/csv"));
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Profit Studio"
        title="Product Portfolio"
        description="Every product you've created, in one place — type, niche, brand, price, status, linked assets, funnels, campaigns and export history. Search, filter and spot duplicates."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length} data-testid="portfolio-csv">
            <Download /> Export CSV
          </Button>
        }
      />
      {dupes.length > 0 && (
        <Callout tone="warning" icon={<Copy />} title={`${dupes.length} possible duplicate group${dupes.length === 1 ? "" : "s"}`} className="mb-4">
          <ul className="grid gap-1 text-[13px]" data-testid="portfolio-duplicates">
            {dupes.map((g, i) => (
              <li key={i}>
                <b>{g.reason}:</b> {g.projectIds.map((id) => names.get(id)).join(" · ")}
              </li>
            ))}
          </ul>
        </Callout>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as "projects" | "products")}>
          <TabsList>
            <TabsTrigger value="projects">Projects ({rows.length})</TabsTrigger>
            <TabsTrigger value="products" data-testid="portfolio-products-tab">
              All product documents ({products.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, niche, tags…" className="h-9 w-60 pl-8" data-testid="portfolio-search" />
        </div>
        {view === "projects" && (
          <>
            <NativeSelect value={type} onChange={(e) => setType(e.target.value)} className="h-9 w-auto text-sm" aria-label="Type">
              <option value="">All types</option>
              {PRODUCT_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={stage} onChange={(e) => setStage(e.target.value as ProjectStage | "")} className="h-9 w-auto text-sm" aria-label="Status">
              <option value="">All statuses</option>
              {Object.entries(PROJECT_STAGE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
            {brands.length > 0 && (
              <NativeSelect value={brand} onChange={(e) => setBrand(e.target.value)} className="h-9 w-auto text-sm" aria-label="Brand">
                <option value="">All brands</option>
                {brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </NativeSelect>
            )}
            <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 w-auto text-sm" aria-label="Sort">
              <option value="updated">Recently updated</option>
              <option value="created">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="price">Highest price</option>
            </NativeSelect>
            <label className="flex items-center gap-1.5 text-sm">
              <Checkbox checked={includeArchived} onCheckedChange={(v) => setIncludeArchived(!!v)} /> Include archived
            </label>
            {dupes.length > 0 && (
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={onlyDupes} onCheckedChange={(v) => setOnlyDupes(!!v)} /> Duplicates only
              </label>
            )}
          </>
        )}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Spinner /> Loading…
        </div>
      ) : view === "projects" ? (
        filtered.length ? (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[1100px] text-[13px]" data-testid="portfolio-table">
              <thead className="bg-secondary text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  {["Product", "Type", "Niche", "Brand", "Price", "Created", "Status", "Assets", "Funnel", "Campaigns", "Exports"].map((h) => (
                    <th key={h} className="px-3 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const p = r.project;
                  const isOpen = expanded === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      <tr className={cn("border-t hover:bg-secondary/40", isOpen && "bg-secondary/40")} data-testid="portfolio-row">
                        <td className="px-2">
                          <button type="button" onClick={() => setExpanded(isOpen ? null : p.id)} aria-label={isOpen ? "Collapse" : "Expand"} className="p-1 text-muted-foreground">
                            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                        </td>
                        <td className="max-w-64 px-3 py-2.5">
                          <Link href={`/projects/view?id=${p.id}`} onClick={() => setActiveProjectId(p.id)} className="block truncate font-semibold hover:text-primary">
                            {p.name}
                          </Link>
                          <span className="flex flex-wrap gap-1 pt-0.5">
                            {p.isSample && <Badge variant="sample">Sample</Badge>}
                            {dupeIds.has(p.id) && <Badge variant="warning">Possible duplicate</Badge>}
                            {r.rightsReviewed && (
                              <Badge variant="success">
                                <ShieldCheck /> Licence reviewed
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="px-3">{TYPE_LABEL[p.productType] ?? p.productType}</td>
                        <td className="max-w-40 truncate px-3">{p.niche || "—"}</td>
                        <td className="max-w-36 truncate px-3">{r.brand}</td>
                        <td className="px-3 tabular-nums">{r.price !== null ? money(r.price, r.priceCurrency) : "—"}</td>
                        <td className="whitespace-nowrap px-3">{formatDate(p.createdAt)}</td>
                        <td className="px-3">{p.status === "archived" ? <Badge variant="secondary">Archived</Badge> : <Badge variant={p.stage === "launched" ? "success" : "outline"}>{PROJECT_STAGE_LABELS[p.stage]}</Badge>}</td>
                        <td className="px-3 tabular-nums">{r.assets.length}</td>
                        <td className="max-w-40 truncate px-3">{r.funnels[0]?.title ?? "—"}</td>
                        <td className="px-3 tabular-nums">{r.campaigns.length}</td>
                        <td className="whitespace-nowrap px-3 tabular-nums">
                          {r.exports}
                          {r.lastExport && <span className="block text-[10.5px] text-muted-foreground">last {timeAgo(r.lastExport)}</span>}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={12} className="p-0">
                            <Detail r={r} exportsList={exports} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ) : (
          <EmptyState icon={<FolderKanban />} title="No products match" description="Try clearing the search or filters." />
        )
      ) : products.length ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-[13px]" data-testid="portfolio-products">
            <thead className="bg-secondary text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Document", "Role", "Format", "Project", "Words", "Status", "Updated"].map((h) => (
                  <th key={h} className="px-3 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((d) => (
                  <tr key={d.id} className="border-t hover:bg-secondary/40">
                    <td className="max-w-72 truncate px-3 py-2.5 font-medium">
                      <Link href={assetHref(d)} onClick={() => setActiveProjectId(d.projectId)} className="hover:text-primary">
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-3">
                      <Badge variant="secondary">{DOCUMENT_ROLE_LABELS[d.data.role]}</Badge>
                    </td>
                    <td className="px-3 capitalize">{(d.data.builder?.format ?? d.data.format).replace(/-/g, " ")}</td>
                    <td className="max-w-56 truncate px-3">{names.get(d.projectId)}</td>
                    <td className="px-3 tabular-nums">{d.data.chapters.reduce((n, c) => n + docWords(c.content), 0).toLocaleString()}</td>
                    <td className="px-3 capitalize">{d.status.replace("-", " ")}</td>
                    <td className="whitespace-nowrap px-3">{timeAgo(d.updatedAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState icon={<FileText />} title="No product documents yet" description="Import PLR in the PLR Editor or build products, bonuses and lead magnets in the Product Studio." />
      )}
    </PageContainer>
  );
}
