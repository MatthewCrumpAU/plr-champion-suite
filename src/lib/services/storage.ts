import { getRepos, type Repositories } from "@/lib/data";

export interface StorageReport {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
  supported: boolean;
  counts: Record<string, number>;
  filesBytes: number;
  versionsBytes: number;
  snapshotsBytes: number;
}

export async function storageReport(repos: Repositories = getRepos()): Promise<StorageReport> {
  let usage: number | null = null;
  let quota: number | null = null;
  let persisted: boolean | null = null;
  const supported = typeof navigator !== "undefined" && !!navigator.storage;
  if (supported) {
    try {
      const est = await navigator.storage.estimate();
      usage = est.usage ?? null;
      quota = est.quota ?? null;
    } catch {
      /* estimate unavailable */
    }
    try {
      persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
    } catch {
      persisted = null;
    }
  }
  const counts = await repos.tableCounts();
  const files = await repos.files.listMeta();
  const versions = await repos.versions.listAll();
  const snapshots = await repos.snapshots.listAll();
  return {
    usage,
    quota,
    persisted,
    supported,
    counts,
    filesBytes: files.reduce((n, f) => n + (f.size ?? 0), 0),
    versionsBytes: versions.reduce((n, v) => n + (v.size ?? 0), 0),
    snapshotsBytes: snapshots.reduce((n, s) => n + (s.size ?? 0), 0),
  };
}

/** Asks the browser to keep this site's data even under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Deletes auto-save versions beyond `keep` for every asset, and orphaned versions. Returns count removed. */
export async function pruneAllAutoVersions(keep = 10, repos: Repositories = getRepos()): Promise<number> {
  const all = await repos.versions.listAll();
  const byAsset = new Map<string, typeof all>();
  for (const v of all) byAsset.set(v.assetId, [...(byAsset.get(v.assetId) ?? []), v]);
  let removed = 0;
  for (const [assetId, list] of byAsset) {
    const exists = await repos.assets.get(assetId);
    const sorted = list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const autos = sorted.filter((v) => v.reason === "auto");
    const toDelete = exists ? autos.slice(keep) : sorted;
    for (const v of toDelete) {
      await repos.versions.delete(v.id);
      removed++;
    }
  }
  return removed;
}

/** Removes stored files no longer referenced by any project, asset, brand kit or version. */
export async function removeOrphanFiles(repos: Repositories = getRepos()): Promise<number> {
  const files = await repos.files.listMeta();
  if (!files.length) return 0;
  const haystack = [
    JSON.stringify(await repos.assets.listAll({ includeDeleted: true })),
    JSON.stringify(await repos.brandKits.list()),
    JSON.stringify(await repos.versions.listAll()),
    JSON.stringify((await repos.snapshots.listAll()).map((s) => s.payload)),
  ].join("\n");
  let removed = 0;
  for (const f of files) {
    if (f.kind === "import") continue; // originals are always kept with their project
    if (!haystack.includes(`"${f.id}"`)) {
      await repos.files.delete(f.id);
      removed++;
    }
  }
  return removed;
}
