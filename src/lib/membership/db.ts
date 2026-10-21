import Dexie, { type Table } from "dexie";
import type { BrandId, Category, Course, DownloadRecord, Favourite, KV, LessonProgress, MemberAccount, MemberFile, Product, Release, Resource } from "./types";
import type { BuildDay, CampaignDrop, LabProgress, ProfitPathProfile } from "@/lib/lab/types";

/**
 * Membership data lives in its own IndexedDB database, separate from the studio's projects.
 * That keeps catalogue files away from the studio's orphan-file clean-up and "replace all" restore,
 * and mirrors how the data will split into its own tables when it moves to Supabase.
 */
export const MEMBERSHIP_DB_NAME = "plr-champion-membership";

export class MembershipDatabase extends Dexie {
  categories!: Table<Category, string>;
  products!: Table<Product, string>;
  releases!: Table<Release, string>;
  courses!: Table<Course, string>;
  resources!: Table<Resource, string>;
  downloads!: Table<DownloadRecord, string>;
  progress!: Table<LessonProgress, string>;
  favourites!: Table<Favourite, string>;
  accounts!: Table<MemberAccount, string>;
  files!: Table<MemberFile, string>;
  kv!: Table<KV, string>;
  /** PLR Profit Lab (schema version 2). */
  labProfiles!: Table<ProfitPathProfile, string>;
  labProgress!: Table<LabProgress, string>;
  campaigns!: Table<CampaignDrop, string>;
  buildDays!: Table<BuildDay, string>;

  constructor(name = MEMBERSHIP_DB_NAME) {
    super(name);
    this.version(1).stores({
      categories: "id, brandId, slug, order",
      products: "id, brandId, slug, status, releaseId, updatedAt",
      releases: "id, brandId, month, status",
      courses: "id, brandId, status, order",
      resources: "id, brandId, status, order",
      downloads: "id, brandId, memberId, productId, createdAt",
      progress: "id, brandId, memberId, courseId",
      favourites: "id, brandId, memberId, productId",
      accounts: "id, email",
      files: "id, brandId",
      kv: "key",
    });
    // Version 2 adds the PLR Profit Lab tables. Existing tables and data are kept as they are.
    this.version(2).stores({
      labProfiles: "id, brandId, memberId",
      labProgress: "id, brandId, memberId, kind, refId",
      campaigns: "id, brandId, month, status",
      buildDays: "id, brandId, month, status, startsAt",
    });
  }
}

