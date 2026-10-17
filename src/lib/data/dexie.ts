import Dexie, { type Table } from "dexie";
import type { AIUsageRecord, Asset, AssetType, AssetVersion, BrandKit, ExportRecord, KeyValue, Project, ProjectSnapshot, StoredFile } from "./types";
import type { AssetQuery, ListOptions, Repositories } from "./repositories";

export const DB_NAME = "plr-champion-suite";

export class PLRDatabase extends Dexie {
  projects!: Table<Project, string>;
  assets!: Table<Asset, string>;
  versions!: Table<AssetVersion, string>;
  snapshots!: Table<ProjectSnapshot, string>;
  files!: Table<StoredFile, string>;
  brandKits!: Table<BrandKit, string>;
  exports!: Table<ExportRecord, string>;
  aiUsage!: Table<AIUsageRecord, string>;
  settings!: Table<KeyValue, string>;
  meta!: Table<KeyValue, string>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      projects: "id, status, updatedAt, name",
      assets: "id, projectId, type, [projectId+type], updatedAt",
      versions: "id, assetId, projectId, createdAt",
      snapshots: "id, projectId, createdAt",
      files: "id, projectId, fingerprint, kind, createdAt",
      brandKits: "id, name, updatedAt",
      exports: "id, projectId, assetId, createdAt",
      aiUsage: "id, createdAt, projectId",
      settings: "key",
      meta: "key",
    });
  }
}

function filterProjects(list: Project[], opts: ListOptions = {}): Project[] {
  return list.filter((p) => {
    if (opts.onlyDeleted) return !!p.deletedAt;
    if (!opts.includeDeleted && p.deletedAt) return false;
    if (!opts.includeArchived && p.status === "archived") return false;
    return true;
  });
}

function filterAssets(list: Asset[], q: AssetQuery = {}): Asset[] {
  const types = q.type ? (Array.isArray(q.type) ? q.type : [q.type]) : null;
  return list.filter((a) => {
    if (types && !types.includes(a.type)) return false;
    if (q.onlyDeleted) return !!a.deletedAt;
    if (!q.includeDeleted && a.deletedAt) return false;
    return true;
  });
}

const byUpdatedDesc = <T extends { updatedAt: string }>(a: T, b: T) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);
const byCreatedDesc = <T extends { createdAt: string }>(a: T, b: T) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

