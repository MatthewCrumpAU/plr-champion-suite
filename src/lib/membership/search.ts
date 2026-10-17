import type { AccessTier, LicenceRightKey, Product, ProductFormat, RightValue } from "./types";

/** Advanced library search — pure functions so they're fast, testable and reusable on a server. */

export type SortKey = "relevance" | "newest" | "oldest" | "title" | "longest";
export const SORT_LABELS: Record<SortKey, string> = { relevance: "Best match", newest: "Newest", oldest: "Oldest", title: "Title A–Z", longest: "Longest" };

export interface SearchQuery {
  text: string;
  categoryIds: string[];
  formats: ProductFormat[];
  /** Only products whose licence grants ALL of these rights ("yes"). */
  rights: LicenceRightKey[];
  access: AccessTier[];
  releaseId: string | null;
  /** Only products with a file that opens in the PLR Editor. */
  editableOnly: boolean;
  favouritesOnly: boolean;
  sort: SortKey;
}

export const EMPTY_QUERY: SearchQuery = { text: "", categoryIds: [], formats: [], rights: [], access: [], releaseId: null, editableOnly: false, favouritesOnly: false, sort: "relevance" };

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Splits a query into terms, keeping "quoted phrases" together. */
export function parseTerms(text: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = normalise(m[1] ?? m[2] ?? "");
    if (t) out.push(t);
  }
  return out;
}

/** Relevance score; 0 means "doesn't match every term". Title matches weigh most. */
export function scoreProduct(p: Product, terms: string[], categoryNames: Record<string, string> = {}): number {
  if (!terms.length) return 1;
  const title = normalise(p.title);
  const subtitle = normalise(p.subtitle);
  const tags = normalise(p.tags.join(" "));
  const cats = normalise(p.categoryIds.map((id) => categoryNames[id] ?? "").join(" "));
  const body = normalise(`${p.description} ${p.highlights.join(" ")} ${p.files.map((f) => f.name).join(" ")}`);
  let score = 0;
  for (const t of terms) {
    let s = 0;
    if (title.includes(t)) s += title.startsWith(t) ? 12 : 8;
    if (subtitle.includes(t)) s += 4;
    if (tags.includes(t)) s += 5;
    if (cats.includes(t)) s += 3;
    if (body.includes(t)) s += 1;
    if (!s) return 0;
    score += s;
  }
  return score;
}

export function filterProducts(products: Product[], q: SearchQuery, opts: { favourites?: Set<string>; categoryNames?: Record<string, string> } = {}): Product[] {
  const terms = parseTerms(q.text);
  const scored: { p: Product; s: number }[] = [];
  for (const p of products) {
    if (q.categoryIds.length && !q.categoryIds.some((c) => p.categoryIds.includes(c))) continue;
    if (q.formats.length && !q.formats.includes(p.format)) continue;
    if (q.access.length && !q.access.includes(p.access)) continue;
    if (q.releaseId && p.releaseId !== q.releaseId) continue;
    if (q.editableOnly && !p.files.some((f) => f.editable)) continue;
    if (q.favouritesOnly && !opts.favourites?.has(p.id)) continue;
    if (q.rights.length && !q.rights.every((r) => p.licence.rights[r] === ("yes" satisfies RightValue))) continue;
    const s = scoreProduct(p, terms, opts.categoryNames);
    if (!s) continue;
    scored.push({ p, s });
  }
  const sort = q.sort === "relevance" && !terms.length ? "newest" : q.sort;
  const date = (p: Product) => p.publishAt ?? p.createdAt;
  scored.sort((a, b) => {
    switch (sort) {
      case "relevance":
        return b.s - a.s || date(b.p).localeCompare(date(a.p));
      case "newest":
        return date(b.p).localeCompare(date(a.p));
      case "oldest":
        return date(a.p).localeCompare(date(b.p));
      case "title":
        return a.p.title.localeCompare(b.p.title);
      case "longest":
        return (b.p.wordCount ?? 0) - (a.p.wordCount ?? 0);
    }
  });
  return scored.map((x) => x.p);
}

/** Serialise a query into URL search params (and back) so searches are shareable and survive reloads. */
export function queryToParams(q: SearchQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.text) p.set("q", q.text);
  if (q.categoryIds.length) p.set("cat", q.categoryIds.join(","));
  if (q.formats.length) p.set("format", q.formats.join(","));
  if (q.rights.length) p.set("rights", q.rights.join(","));
  if (q.access.length) p.set("access", q.access.join(","));
  if (q.releaseId) p.set("drop", q.releaseId);
  if (q.editableOnly) p.set("editable", "1");
  if (q.favouritesOnly) p.set("saved", "1");
  if (q.sort !== "relevance") p.set("sort", q.sort);
  return p;
}

export function paramsToQuery(p: URLSearchParams): SearchQuery {
  const list = (k: string) => (p.get(k) ?? "").split(",").filter(Boolean);
  return {
    text: p.get("q") ?? "",
    categoryIds: list("cat"),
    formats: list("format") as ProductFormat[],
    rights: list("rights") as LicenceRightKey[],
    access: list("access") as AccessTier[],
    releaseId: p.get("drop"),
    editableOnly: p.get("editable") === "1",
    favouritesOnly: p.get("saved") === "1",
    sort: (p.get("sort") as SortKey) ?? "relevance",
  };
}
