import { nowIso, slugify, uid } from "@/lib/utils";
import { getMembershipRepos, type MembershipRepositories } from "./db";
import { deleteMemberFiles, isEditableFile, storeMemberFile } from "./files";
import type { BrandId, Category, Course, Licence, LicenceRightKey, Product, ProductAttachment, ProductFileKind, Release, Resource, RightValue } from "./types";
import { LICENCE_RIGHTS } from "./types";

/** Catalogue services used by both the admin screens and the seeding/import code. */

const R = (repos?: MembershipRepositories) => repos ?? getMembershipRepos();

export function defaultLicence(type: Licence["type"] = "plr"): Licence {
  const v = (x: RightValue) => Object.fromEntries(LICENCE_RIGHTS.map(([k]) => [k, x])) as Record<LicenceRightKey, RightValue>;
  if (type === "personal") return { type, rights: v("no"), terms: "", fileId: null };
  const rights = v("unclear");
  if (type === "plr") Object.assign(rights, { edit: "yes", claimAuthorship: "yes", sell: "yes", giveAway: "yes", useAsBonus: "yes", breakUp: "yes", addToMembership: "conditional", sellPlr: "no" });
  if (type === "mrr") Object.assign(rights, { edit: "no", claimAuthorship: "no", sell: "yes", giveAway: "conditional", sellPlr: "no" });
  if (type === "rr") Object.assign(rights, { edit: "no", claimAuthorship: "no", sell: "yes", giveAway: "no", sellPlr: "no" });
  return { type, rights, terms: "", fileId: null };
}

async function uniqueSlug<T extends { id: string; slug: string }>(list: T[], base: string, selfId?: string): Promise<string> {
  const root = slugify(base) || "item";
  let slug = root;
  let n = 2;
  while (list.some((x) => x.slug === slug && x.id !== selfId)) slug = `${root}-${n++}`;
  return slug;
}

