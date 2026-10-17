import type {
  AIUsageRecord,
  Asset,
  AssetType,
  AssetVersion,
  BrandKit,
  ExportRecord,
  Project,
  ProjectSnapshot,
  StoredFile,
} from "./types";

/**
 * Persistence contracts. Every tool talks to these interfaces (via services), never to IndexedDB directly.
 * The current implementation is Dexie/IndexedDB (./dexie.ts). A future cloud database implements the same
 * interfaces — see docs/DATABASE-MIGRATION.md.
 */

export interface ListOptions {
  includeArchived?: boolean;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}

export interface ProjectRepository {
  list(opts?: ListOptions): Promise<Project[]>;
  get(id: string): Promise<Project | undefined>;
  put(project: Project): Promise<Project>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

export interface AssetQuery {
  type?: AssetType | AssetType[];
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}

export interface AssetRepository {
  get<T extends AssetType = AssetType>(id: string): Promise<Asset<T> | undefined>;
  listByProject(projectId: string, query?: AssetQuery): Promise<Asset[]>;
  listAll(query?: AssetQuery): Promise<Asset[]>;
  put<T extends AssetType>(asset: Asset<T>): Promise<Asset<T>>;
  bulkPut(assets: Asset[]): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByProject(projectId: string): Promise<void>;
}

export interface VersionRepository {
  listByAsset(assetId: string): Promise<AssetVersion[]>;
  listByProject(projectId: string): Promise<AssetVersion[]>;
  get(id: string): Promise<AssetVersion | undefined>;
  put(v: AssetVersion): Promise<AssetVersion>;
  bulkPut(v: AssetVersion[]): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByAsset(assetId: string): Promise<void>;
  deleteByProject(projectId: string): Promise<void>;
  listAll(): Promise<AssetVersion[]>;
}

export interface SnapshotRepository {
  listByProject(projectId: string): Promise<ProjectSnapshot[]>;
  get(id: string): Promise<ProjectSnapshot | undefined>;
  put(s: ProjectSnapshot): Promise<ProjectSnapshot>;
  delete(id: string): Promise<void>;
  deleteByProject(projectId: string): Promise<void>;
  listAll(): Promise<ProjectSnapshot[]>;
}

export interface FileRepository {
  get(id: string): Promise<StoredFile | undefined>;
  getMany(ids: string[]): Promise<StoredFile[]>;
  put(file: StoredFile): Promise<StoredFile>;
  delete(id: string): Promise<void>;
  listByProject(projectId: string): Promise<StoredFile[]>;
  listMeta(): Promise<Omit<StoredFile, "blob">[]>;
  findByFingerprint(fingerprint: string): Promise<StoredFile[]>;
  deleteByProject(projectId: string): Promise<void>;
  listAll(): Promise<StoredFile[]>;
}

export interface BrandKitRepository {
  list(): Promise<BrandKit[]>;
  get(id: string): Promise<BrandKit | undefined>;
  put(kit: BrandKit): Promise<BrandKit>;
  delete(id: string): Promise<void>;
}

export interface ExportLogRepository {
  add(rec: ExportRecord): Promise<void>;
  listByProject(projectId: string): Promise<ExportRecord[]>;
  listRecent(limit?: number): Promise<ExportRecord[]>;
  listAll(): Promise<ExportRecord[]>;
  bulkPut(recs: ExportRecord[]): Promise<void>;
  deleteByProject(projectId: string): Promise<void>;
}

export interface AIUsageRepository {
  add(rec: AIUsageRecord): Promise<void>;
  list(limit?: number): Promise<AIUsageRecord[]>;
  clear(): Promise<void>;
}

export interface KeyValueRepository {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  all(): Promise<{ key: string; value: unknown }[]>;
}

export interface Repositories {
  projects: ProjectRepository;
  assets: AssetRepository;
  versions: VersionRepository;
  snapshots: SnapshotRepository;
  files: FileRepository;
  brandKits: BrandKitRepository;
  exports: ExportLogRepository;
  aiUsage: AIUsageRepository;
  settings: KeyValueRepository;
  meta: KeyValueRepository;
  /** Run several operations atomically. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  /** Remove everything (used by "Replace all" restore and "Clear all data"). */
  clearAll(): Promise<void>;
  tableCounts(): Promise<Record<string, number>>;
}
