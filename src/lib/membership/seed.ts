import { B } from "@/lib/doc/build";
import type { PMDoc } from "@/lib/doc/types";
import { docWords } from "@/lib/doc/text";
import { nowIso, slugify, uid } from "@/lib/utils";
import { getMembershipRepos, type MembershipRepositories } from "./db";
import { getBrand } from "./brands";
import { bannerSvg, contentsSvg, coverSvg, svgBlob } from "./covers";
import { defaultLicence, monthStart, newCourse, newProduct, newRelease, newResource, saveCategory, saveCourse, saveProduct, saveRelease, saveResource, deleteCategory, deleteCourse, deleteProduct, deleteRelease, deleteResource } from "./catalog";
import { isEditableFile, storeMemberFile } from "./files";
import { licenceText } from "./member-actions";
import type { SampleChapter, SampleFileSpec, SampleProductDef } from "./sample-content";
import { sampleLibraryFor } from "./sample-libraries";
import { PRODUCT_FORMAT_LABELS, type BrandId, type Course, type Lesson, type Product, type ProductAttachment, type ProductFileKind } from "./types";
import { sampleContentEnabled } from "@/lib/sample-mode";

/**
 * Seeds a brand's sample library (categories, products with real DOCX/PDF files, monthly drops,
 * courses and resources) the first time the membership area opens. Runs once per brand; the owner
 * can remove or re-create the samples from Membership Admin → Data.
 */

const SEED_KEY = (b: BrandId) => `seed:${b}`;
const SEED_VERSION = 1;

export interface GeneratedFile {
  name: string;
  blob: Blob;
}

/** Turns a document into a file. Injected so tests can avoid the heavy PDF engine. */
export type DocRenderer = (doc: { title: string; subtitle?: string; author?: string; chapters: { title: string; content: PMDoc }[] }, format: "docx" | "pdf", accent: string) => Promise<Blob>;

export const defaultRenderer: DocRenderer = async (doc, format, accent) => {
  const { exportDocument, DEFAULT_DOC_EXPORT } = await import("@/lib/export/document");
  const out = await exportDocument(doc, format, { ...DEFAULT_DOC_EXPORT, accent });
  return out.blob;
};

export interface SeedOptions {
  repos?: MembershipRepositories;
  now?: Date;
  render?: DocRenderer;
  onProgress?: (label: string, done: number, total: number) => void;
}

export interface SeedSummary {
  categories: number;
  products: number;
  releases: number;
  courses: number;
  resources: number;
  files: number;
}

/* ---------------------------------------- Documents ---------------------------------------- */
export function chapterDoc(c: SampleChapter): PMDoc {
  return B.doc(
    c.paras.map((p) => B.p(p)),
    c.points?.length ? [B.h(2, "Key points"), B.ul(c.points)] : null,
    c.steps?.length ? [B.h(2, "Action steps"), B.ol(c.steps)] : null,
  );
}

function workbookDoc(def: SampleProductDef) {
  return def.chapters.map((c) => ({
    title: c.title,
    content: B.doc(
      B.p(`Use these prompts after reading “${c.title.replace(/^[^:]+:\s*/, "")}”.`),
      (c.points ?? []).slice(0, 3).flatMap((pt) => [B.h(3, `Reflect: ${pt}`), B.p("How does this apply to you right now?"), B.lines(3)]),
      c.steps?.length ? [B.h(2, "Your actions"), B.tasks(c.steps)] : null,
    ),
  }));
}

function checklistDoc(def: SampleProductDef) {
  return def.chapters.map((c) => ({ title: c.title, content: B.doc(B.tasks(c.steps?.length ? c.steps : (c.points ?? []))) }));
}

function salesPageMd(def: SampleProductDef, brandName: string): string {
  return [
    `# ${def.title}`,
    `## ${def.subtitle}`,
    "",
    def.description.replace(/\*\*Perfect for:\*\*.*$/m, "").trim(),
    "",
    "### Inside you'll discover",
    ...def.chapters.map((c) => `- **${c.title.replace(/^[^:]+:\s*/, "")}** — ${c.paras[0]?.split(". ")[0] ?? ""}.`),
    "",
    "### What you get",
    ...def.highlights.map((h) => `- ${h}`),
    "",
    "## Get instant access today",
    "[Add your price, guarantee and checkout button here.]",
    "",
    `_Sales copy supplied by ${brandName}. Rewrite it in your own voice before you publish._`,
  ].join("\n");
}

