import JSZip from "jszip";
import { z } from "zod";
import { nowIso } from "@/lib/utils";
import { getMembershipRepos, type MembershipRepositories } from "./db";
import { BRAND_IDS, type BrandId, type Category, type Course, type DownloadRecord, type Favourite, type LessonProgress, type MemberFile, type Product, type Release, type Resource } from "./types";
import type { BuildDay, CampaignDrop, LabProgress, ProfitPathProfile } from "@/lib/lab/types";

/**
 * Membership backup: one ZIP with `membership.json` (records) and `files/<id>` (binaries).
 * Backups are per brand so a PLR Champion backup can never overwrite PLRforIM data.
 */

export const MEMBERSHIP_BACKUP_FORMAT = "plr-champion-membership-backup";
/** Version 2 adds the PLR Profit Lab tables; version 1 backups still restore. */
export const MEMBERSHIP_BACKUP_VERSION = 2;

const brandSchema = z.enum(BRAND_IDS as [BrandId, ...BrandId[]]);
const row = z.object({ id: z.string().min(1).max(200), brandId: brandSchema }).passthrough();
const fileMeta = z.object({ id: z.string().min(1).max(200), brandId: brandSchema.nullable(), name: z.string().max(500), mime: z.string().max(200), size: z.number().nonnegative(), createdAt: z.string() });

const manifestSchema = z.object({
  format: z.literal(MEMBERSHIP_BACKUP_FORMAT),
  version: z.number().int().min(1).max(MEMBERSHIP_BACKUP_VERSION),
  createdAt: z.string(),
  brandId: brandSchema,
  categories: z.array(row),
  products: z.array(row),
  releases: z.array(row),
  courses: z.array(row),
  resources: z.array(row),
  downloads: z.array(row).default([]),
  progress: z.array(row).default([]),
  favourites: z.array(row).default([]),
  labProfiles: z.array(row).default([]),
  labProgress: z.array(row).default([]),
  campaigns: z.array(row).default([]),
  buildDays: z.array(row).default([]),
  files: z.array(fileMeta),
});

export type MembershipManifest = z.infer<typeof manifestSchema>;

export interface MembershipBackupSummary {
  brandId: BrandId;
  createdAt: string;
  products: number;
  categories: number;
  releases: number;
  courses: number;
  resources: number;
  campaigns: number;
  buildDays: number;
  files: number;
  bytes: number;
}

export async function createMembershipBackup(brandId: BrandId, repos?: MembershipRepositories): Promise<{ blob: Blob; fileName: string; summary: MembershipBackupSummary }> {
  const r = repos ?? getMembershipRepos();
  const [categories, products, releases, courses, resources, downloads, progress, favourites, labProfiles, labProgress, campaigns, buildDays] = await Promise.all([
    r.categories.list(brandId),
    r.products.list(brandId),
    r.releases.list(brandId),
    r.courses.list(brandId),
    r.resources.list(brandId),
    r.downloads.list(brandId),
    r.progress.list(brandId),
    r.favourites.list(brandId),
    r.labProfiles.list(brandId),
    r.labProgress.list(brandId),
    r.campaigns.list(brandId),
    r.buildDays.list(brandId),
  ]);
  const files = (await r.files.listAll()).filter((f) => f.brandId === brandId);
  const zip = new JSZip();
  const manifest: MembershipManifest = {
    format: MEMBERSHIP_BACKUP_FORMAT,
    version: MEMBERSHIP_BACKUP_VERSION,
    createdAt: nowIso(),
    brandId,
    categories,
    products,
    releases,
    courses,
    resources,
    downloads,
    progress,
    favourites,
    labProfiles,
    labProgress,
    campaigns,
    buildDays,
    files: files.map(({ blob: _b, ...meta }) => meta),
  } as unknown as MembershipManifest;
  zip.file("membership.json", JSON.stringify(manifest, null, 1));
  for (const f of files) zip.file(`files/${f.id}`, f.blob);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const fileName = `${brandId}-membership-backup-${manifest.createdAt.slice(0, 10)}.zip`;
  return { blob, fileName, summary: summarise(manifest, blob.size) };
}

function summarise(m: MembershipManifest, bytes: number): MembershipBackupSummary {
  return { brandId: m.brandId, createdAt: m.createdAt, products: m.products.length, categories: m.categories.length, releases: m.releases.length, courses: m.courses.length, resources: m.resources.length, campaigns: m.campaigns.length, buildDays: m.buildDays.length, files: m.files.length, bytes };
}

export interface ParsedMembershipBackup {
  manifest: MembershipManifest;
  zip: JSZip;
  summary: MembershipBackupSummary;
}

