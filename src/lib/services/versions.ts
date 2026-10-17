import { getRepos, type Repositories } from "@/lib/data";
import type { Asset, AssetVersion, VersionReason } from "@/lib/data/types";
import { withStorage } from "@/lib/data/errors";
import { deepClone, nowIso, uid } from "@/lib/utils";
import { docWords } from "@/lib/doc/text";
import type { DocumentData } from "@/lib/models/document";
import { getAsset, updateAsset } from "./assets";

export const MAX_AUTO_VERSIONS = 25;

function wordCountOf(asset: Asset): number | null {
  if (asset.type !== "document") return null;
  const d = asset.data as DocumentData;
  return d.chapters.reduce((n, c) => n + docWords(c.content), 0);
}

export async function createVersion(asset: Asset, label: string, reason: VersionReason, repos: Repositories = getRepos()): Promise<AssetVersion> {
  const data = deepClone(asset.data);
  const json = JSON.stringify(data);
  const v: AssetVersion = {
    id: uid("ver"),
    assetId: asset.id,
    projectId: asset.projectId,
    assetType: asset.type,
    label: label.trim() || "Snapshot",
    reason,
    title: asset.title,
    data,
    size: json.length,
    wordCount: wordCountOf(asset),
    createdAt: nowIso(),
  };
  await withStorage(() => repos.versions.put(v));
  if (reason === "auto") await pruneAutoVersions(asset.id, MAX_AUTO_VERSIONS, repos);
  return v;
}

export async function snapshotById(assetId: string, label: string, reason: VersionReason, repos: Repositories = getRepos()) {
  const a = await getAsset(assetId, repos);
  if (!a) throw new Error("Item not found.");
  return createVersion(a, label, reason, repos);
}

export async function pruneAutoVersions(assetId: string, keep = MAX_AUTO_VERSIONS, repos: Repositories = getRepos()) {
  const autos = (await repos.versions.listByAsset(assetId)).filter((v) => v.reason === "auto");
  for (const v of autos.slice(keep)) await repos.versions.delete(v.id);
}

/** Restores a version. The current state is saved first, so a restore can always be undone. */
export async function restoreVersion(versionId: string, repos: Repositories = getRepos()): Promise<Asset> {
  const v = await repos.versions.get(versionId);
  if (!v) throw new Error("Version not found.");
  const current = await getAsset(v.assetId, repos);
  if (!current) throw new Error("The item for this version no longer exists.");
  await createVersion(current, `Before restoring “${v.label}”`, "pre-restore", repos);
  return updateAsset(v.assetId, { data: deepClone(v.data) as never, title: v.title }, repos);
}

export async function deleteVersion(versionId: string, repos: Repositories = getRepos()) {
  await repos.versions.delete(versionId);
}

/** Lightweight content signature used to skip identical auto-versions. */
export function dataSignature(data: unknown): string {
  const s = JSON.stringify(data);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}