/* ---------------------------------- Categories ---------------------------------- */
export async function saveCategory(brandId: BrandId, input: Partial<Category> & { name: string }, repos?: MembershipRepositories): Promise<Category> {
  const r = R(repos);
  const all = await r.categories.list(brandId);
  const now = nowIso();
  const existing = input.id ? all.find((c) => c.id === input.id) : undefined;
  const cat: Category = {
    id: existing?.id ?? uid("cat"),
    brandId,
    name: input.name.trim() || "Untitled category",
    slug: await uniqueSlug(all, input.slug || input.name, existing?.id),
    description: input.description ?? existing?.description ?? "",
    icon: input.icon ?? existing?.icon ?? "folder",
    color: input.color ?? existing?.color ?? "#5b4df5",
    order: input.order ?? existing?.order ?? all.length,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await r.categories.put(cat);
  return cat;
}

export async function deleteCategory(id: string, repos?: MembershipRepositories) {
  const r = R(repos);
  const cat = await r.categories.get(id);
  if (!cat) return;
  const products = await r.products.list(cat.brandId);
  const touched = products.filter((p) => p.categoryIds.includes(id)).map((p) => ({ ...p, categoryIds: p.categoryIds.filter((c) => c !== id), updatedAt: nowIso() }));
  await r.transaction(async () => {
    if (touched.length) await r.products.bulkPut(touched);
    await r.categories.delete(id);
  });
}

export async function reorderCategories(brandId: BrandId, orderedIds: string[], repos?: MembershipRepositories) {
  const r = R(repos);
  const all = await r.categories.list(brandId);
  await r.categories.bulkPut(all.map((c) => ({ ...c, order: Math.max(0, orderedIds.indexOf(c.id)) })));
}

/* ----------------------------------- Products ----------------------------------- */
export function newProduct(brandId: BrandId, patch: Partial<Product> = {}): Product {
  const now = nowIso();
  return {
    id: uid("prod"),
    brandId,
    slug: "",
    title: "Untitled product",
    subtitle: "",
    description: "",
    highlights: [],
    format: "ebook",
    categoryIds: [],
    tags: [],
    coverFileId: null,
    galleryFileIds: [],
    files: [],
    licence: defaultLicence("plr"),
    wordCount: null,
    pageCount: null,
    releaseId: null,
    access: "member",
    status: "draft",
    publishAt: null,
    featured: false,
    isSample: false,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

export async function saveProduct(p: Product, repos?: MembershipRepositories): Promise<Product> {
  const r = R(repos);
  const all = await r.products.list(p.brandId);
  const prev = all.find((x) => x.id === p.id);
  const next: Product = { ...p, title: p.title.trim() || "Untitled product", slug: await uniqueSlug(all, p.slug || p.title, p.id), updatedAt: nowIso() };
  if (next.status === "published" && !next.publishAt) next.publishAt = next.updatedAt;
  await r.transaction(async () => {
    await r.products.put(next);
    // Keep the release's product list in step with the product's releaseId.
    if (prev?.releaseId !== next.releaseId) {
      if (prev?.releaseId) {
        const old = await r.releases.get(prev.releaseId);
        if (old) await r.releases.put({ ...old, productIds: old.productIds.filter((x) => x !== next.id), updatedAt: nowIso() });
      }
      if (next.releaseId) {
        const rel = await r.releases.get(next.releaseId);
        if (rel && !rel.productIds.includes(next.id)) await r.releases.put({ ...rel, productIds: [...rel.productIds, next.id], updatedAt: nowIso() });
      }
    }
  });
  return next;
}

export async function deleteProduct(id: string, repos?: MembershipRepositories) {
  const r = R(repos);
  const p = await r.products.get(id);
  if (!p) return;
  await r.transaction(async () => {
    if (p.releaseId) {
      const rel = await r.releases.get(p.releaseId);
      if (rel) await r.releases.put({ ...rel, productIds: rel.productIds.filter((x) => x !== id), updatedAt: nowIso() });
    }
    const favs = (await r.favourites.list(p.brandId)).filter((f) => f.productId === id);
    for (const f of favs) await r.favourites.delete(f.id);
    await r.products.delete(id);
  });
  await deleteMemberFiles([p.coverFileId, p.licence.fileId, ...p.galleryFileIds, ...p.files.map((f) => f.fileId)], r);
}

export async function duplicateProduct(id: string, repos?: MembershipRepositories): Promise<Product | null> {
  const r = R(repos);
  const p = await r.products.get(id);
  if (!p) return null;
  // Files are immutable blobs, so the copy can share them only if we copy them too (deleting one product must not break the other).
  const copyFile = async (fid: string | null) => {
    if (!fid) return null;
    const f = await r.files.get(fid);
    if (!f) return null;
    return (await storeMemberFile(f.blob, f.name, f.brandId, r)).id;
  };
  const files: ProductAttachment[] = [];
  for (const a of p.files) {
    const nid = await copyFile(a.fileId);
    if (nid) files.push({ ...a, id: uid("att"), fileId: nid });
  }
  const gallery: string[] = [];
  for (const g of p.galleryFileIds) {
    const nid = await copyFile(g);
    if (nid) gallery.push(nid);
  }
  const copy = newProduct(p.brandId, {
    ...p,
    id: uid("prod"),
    slug: "",
    title: `${p.title} (copy)`,
    status: "draft",
    publishAt: null,
    releaseId: null,
    featured: false,
    isSample: false,
    coverFileId: await copyFile(p.coverFileId),
    galleryFileIds: gallery,
    files,
    licence: { ...p.licence, fileId: await copyFile(p.licence.fileId) },
  });
  return saveProduct(copy, r);
}

export function attachmentKindFor(name: string): ProductFileKind {
  const n = name.toLowerCase();
  if (/licen[cs]e|rights|terms/.test(n)) return "licence";
  if (n.endsWith(".zip")) return "package";
  if (/workbook|worksheet/.test(n)) return "workbook";
  if (/checklist|cheat/.test(n)) return "checklist";
  if (/sales|email|swipe/.test(n)) return "sales";
  if (/\.(png|jpe?g|webp|gif|svg|psd)$/.test(n)) return "graphics";
  if (/\.(mp3|wav|m4a)$/.test(n)) return "audio";
  if (/\.(mp4|mov|webm)$/.test(n)) return "video";
  if (/\.(docx|pdf|txt|md|html?)$/.test(n)) return "ebook";
  return "other";
}

export async function addProductFile(product: Product, blob: Blob, name: string, kind?: ProductFileKind, repos?: MembershipRepositories): Promise<Product> {
  const r = R(repos);
  const f = await storeMemberFile(blob, name, product.brandId, r);
  const att: ProductAttachment = { id: uid("att"), fileId: f.id, name, kind: kind ?? attachmentKindFor(name), size: f.size, mime: f.mime, editable: isEditableFile(name) };
  return saveProduct({ ...product, files: [...product.files, att] }, r);
}

export async function removeProductFile(product: Product, attachmentId: string, repos?: MembershipRepositories): Promise<Product> {
  const r = R(repos);
  const att = product.files.find((f) => f.id === attachmentId);
  const next = await saveProduct({ ...product, files: product.files.filter((f) => f.id !== attachmentId) }, r);
  if (att) await deleteMemberFiles([att.fileId], r);
  return next;
}

export async function setProductImage(product: Product, slot: "cover" | "gallery" | "licence", blob: Blob, name: string, repos?: MembershipRepositories): Promise<Product> {
  const r = R(repos);
  const f = await storeMemberFile(blob, name, product.brandId, r);
  if (slot === "cover") {
    const old = product.coverFileId;
    const next = await saveProduct({ ...product, coverFileId: f.id }, r);
    if (old) await deleteMemberFiles([old], r);
    return next;
  }
  if (slot === "licence") {
    const old = product.licence.fileId;
    const next = await saveProduct({ ...product, licence: { ...product.licence, fileId: f.id } }, r);
    if (old) await deleteMemberFiles([old], r);
    return next;
  }
  return saveProduct({ ...product, galleryFileIds: [...product.galleryFileIds, f.id] }, r);
}

export async function removeGalleryImage(product: Product, fileId: string, repos?: MembershipRepositories): Promise<Product> {
  const r = R(repos);
  const next = await saveProduct({ ...product, galleryFileIds: product.galleryFileIds.filter((x) => x !== fileId) }, r);
  await deleteMemberFiles([fileId], r);
  return next;
}

/* ----------------------------------- Releases ----------------------------------- */
export function newRelease(brandId: BrandId, month: string, patch: Partial<Release> = {}): Release {
  const now = nowIso();
  return { id: uid("rel"), brandId, title: monthTitle(month), month, theme: "", description: "", productIds: [], coverFileId: null, status: "draft", publishAt: monthStart(month), isSample: false, createdAt: now, updatedAt: now, ...patch };
}

/** Local midnight on the 1st of a "YYYY-MM" month, as an ISO timestamp. */
export function monthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, 1).toISOString();
}

export function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
}

