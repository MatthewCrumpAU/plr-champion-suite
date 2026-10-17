import { getRepos, type Repositories } from "@/lib/data";
import type { StoredFile, StoredFileKind } from "@/lib/data/types";
import { withStorage } from "@/lib/data/errors";
import { nowIso, sha256Hex, uid } from "@/lib/utils";

export const MAX_IMPORT_BYTES = 60 * 1024 * 1024; // 60 MB per file
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export async function fingerprintBlob(blob: Blob): Promise<string> {
  return sha256Hex(await blob.arrayBuffer());
}

export async function storeFile(blob: Blob, opts: { name: string; projectId: string | null; kind: StoredFileKind; fingerprint?: string }, repos: Repositories = getRepos()): Promise<StoredFile> {
  const fingerprint = opts.fingerprint ?? (await fingerprintBlob(blob));
  const f: StoredFile = {
    id: uid("file"),
    projectId: opts.projectId,
    name: opts.name,
    mime: blob.type || "application/octet-stream",
    size: blob.size,
    blob,
    fingerprint,
    kind: opts.kind,
    createdAt: nowIso(),
  };
  await withStorage(() => repos.files.put(f));
  return f;
}

export async function getFile(id: string | null | undefined, repos: Repositories = getRepos()): Promise<StoredFile | undefined> {
  if (!id) return undefined;
  return repos.files.get(id);
}

export async function deleteFile(id: string, repos: Repositories = getRepos()) {
  const cached = urlCache.get(id);
  if (cached) URL.revokeObjectURL(cached);
  urlCache.delete(id);
  await repos.files.delete(id);
}

const urlCache = new Map<string, string>();

/** Object URL for a stored file (cached for the page lifetime). */
export async function fileObjectUrl(id: string | null | undefined, repos: Repositories = getRepos()): Promise<string | null> {
  if (!id) return null;
  const cached = urlCache.get(id);
  if (cached) return cached;
  const f = await repos.files.get(id);
  if (!f) return null;
  const url = URL.createObjectURL(f.blob);
  urlCache.set(id, url);
  return url;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Could not read file."));
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = src;
  });
}

export async function loadFileImage(id: string | null | undefined): Promise<HTMLImageElement | null> {
  const url = await fileObjectUrl(id);
  if (!url) return null;
  try {
    return await loadImage(url);
  } catch {
    return null;
  }
}

/** Validates an image upload and stores it. */
export async function storeImageUpload(file: File, projectId: string | null, kind: StoredFileKind = "image"): Promise<StoredFile> {
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.type)) throw new Error("Please choose a PNG, JPG, WebP, GIF or SVG image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("That image is larger than 15 MB. Please resize it first.");
  return storeFile(file, { name: file.name, projectId, kind });
}