function emailsTxt(def: SampleProductDef): string {
  const lessons = def.chapters.slice(0, 5);
  return lessons
    .map((c, i) => {
      const subject = i === 0 ? `Welcome — let's start with ${c.title.replace(/^[^:]+:\s*/, "").toLowerCase()}` : c.title.replace(/^[^:]+:\s*/, "");
      return [`EMAIL ${i + 1}`, `Subject: ${subject}`, "", "Hi [First name],", "", c.paras[0] ?? "", "", c.steps?.length ? `Today's action: ${c.steps[0]}` : "", "", "[Your name]", ""].join("\n");
    })
    .join("\n----------------------------------------\n\n");
}

const KIND_FOR: Record<SampleFileSpec, ProductFileKind> = {
  "ebook-docx": "ebook",
  "ebook-pdf": "ebook",
  "workbook-docx": "workbook",
  "checklist-pdf": "checklist",
  "sales-md": "sales",
  "emails-txt": "sales",
};

async function generateFile(spec: SampleFileSpec, def: SampleProductDef, brandName: string, render: DocRenderer): Promise<GeneratedFile> {
  const slug = slugify(def.title);
  const accent = def.palette[0];
  const base = { title: def.title, subtitle: def.subtitle, author: brandName, chapters: def.chapters.map((c) => ({ title: c.title, content: chapterDoc(c) })) };
  switch (spec) {
    case "ebook-docx":
      return { name: `${slug}.docx`, blob: await render(base, "docx", accent) };
    case "ebook-pdf":
      return { name: `${slug}.pdf`, blob: await render(base, "pdf", accent) };
    case "workbook-docx":
      return { name: `${slug}-workbook.docx`, blob: await render({ ...base, title: `${def.title} — Workbook`, chapters: workbookDoc(def) }, "docx", accent) };
    case "checklist-pdf":
      return { name: `${slug}-checklist.pdf`, blob: await render({ ...base, title: `${def.title} — Checklist`, chapters: checklistDoc(def) }, "pdf", accent) };
    case "sales-md":
      return { name: `${slug}-sales-page.md`, blob: new Blob([salesPageMd(def, brandName)], { type: "text/markdown" }) };
    case "emails-txt":
      return { name: `${slug}-email-series.txt`, blob: new Blob([emailsTxt(def)], { type: "text/plain" }) };
  }
}