export async function saveRelease(rel: Release, repos?: MembershipRepositories): Promise<Release> {
  const r = R(repos);
  const next: Release = { ...rel, title: rel.title.trim() || monthTitle(rel.month), updatedAt: nowIso() };
  if (next.status === "published" && !next.publishAt) next.publishAt = next.updatedAt;
  await r.transaction(async () => {
    await r.releases.put(next);
    // Products listed in the release point back at it; products removed from it are detached.
    const products = await r.products.list(rel.brandId);
    const updates: Product[] = [];
    for (const p of products) {
      const inRelease = next.productIds.includes(p.id);
      if (inRelease && p.releaseId !== next.id) updates.push({ ...p, releaseId: next.id, updatedAt: nowIso() });
      if (!inRelease && p.releaseId === next.id) updates.push({ ...p, releaseId: null, updatedAt: nowIso() });
    }
    // A product can only be in one release: take it out of any other release's list.
    const others = (await r.releases.list(rel.brandId)).filter((x) => x.id !== next.id && x.productIds.some((id) => next.productIds.includes(id)));
    for (const o of others) await r.releases.put({ ...o, productIds: o.productIds.filter((id) => !next.productIds.includes(id)), updatedAt: nowIso() });
    if (updates.length) await r.products.bulkPut(updates);
  });
  return next;
}

