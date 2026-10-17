import JSZip from "jszip";
import { nowIso, slugify, uid } from "@/lib/utils";
import { downloadBlob } from "@/lib/export/download";
import { getMembershipRepos, type MembershipRepositories } from "./db";
import { LICENCE_RIGHTS, LICENCE_TYPE_LABELS, RIGHT_VALUE_LABELS, type BrandId, type DownloadRecord, type LessonProgress, type Product, type ProductAttachment } from "./types";

/** Things a member does: download, bundle, favourite, track lesson progress. */

const R = (repos?: MembershipRepositories) => repos ?? getMembershipRepos();

async function logDownload(rec: Omit<DownloadRecord, "id" | "createdAt">, repos: MembershipRepositories) {
  await repos.downloads.put({ ...rec, id: uid("dl"), createdAt: nowIso() });
}

/** Plain-text licence summary that travels with every download. */
export function licenceText(p: Product, brandName: string): string {
  const lines = [
    `${p.title} — licence summary`,
    `Supplied by ${brandName}`,
    "",
    `Licence type: ${LICENCE_TYPE_LABELS[p.licence.type]}`,
    "",
    ...LICENCE_RIGHTS.map(([k, label]) => `- ${label}: ${RIGHT_VALUE_LABELS[p.licence.rights[k]]}`),
  ];
  if (p.licence.terms.trim()) lines.push("", "Conditions:", p.licence.terms.trim());
  lines.push("", "This summary is for convenience. The full licence supplied with the product is what applies; where it says nothing, assume the right is not granted.");
  return lines.join("\n");
}

export async function downloadAttachment(p: Product, att: ProductAttachment, memberId: string, repos?: MembershipRepositories): Promise<void> {
  const r = R(repos);
  const f = await r.files.get(att.fileId);
  if (!f) throw new Error(`“${att.name}” is missing from storage. Re-upload it in Membership Admin.`);
  downloadBlob(f.blob, att.name);
  await logDownload({ brandId: p.brandId, memberId, productId: p.id, productTitle: p.title, attachmentId: att.id, fileName: att.name, size: att.size, kind: "file" }, r);
}

export interface BundleProgress {
  done: number;
  total: number;
  current: string;
}

/**
 * Builds one ZIP containing the chosen products (each in its own folder, with a licence summary)
 * and downloads it. Used by the Download Manager for bulk downloads.
 */
export async function downloadBundle(products: Product[], memberId: string, brandName: string, onProgress?: (p: BundleProgress) => void, repos?: MembershipRepositories): Promise<{ fileName: string; size: number }> {
  const r = R(repos);
  if (!products.length) throw new Error("Choose at least one product.");
  const zip = new JSZip();
  const total = products.reduce((n, p) => n + p.files.length, 0);
  let done = 0;
  const missing: string[] = [];
  for (const p of products) {
    const folder = zip.folder(slugify(p.title) || p.id)!;
    folder.file("LICENCE-SUMMARY.txt", licenceText(p, brandName));
    for (const att of p.files) {
      onProgress?.({ done, total, current: att.name });
      const f = await r.files.get(att.fileId);
      if (f) folder.file(att.name, f.blob);
      else missing.push(`${p.title}: ${att.name}`);
      done++;
    }
  }
  if (missing.length) zip.file("MISSING-FILES.txt", `These files could not be found in storage and were left out:\n\n${missing.join("\n")}\n`);
  onProgress?.({ done: total, total, current: "Compressing…" });
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const fileName = products.length === 1 ? `${slugify(products[0].title)}.zip` : `${slugify(brandName)}-bundle-${new Date().toISOString().slice(0, 10)}.zip`;
  downloadBlob(blob, fileName);
  const brandId = products[0].brandId;
  await logDownload({ brandId, memberId, productId: products.length === 1 ? products[0].id : null, productTitle: products.length === 1 ? products[0].title : `${products.length} products`, attachmentId: "bundle", fileName, size: blob.size, kind: "bundle" }, r);
  return { fileName, size: blob.size };
}

export async function downloadStoredFile(brandId: BrandId, fileId: string, name: string, memberId: string, kind: DownloadRecord["kind"], label: string, repos?: MembershipRepositories) {
  const r = R(repos);
  const f = await r.files.get(fileId);
  if (!f) throw new Error(`“${name}” is missing from storage.`);
  downloadBlob(f.blob, name);
  await logDownload({ brandId, memberId, productId: null, productTitle: label, attachmentId: fileId, fileName: name, size: f.size, kind }, r);
}

export async function toggleFavourite(brandId: BrandId, memberId: string, productId: string, repos?: MembershipRepositories): Promise<boolean> {
  const r = R(repos);
  const id = `${memberId}:${productId}`;
  const existing = await r.favourites.get(id);
  if (existing) {
    await r.favourites.delete(id);
    return false;
  }
  await r.favourites.put({ id, brandId, memberId, productId, createdAt: nowIso() });
  return true;
}

export async function clearDownloadHistory(brandId: BrandId, memberId: string, repos?: MembershipRepositories) {
  const r = R(repos);
  for (const d of await r.downloads.listForMember(brandId, memberId)) await r.downloads.delete(d.id);
}

/* ------------------------------- Lesson progress -------------------------------- */
export const progressId = (memberId: string, courseId: string, lessonId: string) => `${memberId}:${courseId}:${lessonId}`;

export async function setLessonComplete(brandId: BrandId, memberId: string, courseId: string, lessonId: string, complete: boolean, repos?: MembershipRepositories): Promise<LessonProgress> {
  const r = R(repos);
  const id = progressId(memberId, courseId, lessonId);
  const prev = await r.progress.get(id);
  const next: LessonProgress = { id, brandId, memberId, courseId, lessonId, checked: prev?.checked ?? [], completedAt: complete ? (prev?.completedAt ?? nowIso()) : null, updatedAt: nowIso() };
  await r.progress.put(next);
  return next;
}

export async function toggleChecklistItem(brandId: BrandId, memberId: string, courseId: string, lessonId: string, index: number, repos?: MembershipRepositories): Promise<LessonProgress> {
  const r = R(repos);
  const id = progressId(memberId, courseId, lessonId);
  const prev = await r.progress.get(id);
  const checked = new Set(prev?.checked ?? []);
  if (checked.has(index)) checked.delete(index);
  else checked.add(index);
  const next: LessonProgress = { id, brandId, memberId, courseId, lessonId, checked: [...checked].sort((a, b) => a - b), completedAt: prev?.completedAt ?? null, updatedAt: nowIso() };
  await r.progress.put(next);
  return next;
}

/** Ticks parsed from a checklist lesson body ("- item" lines). */
export function checklistItems(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*[-*]\s+(?:\[[ xX]\]\s*)?(.+)$/)?.[1]?.trim())
    .filter((x): x is string => !!x);
}