export function createDexieRepositories(db: PLRDatabase): Repositories {
  return {
    projects: {
      async list(opts) {
        return filterProjects(await db.projects.toArray(), opts).sort(byUpdatedDesc);
      },
      get: (id) => db.projects.get(id),
      async put(p) {
        await db.projects.put(p);
        return p;
      },
      delete: (id) => db.projects.delete(id),
      count: () => db.projects.count(),
    },
    assets: {
      get: async <T extends AssetType>(id: string) => (await db.assets.get(id)) as Asset<T> | undefined,
      async listByProject(projectId, q) {
        return filterAssets(await db.assets.where("projectId").equals(projectId).toArray(), q).sort(byUpdatedDesc);
      },
      async listAll(q) {
        return filterAssets(await db.assets.toArray(), q).sort(byUpdatedDesc);
      },
      async put(a) {
        await db.assets.put(a as Asset);
        return a;
      },
      async bulkPut(list) {
        await db.assets.bulkPut(list);
      },
      delete: (id) => db.assets.delete(id),
      async deleteByProject(projectId) {
        await db.assets.where("projectId").equals(projectId).delete();
      },
    },
    versions: {
      async listByAsset(assetId) {
        return (await db.versions.where("assetId").equals(assetId).toArray()).sort(byCreatedDesc);
      },
      async listByProject(projectId) {
        return (await db.versions.where("projectId").equals(projectId).toArray()).sort(byCreatedDesc);
      },
      get: (id) => db.versions.get(id),
      async put(v) {
        await db.versions.put(v);
        return v;
      },
      async bulkPut(v) {
        await db.versions.bulkPut(v);
      },
      delete: (id) => db.versions.delete(id),
      async deleteByAsset(assetId) {
        await db.versions.where("assetId").equals(assetId).delete();
      },
      async deleteByProject(projectId) {
        await db.versions.where("projectId").equals(projectId).delete();
      },
      listAll: () => db.versions.toArray(),
    },
    snapshots: {
      async listByProject(projectId) {
        return (await db.snapshots.where("projectId").equals(projectId).toArray()).sort(byCreatedDesc);
      },
      get: (id) => db.snapshots.get(id),
      async put(s) {
        await db.snapshots.put(s);
        return s;
      },
      delete: (id) => db.snapshots.delete(id),
      async deleteByProject(projectId) {
        await db.snapshots.where("projectId").equals(projectId).delete();
      },
      listAll: () => db.snapshots.toArray(),
    },
    files: {
      get: (id) => db.files.get(id),
      async getMany(ids) {
        const res = await db.files.bulkGet(ids);
        return res.filter((f): f is StoredFile => !!f);
      },
      async put(f) {
        await db.files.put(f);
        return f;
      },
      delete: (id) => db.files.delete(id),
      listByProject: (projectId) => db.files.where("projectId").equals(projectId).toArray(),
      async listMeta() {
        const out: Omit<StoredFile, "blob">[] = [];
        await db.files.each((f) => {
          const { blob: _blob, ...meta } = f;
          out.push(meta);
        });
        return out;
      },
      findByFingerprint: (fp) => db.files.where("fingerprint").equals(fp).toArray(),
      async deleteByProject(projectId) {
        await db.files.where("projectId").equals(projectId).delete();
      },
      listAll: () => db.files.toArray(),
    },
    brandKits: {
      async list() {
        return (await db.brandKits.toArray()).sort((a, b) => a.name.localeCompare(b.name));
      },
      get: (id) => db.brandKits.get(id),
      async put(k) {
        await db.brandKits.put(k);
        return k;
      },
      delete: (id) => db.brandKits.delete(id),
    },
    exports: {
      async add(r) {
        await db.exports.put(r);
      },
      async listByProject(projectId) {
        return (await db.exports.where("projectId").equals(projectId).toArray()).sort(byCreatedDesc);
      },
      async listRecent(limit = 50) {
        return db.exports.orderBy("createdAt").reverse().limit(limit).toArray();
      },
      listAll: () => db.exports.toArray(),
      async bulkPut(r) {
        await db.exports.bulkPut(r);
      },
      async deleteByProject(projectId) {
        await db.exports.where("projectId").equals(projectId).delete();
      },
    },
    aiUsage: {
      async add(r) {
        await db.aiUsage.put(r);
      },
      async list(limit = 500) {
        return db.aiUsage.orderBy("createdAt").reverse().limit(limit).toArray();
      },
      async clear() {
        await db.aiUsage.clear();
      },
    },
    settings: kv(db.settings),
    meta: kv(db.meta),
    transaction<T>(fn: () => Promise<T>) {
      return db.transaction("rw", [db.projects, db.assets, db.versions, db.snapshots, db.files, db.brandKits, db.exports, db.settings, db.meta], fn);
    },
    async clearAll() {
      await db.transaction("rw", db.tables, async () => {
        for (const t of db.tables) await t.clear();
      });
    },
    async tableCounts() {
      const out: Record<string, number> = {};
      for (const t of db.tables) out[t.name] = await t.count();
      return out;
    },
  };
}

function kv(table: Table<KeyValue, string>) {
  return {
    async get<T>(key: string) {
      return (await table.get(key))?.value as T | undefined;
    },
    async set<T>(key: string, value: T) {
      await table.put({ key, value });
    },
    async delete(key: string) {
      await table.delete(key);
    },
    async all() {
      return table.toArray();
    },
  };
}