/** Publishing a release also publishes its draft products on the same date (scheduled when in the future). */
export async function publishRelease(rel: Release, when: string, repos?: MembershipRepositories): Promise<Release> {
  const r = R(repos);
  const future = new Date(when) > new Date();
  const status = future ? "scheduled" : "published";
  const saved = await saveRelease({ ...rel, status, publishAt: when }, r);
  const products = (await r.products.list(rel.brandId)).filter((p) => saved.productIds.includes(p.id) && (p.status === "draft" || p.status === "scheduled"));
  if (products.length) await r.products.bulkPut(products.map((p) => ({ ...p, status, publishAt: when, updatedAt: nowIso() })));
  return saved;
}

export async function deleteRelease(id: string, repos?: MembershipRepositories) {
  const r = R(repos);
  const rel = await r.releases.get(id);
  if (!rel) return;
  const products = (await r.products.list(rel.brandId)).filter((p) => p.releaseId === id);
  await r.transaction(async () => {
    if (products.length) await r.products.bulkPut(products.map((p) => ({ ...p, releaseId: null, updatedAt: nowIso() })));
    await r.releases.delete(id);
  });
  if (rel.coverFileId) await deleteMemberFiles([rel.coverFileId], r);
}

/* ------------------------------- Courses & resources ------------------------------ */
export function newCourse(brandId: BrandId, patch: Partial<Course> = {}): Course {
  const now = nowIso();
  return {
    id: uid("course"),
    brandId,
    kind: "course",
    title: "Untitled course",
    summary: "",
    level: "beginner",
    toolHint: null,
    coverFileId: null,
    modules: [{ id: uid("mod"), title: "Module 1", lessons: [{ id: uid("les"), title: "Lesson 1", type: "article", body: "", videoUrl: "", durationMin: 5, attachments: [] }] }],
    access: "member",
    status: "draft",
    order: 0,
    isSample: false,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

export async function saveCourse(c: Course, repos?: MembershipRepositories): Promise<Course> {
  const next = { ...c, title: c.title.trim() || "Untitled course", updatedAt: nowIso() };
  await R(repos).courses.put(next);
  return next;
}

export async function deleteCourse(id: string, repos?: MembershipRepositories) {
  const r = R(repos);
  const c = await r.courses.get(id);
  if (!c) return;
  await r.courses.delete(id);
  await deleteMemberFiles([c.coverFileId, ...c.modules.flatMap((m) => m.lessons.flatMap((l) => l.attachments.map((a) => a.fileId)))], r);
}

export function newResource(brandId: BrandId, patch: Partial<Resource> = {}): Resource {
  const now = nowIso();
  return { id: uid("res"), brandId, title: "Untitled resource", description: "", type: "template", fileId: null, fileName: null, fileSize: null, url: "", access: "member", status: "draft", order: 0, isSample: false, createdAt: now, updatedAt: now, ...patch };
}

/** Allows http(s) links and in-app paths ("/profit"); anything else (javascript:, data:…) is dropped. */
export function safeUrl(url: string): string {
  const u = url.trim();
  if (!u) return "";
  if (/^\/(?![\/\\])/.test(u)) return u;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export async function saveResource(res: Resource, repos?: MembershipRepositories): Promise<Resource> {
  const next = { ...res, title: res.title.trim() || "Untitled resource", url: safeUrl(res.url), updatedAt: nowIso() };
  await R(repos).resources.put(next);
  return next;
}

export async function deleteResource(id: string, repos?: MembershipRepositories) {
  const r = R(repos);
  const res = await r.resources.get(id);
  if (!res) return;
  await r.resources.delete(id);
  if (res.fileId) await deleteMemberFiles([res.fileId], r);
}