/* ------------------------------------------ Seeding ----------------------------------------- */
/** Months and release times are in the owner's local time zone (drops open at local midnight on the 1st). */
function monthString(now: Date, offset: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function seedSampleLibrary(brandId: BrandId, opts: SeedOptions = {}): Promise<SeedSummary> {
  const lib = sampleLibraryFor(brandId);
  const summary: SeedSummary = { categories: 0, products: 0, releases: 0, courses: 0, resources: 0, files: 0 };
  if (!lib) return summary;
  const r = opts.repos ?? getMembershipRepos();
  const now = opts.now ?? new Date();
  const render = opts.render ?? defaultRenderer;
  const brand = getBrand(brandId);
  const total = lib.products.length + lib.courses.length + lib.resources.length + lib.drops.length + 1;
  let done = 0;
  const tick = (label: string) => opts.onProgress?.(label, ++done, total);
  const store = async (blob: Blob, name: string) => {
    summary.files++;
    return storeMemberFile(blob, name, brandId, r);
  };

  // Categories
  const catIds: Record<string, string> = {};
  for (const [i, c] of lib.categories.entries()) {
    const saved = await saveCategory(brandId, { name: c.name, description: c.description, icon: c.icon, color: c.color, order: i }, r);
    catIds[c.key] = saved.id;
    summary.categories++;
  }
  tick("Categories");

  // Monthly drops
  const releaseIds: string[] = [];
  const releaseDates: string[] = [];
  for (const d of lib.drops) {
    const month = monthString(now, d.monthOffset);
    const publishAt = monthStart(month);
    const future = new Date(publishAt) > now;
    const cover = await store(svgBlob(coverSvg({ title: d.theme, subtitle: brand.dropName, kicker: newRelease(brandId, month).title, brandName: brand.name, palette: d.palette, motif: d.motif })), `${slugify(d.theme)}-drop.svg`);
    const rel = await saveRelease(newRelease(brandId, month, { theme: d.theme, description: d.description, coverFileId: cover.id, status: future ? "scheduled" : "published", publishAt, isSample: true }), r);
    releaseIds.push(rel.id);
    releaseDates.push(publishAt);
    summary.releases++;
    tick(`Drop: ${d.theme}`);
  }

  // Products
  for (const [i, def] of lib.products.entries()) {
    const files: ProductAttachment[] = [];
    for (const spec of def.files) {
      const g = await generateFile(spec, def, brand.name, render);
      const f = await store(g.blob, g.name);
      files.push({ id: uid("att"), fileId: f.id, name: g.name, kind: KIND_FOR[spec], size: f.size, mime: f.mime, editable: isEditableFile(g.name) });
    }
    const cover = await store(svgBlob(coverSvg({ title: def.title, subtitle: def.subtitle, kicker: def.format === "checklist" ? "Guide + checklist" : PRODUCT_FORMAT_LABELS[def.format], brandName: brand.name, palette: def.palette, motif: def.motif })), `${slugify(def.title)}-cover.svg`);
    const inside = await store(svgBlob(contentsSvg(def.title, def.chapters.map((c) => c.title), def.palette)), `${slugify(def.title)}-contents.svg`);
    const licence = { ...defaultLicence(def.licence), terms: def.licenceTerms };
    Object.assign(licence.rights, def.licenceOverrides ?? {});
    const draft = newProduct(brandId, {
      title: def.title,
      subtitle: def.subtitle,
      description: def.description,
      highlights: def.highlights,
      format: def.format,
      categoryIds: def.categories.map((k) => catIds[k]).filter(Boolean),
      tags: def.tags,
      access: def.access,
      featured: !!def.featured,
      isSample: true,
      coverFileId: cover.id,
      galleryFileIds: [inside.id],
      licence,
    });
    // Licence document travels with the product.
    const licFile = await store(new Blob([licenceText(draft, brand.name)], { type: "text/plain" }), "licence.txt");
    files.push({ id: uid("att"), fileId: licFile.id, name: "licence.txt", kind: "licence", size: licFile.size, mime: licFile.mime, editable: false });
    const words = def.chapters.reduce((n, c) => n + docWords(chapterDoc(c)), 0);
    const releaseId = def.drop === null ? null : (releaseIds[def.drop] ?? null);
    const dropDate = def.drop === null ? null : (releaseDates[def.drop] ?? null);
    const evergreenDate = new Date(now.getTime() - (90 + i) * 86_400_000).toISOString();
    const publishAt = dropDate ?? evergreenDate;
    const status: Product["status"] = def.status === "draft" ? "draft" : new Date(publishAt) > now ? "scheduled" : "published";
    await saveProduct(
      {
        ...draft,
        files,
        licence: { ...licence, fileId: licFile.id },
        wordCount: words,
        pageCount: Math.max(1, Math.round(words / 250)),
        releaseId,
        status,
        publishAt: status === "draft" ? null : publishAt,
      },
      r,
    );
    summary.products++;
    tick(def.title);
  }

  // Courses and tutorials
  for (const [i, c] of lib.courses.entries()) {
    const cover = await store(svgBlob(bannerSvg({ title: c.title, subtitle: c.kind === "tutorial" ? "Tool tutorial" : "Training", kicker: c.kind === "tutorial" ? "Tutorial" : "Course", brandName: brand.name, palette: c.palette, motif: c.motif })), `${slugify(c.title)}-banner.svg`);
    const modules: Course["modules"] = [];
    for (const m of c.modules) {
      const lessons: Lesson[] = [];
      for (const l of m.lessons) {
        const attachments: Lesson["attachments"] = [];
        if (l.attachment) {
          const f = await store(new Blob([l.attachment.content], { type: "text/plain" }), l.attachment.name);
          attachments.push({ fileId: f.id, name: l.attachment.name, size: f.size });
        }
        lessons.push({ id: uid("les"), title: l.title, type: l.type, body: l.body, videoUrl: "", durationMin: l.durationMin, attachments });
      }
      modules.push({ id: uid("mod"), title: m.title, lessons });
    }
    await saveCourse(newCourse(brandId, { kind: c.kind, title: c.title, summary: c.summary, level: c.level, toolHint: c.toolHint, access: c.access, coverFileId: cover.id, modules, status: "published", order: i, isSample: true }), r);
    summary.courses++;
    tick(c.title);
  }

  // Resources
  for (const [i, res] of lib.resources.entries()) {
    let fileId: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    if (res.file) {
      const f = await store(new Blob([res.file.content], { type: res.file.name.endsWith(".md") ? "text/markdown" : "text/plain" }), res.file.name);
      fileId = f.id;
      fileName = res.file.name;
      fileSize = f.size;
    }
    await saveResource(newResource(brandId, { title: res.title, description: res.description, type: res.type, access: res.access, fileId, fileName, fileSize, url: res.url ?? "", status: "published", order: i, isSample: true }), r);
    summary.resources++;
    tick(res.title);
  }

  await r.kv.set(SEED_KEY(brandId), { version: SEED_VERSION, at: nowIso() });
  return summary;
}

/** Deletes every sample item (and its files) for a brand. Owner-created content is untouched. */
export async function removeSampleContent(brandId: BrandId, repos?: MembershipRepositories): Promise<number> {
  const r = repos ?? getMembershipRepos();
  let n = 0;
  for (const p of (await r.products.list(brandId)).filter((x) => x.isSample)) {
    await deleteProduct(p.id, r);
    n++;
  }
  for (const rel of (await r.releases.list(brandId)).filter((x) => x.isSample)) {
    await deleteRelease(rel.id, r);
    n++;
  }
  for (const c of (await r.courses.list(brandId)).filter((x) => x.isSample)) {
    await deleteCourse(c.id, r);
    n++;
  }
  for (const res of (await r.resources.list(brandId)).filter((x) => x.isSample)) {
    await deleteResource(res.id, r);
    n++;
  }
  // Sample categories are removed only when nothing else uses them.
  const lib = sampleLibraryFor(brandId);
  const sampleNames = new Set(lib?.categories.map((c) => c.name) ?? []);
  const products = await r.products.list(brandId);
  for (const c of await r.categories.list(brandId)) {
    if (sampleNames.has(c.name) && !products.some((p) => p.categoryIds.includes(c.id))) {
      await deleteCategory(c.id, r);
      n++;
    }
  }
  return n;
}

export async function resetSampleContent(brandId: BrandId, opts: SeedOptions = {}): Promise<SeedSummary> {
  const r = opts.repos ?? getMembershipRepos();
  await removeSampleContent(brandId, r);
  return seedSampleLibrary(brandId, { ...opts, repos: r });
}

export async function isSeeded(brandId: BrandId, repos?: MembershipRepositories): Promise<boolean> {
  return !!(await (repos ?? getMembershipRepos()).kv.get(SEED_KEY(brandId)));
}

/**
 * Seeds once per brand. If an earlier attempt stopped half-way (e.g. the tab closed), its partial
 * sample items are cleared first so nothing is duplicated.
 */
export async function ensureSampleLibrary(brandId: BrandId, opts: SeedOptions = {}): Promise<SeedSummary | null> {
  const r = opts.repos ?? getMembershipRepos();
  if (await isSeeded(brandId, r)) return null;
  // Turned off for this deployment (NEXT_PUBLIC_PLR_SAMPLE_CONTENT=off): start with an empty library.
  if (!sampleContentEnabled()) return null;
  if (!sampleLibraryFor(brandId)) {
    await r.kv.set(SEED_KEY(brandId), { version: SEED_VERSION, at: nowIso(), empty: true });
    return null;
  }
  const partial = (await r.products.list(brandId)).some((p) => p.isSample) || (await r.releases.list(brandId)).some((x) => x.isSample);
  if (partial) await removeSampleContent(brandId, r);
  return seedSampleLibrary(brandId, { ...opts, repos: r });
}


/**
 * Records that this brand's samples were removed (or the brand was erased) so the sample library is
 * not created again on the next visit. *Recreate sample library* in Admin → Data still works.
 */
export async function markSamplesRemoved(brandId: BrandId, repos?: MembershipRepositories) {
  await (repos ?? getMembershipRepos()).kv.set(SEED_KEY(brandId), { version: SEED_VERSION, at: nowIso(), removed: true });
}