/** A table whose rows belong to one brand. */
export interface BrandScopedRepo<T extends { id: string; brandId: BrandId }> {
  list(brandId: BrandId): Promise<T[]>;
  listAll(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(row: T): Promise<T>;
  bulkPut(rows: T[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface MembershipRepositories {
  categories: BrandScopedRepo<Category>;
  products: BrandScopedRepo<Product>;
  releases: BrandScopedRepo<Release>;
  courses: BrandScopedRepo<Course>;
  resources: BrandScopedRepo<Resource>;
  downloads: BrandScopedRepo<DownloadRecord> & { listForMember(brandId: BrandId, memberId: string): Promise<DownloadRecord[]> };
  progress: BrandScopedRepo<LessonProgress> & { listForMember(brandId: BrandId, memberId: string): Promise<LessonProgress[]> };
  favourites: BrandScopedRepo<Favourite> & { listForMember(brandId: BrandId, memberId: string): Promise<Favourite[]> };
  labProfiles: BrandScopedRepo<ProfitPathProfile> & { listForMember(brandId: BrandId, memberId: string): Promise<ProfitPathProfile[]> };
  labProgress: BrandScopedRepo<LabProgress> & { listForMember(brandId: BrandId, memberId: string): Promise<LabProgress[]> };
  campaigns: BrandScopedRepo<CampaignDrop>;
  buildDays: BrandScopedRepo<BuildDay>;
  accounts: {
    list(): Promise<MemberAccount[]>;
    get(id: string): Promise<MemberAccount | undefined>;
    put(a: MemberAccount): Promise<MemberAccount>;
    delete(id: string): Promise<void>;
  };
  files: {
    get(id: string): Promise<MemberFile | undefined>;
    getMany(ids: string[]): Promise<MemberFile[]>;
    put(f: MemberFile): Promise<MemberFile>;
    delete(id: string): Promise<void>;
    listMeta(): Promise<Omit<MemberFile, "blob">[]>;
    listAll(): Promise<MemberFile[]>;
  };
  kv: {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
    all(): Promise<KV[]>;
  };
  /** Atomic multi-table write. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  clearAll(): Promise<void>;
}

function scoped<T extends { id: string; brandId: BrandId }>(table: Table<T, string>): BrandScopedRepo<T> {
  return {
    list: (brandId) => table.where("brandId").equals(brandId).toArray(),
    listAll: () => table.toArray(),
    get: (id) => table.get(id),
    async put(row) {
      await table.put(row);
      return row;
    },
    async bulkPut(rows) {
      await table.bulkPut(rows);
    },
    delete: (id) => table.delete(id),
  };
}

function memberScoped<T extends { id: string; brandId: BrandId; memberId: string }>(table: Table<T, string>) {
  return {
    ...scoped(table),
    async listForMember(brandId: BrandId, memberId: string) {
      return (await table.where("memberId").equals(memberId).toArray()).filter((r) => r.brandId === brandId);
    },
  };
}

export function createMembershipRepositories(db: MembershipDatabase): MembershipRepositories {
  return {
    categories: scoped(db.categories),
    products: scoped(db.products),
    releases: scoped(db.releases),
    courses: scoped(db.courses),
    resources: scoped(db.resources),
    downloads: memberScoped(db.downloads),
    progress: memberScoped(db.progress),
    favourites: memberScoped(db.favourites),
    labProfiles: memberScoped(db.labProfiles),
    labProgress: memberScoped(db.labProgress),
    campaigns: scoped(db.campaigns),
    buildDays: scoped(db.buildDays),
    accounts: {
      list: () => db.accounts.toArray(),
      get: (id) => db.accounts.get(id),
      async put(a) {
        await db.accounts.put(a);
        return a;
      },
      delete: (id) => db.accounts.delete(id),
    },
    files: {
      get: (id) => db.files.get(id),
      async getMany(ids) {
        return (await db.files.bulkGet(ids)).filter((f): f is MemberFile => !!f);
      },
      async put(f) {
        await db.files.put(f);
        return f;
      },
      delete: (id) => db.files.delete(id),
      async listMeta() {
        const out: Omit<MemberFile, "blob">[] = [];
        await db.files.each((f) => {
          const { blob: _b, ...meta } = f;
          out.push(meta);
        });
        return out;
      },
      listAll: () => db.files.toArray(),
    },
    kv: {
      async get<T>(key: string) {
        return (await db.kv.get(key))?.value as T | undefined;
      },
      async set<T>(key: string, value: T) {
        await db.kv.put({ key, value });
      },
      delete: (key) => db.kv.delete(key),
      all: () => db.kv.toArray(),
    },
    transaction<T>(fn: () => Promise<T>) {
      return db.transaction("rw", db.tables, fn);
    },
    async clearAll() {
      await db.transaction("rw", db.tables, async () => {
        for (const t of db.tables) await t.clear();
      });
    },
  };
}

let db: MembershipDatabase | null = null;
let repos: MembershipRepositories | null = null;

/** Browser-only singleton. */
export function getMembershipRepos(): MembershipRepositories {
  if (repos) return repos;
  if (typeof indexedDB === "undefined") throw new Error("Local storage (IndexedDB) is not available in this environment.");
  db = new MembershipDatabase();
  repos = createMembershipRepositories(db);
  return repos;
}

/** For tests. */
export function setMembershipRepos(r: MembershipRepositories | null, database: MembershipDatabase | null = null) {
  repos = r;
  db = database;
}

export function getMembershipDb(): MembershipDatabase {
  getMembershipRepos();
  return db!;
}