export async function parseMembershipBackup(file: Blob): Promise<ParsedMembershipBackup> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("This isn't a membership backup (it is not a ZIP file).");
  }
  const entry = zip.file("membership.json");
  if (!entry) throw new Error("This ZIP has no membership.json — it isn't a membership backup. Studio backups are restored from the Export Centre.");
  let raw: unknown;
  try {
    raw = JSON.parse(await entry.async("string"));
  } catch {
    throw new Error("membership.json is damaged and can't be read.");
  }
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`This backup can't be restored: ${parsed.error.issues[0]?.path.join(".") || "format"} is invalid.`);
  const m = parsed.data;
  const wrongBrand = [...m.categories, ...m.products, ...m.releases, ...m.courses, ...m.resources, ...m.labProfiles, ...m.labProgress, ...m.campaigns, ...m.buildDays].some((x) => x.brandId !== m.brandId);
  if (wrongBrand) throw new Error("This backup mixes records from different brands and can't be restored.");
  return { manifest: m, zip, summary: summarise(m, file.size) };
}

export type MembershipRestoreMode = "merge" | "replace";

/**
 * Restores into the backup's own brand. "merge" adds/overwrites by id; "replace" first removes the
 * brand's current catalogue (other brands are never touched).
 */
export async function restoreMembershipBackup(parsed: ParsedMembershipBackup, mode: MembershipRestoreMode, targetBrand: BrandId, repos?: MembershipRepositories): Promise<MembershipBackupSummary> {
  const r = repos ?? getMembershipRepos();
  const m = parsed.manifest;
  if (m.brandId !== targetBrand) throw new Error(`This is a ${m.brandId} backup. Restore it from that brand's admin.`);
  // Read every file before changing anything so a damaged ZIP can't leave a half-restored library.
  const files: MemberFile[] = [];
  for (const meta of m.files) {
    const entry = parsed.zip.file(`files/${meta.id}`);
    if (!entry) continue;
    const data = await entry.async("blob");
    files.push({ ...meta, blob: new Blob([data], { type: meta.mime }) });
  }
  if (mode === "replace") {
    const ids = {
      categories: (await r.categories.list(targetBrand)).map((x) => x.id),
      products: (await r.products.list(targetBrand)).map((x) => x.id),
      releases: (await r.releases.list(targetBrand)).map((x) => x.id),
      courses: (await r.courses.list(targetBrand)).map((x) => x.id),
      resources: (await r.resources.list(targetBrand)).map((x) => x.id),
      downloads: (await r.downloads.list(targetBrand)).map((x) => x.id),
      progress: (await r.progress.list(targetBrand)).map((x) => x.id),
      favourites: (await r.favourites.list(targetBrand)).map((x) => x.id),
      labProfiles: (await r.labProfiles.list(targetBrand)).map((x) => x.id),
      labProgress: (await r.labProgress.list(targetBrand)).map((x) => x.id),
      campaigns: (await r.campaigns.list(targetBrand)).map((x) => x.id),
      buildDays: (await r.buildDays.list(targetBrand)).map((x) => x.id),
    };
    const fileIds = (await r.files.listMeta()).filter((f) => f.brandId === targetBrand).map((f) => f.id);
    await r.transaction(async () => {
      for (const id of ids.categories) await r.categories.delete(id);
      for (const id of ids.products) await r.products.delete(id);
      for (const id of ids.releases) await r.releases.delete(id);
      for (const id of ids.courses) await r.courses.delete(id);
      for (const id of ids.resources) await r.resources.delete(id);
      for (const id of ids.downloads) await r.downloads.delete(id);
      for (const id of ids.progress) await r.progress.delete(id);
      for (const id of ids.favourites) await r.favourites.delete(id);
      for (const id of ids.labProfiles) await r.labProfiles.delete(id);
      for (const id of ids.labProgress) await r.labProgress.delete(id);
      for (const id of ids.campaigns) await r.campaigns.delete(id);
      for (const id of ids.buildDays) await r.buildDays.delete(id);
      for (const id of fileIds) await r.files.delete(id);
    });
  }
  for (const f of files) await r.files.put(f);
  await r.transaction(async () => {
    await r.categories.bulkPut(m.categories as unknown as Category[]);
    await r.products.bulkPut(m.products as unknown as Product[]);
    await r.releases.bulkPut(m.releases as unknown as Release[]);
    await r.courses.bulkPut(m.courses as unknown as Course[]);
    await r.resources.bulkPut(m.resources as unknown as Resource[]);
    await r.downloads.bulkPut(m.downloads as unknown as DownloadRecord[]);
    await r.progress.bulkPut(m.progress as unknown as LessonProgress[]);
    await r.favourites.bulkPut(m.favourites as unknown as Favourite[]);
    await r.labProfiles.bulkPut(m.labProfiles as unknown as ProfitPathProfile[]);
    await r.labProgress.bulkPut(m.labProgress as unknown as LabProgress[]);
    await r.campaigns.bulkPut(m.campaigns as unknown as CampaignDrop[]);
    await r.buildDays.bulkPut(m.buildDays as unknown as BuildDay[]);
  });
  // A restored library counts as seeded, so samples aren't added on top of it.
  await r.kv.set(`seed:${targetBrand}`, { version: 1, at: nowIso(), restored: true });
  return parsed.summary;
}

/** Rough storage use for the brand (bytes of stored files). */
export async function membershipStorageBytes(brandId: BrandId, repos?: MembershipRepositories): Promise<number> {
  const r = repos ?? getMembershipRepos();
  return (await r.files.listMeta()).filter((f) => f.brandId === brandId).reduce((n, f) => n + f.size, 0);
}
