import { nowIso, uid } from "@/lib/utils";
import { getMembershipRepos, type MembershipRepositories } from "./db";
import type { BrandId, MemberFile } from "./types";

export const MAX_PRODUCT_FILE_BYTES = 200 * 1024 * 1024; // 200 MB per file (browser storage permitting)
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const EDITABLE_EXTENSIONS = ["docx", "pdf", "txt", "md", "markdown", "html", "htm"];

export const extOf = (name: string) => (name.toLowerCase().split(".").pop() ?? "").trim();
export const isEditableFile = (name: string) => EDITABLE_EXTENSIONS.includes(extOf(name));

export async function storeMemberFile(blob: Blob, name: string, brandId: BrandId | null, repos: MembershipRepositories = getMembershipRepos()): Promise<MemberFile> {
  const f: MemberFile = { id: uid("mfile"), brandId, name, mime: blob.type || guessMime(name), size: blob.size, blob, createdAt: nowIso() };
  try {
    await repos.files.put(f);
  } catch (e) {
    if (e instanceof Error && /quota/i.test(e.name + e.message)) throw new Error("Browser storage is full. Remove large files or download a membership backup and clear old items.");
    throw e;
  }
  return f;
}

export function guessMime(name: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    zip: "application/zip",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    txt: "text/plain",
    md: "text/markdown",
    html: "text/html",
    htm: "text/html",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    csv: "text/csv",
  };
  return map[extOf(name)] ?? "application/octet-stream";
}

const urlCache = new Map<string, string>();

export async function memberFileUrl(id: string | null | undefined, repos: MembershipRepositories = getMembershipRepos()): Promise<string | null> {
  if (!id) return null;
  const hit = urlCache.get(id);
  if (hit) return hit;
  const f = await repos.files.get(id);
  if (!f) return null;
  const url = URL.createObjectURL(f.blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteMemberFiles(ids: (string | null | undefined)[], repos: MembershipRepositories = getMembershipRepos()) {
  for (const id of ids) {
    if (!id) continue;
    const cached = urlCache.get(id);
    if (cached) URL.revokeObjectURL(cached);
    urlCache.delete(id);
    await repos.files.delete(id);
  }
}
