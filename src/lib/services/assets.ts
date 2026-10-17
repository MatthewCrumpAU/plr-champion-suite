import { getRepos, type Repositories } from "@/lib/data";
import type { Asset, AssetDataMap, AssetStatus, AssetType } from "@/lib/data/types";
import { assetInfo } from "@/lib/data/asset-types";
import { withStorage } from "@/lib/data/errors";
import { deepClone, nowIso, uid } from "@/lib/utils";

export interface CreateAssetOptions<T extends AssetType> {
  title?: string;
  data?: Partial<AssetDataMap[T]>;
  status?: AssetStatus;
  sourceAssetIds?: string[];
  tags?: string[];
}

export function normalizeAsset<T extends AssetType>(a: Asset<T>): Asset<T> {
  const info = assetInfo(a.type);
  return {
    ...a,
    title: a.title ?? info.defaultTitle,
    status: a.status ?? "draft",
    sourceAssetIds: a.sourceAssetIds ?? [],
    tags: a.tags ?? [],
    deletedAt: a.deletedAt ?? null,
    data: info.normalize(a.data) as AssetDataMap[T],
  };
}

export async function touchProject(projectId: string, repos: Repositories = getRepos()) {
  const p = await repos.projects.get(projectId);
  if (p) await repos.projects.put({ ...p, updatedAt: nowIso() });
}

export async function createAsset<T extends AssetType>(projectId: string, type: T, opts: CreateAssetOptions<T> = {}, repos: Repositories = getRepos()): Promise<Asset<T>> {
  const info = assetInfo(type);
  const now = nowIso();
  const asset: Asset<T> = {
    id: uid("ast"),
    projectId,
    type,
    title: opts.title?.trim() || info.defaultTitle,
    status: opts.status ?? "draft",
    data: info.normalize({ ...info.defaults(), ...(opts.data ?? {}) }) as AssetDataMap[T],
    sourceAssetIds: opts.sourceAssetIds ?? [],
    tags: opts.tags ?? [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await withStorage(async () => {
    await repos.assets.put(asset);
    await touchProject(projectId, repos);
  });
  return asset;
}

export async function getAsset<T extends AssetType>(id: string, repos: Repositories = getRepos()): Promise<Asset<T> | undefined> {
  const a = await repos.assets.get<T>(id);
  return a ? normalizeAsset(a) : undefined;
}

export async function updateAsset<T extends AssetType>(
  id: string,
  patch: Partial<Pick<Asset<T>, "title" | "status" | "data" | "tags" | "sourceAssetIds">>,
  repos: Repositories = getRepos(),
): Promise<Asset<T>> {
  const current = await repos.assets.get<T>(id);
  if (!current) throw new Error("This item no longer exists. It may have been deleted in another tab.");
  const next: Asset<T> = { ...current, ...patch, updatedAt: nowIso() };
  await withStorage(async () => {
    await repos.assets.put(next);
    await touchProject(next.projectId, repos);
  });
  return next;
}

export async function mutateAssetData<T extends AssetType>(id: string, fn: (d: AssetDataMap[T]) => AssetDataMap[T], repos: Repositories = getRepos()): Promise<Asset<T>> {
  const current = await getAsset<T>(id, repos);
  if (!current) throw new Error("This item no longer exists.");
  return updateAsset<T>(id, { data: fn(deepClone(current.data)) }, repos);
}

export async function duplicateAsset(id: string, opts: { projectId?: string; title?: string } = {}, repos: Repositories = getRepos()): Promise<Asset> {
  const a = await getAsset(id, repos);
  if (!a) throw new Error("Item not found.");
  const now = nowIso();
  const copy: Asset = {
    ...deepClone(a),
    id: uid("ast"),
    projectId: opts.projectId ?? a.projectId,
    title: opts.title ?? `${a.title} (copy)`,
    sourceAssetIds: [a.id],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await withStorage(() => repos.assets.put(copy));
  await touchProject(copy.projectId, repos);
  return copy;
}

export async function trashAsset(id: string, repos: Repositories = getRepos()) {
  const a = await repos.assets.get(id);
  if (!a) return;
  await repos.assets.put({ ...a, deletedAt: nowIso(), updatedAt: nowIso() });
  const p = await repos.projects.get(a.projectId);
  if (p && (p.mainDocumentId === id || p.coverAssetId === id)) {
    await repos.projects.put({ ...p, mainDocumentId: p.mainDocumentId === id ? null : p.mainDocumentId, coverAssetId: p.coverAssetId === id ? null : p.coverAssetId, updatedAt: nowIso() });
  }
}

export async function restoreAsset(id: string, repos: Repositories = getRepos()) {
  const a = await repos.assets.get(id);
  if (!a) return;
  await repos.assets.put({ ...a, deletedAt: null, updatedAt: nowIso() });
}

export async function purgeAsset(id: string, repos: Repositories = getRepos()) {
  await repos.versions.deleteByAsset(id);
  await repos.assets.delete(id);
}

export async function listProjectAssets<T extends AssetType>(projectId: string, type: T, repos: Repositories = getRepos()): Promise<Asset<T>[]> {
  const list = await repos.assets.listByProject(projectId, { type });
  return list.map((a) => normalizeAsset(a as Asset<T>));
}
