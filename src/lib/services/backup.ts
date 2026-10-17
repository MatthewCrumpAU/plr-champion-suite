import { z } from "zod";
import { getRepos, type Repositories } from "@/lib/data";
import { DATA_SCHEMA_VERSION, type Asset, type AssetVersion, type BrandKit, type ExportRecord, type Project, type ProjectSnapshot, type StoredFile } from "@/lib/data/types";
import { ALL_ASSET_TYPES } from "@/lib/data/asset-types";
import { withStorage } from "@/lib/data/errors";
import { nowIso, uid } from "@/lib/utils";
import { normalizeAsset } from "./assets";
import { normalizeProject, remapIds } from "./projects";
import { SAMPLE_FLAG } from "./sample";

/**
 * Backup format (JSON):
 * {
 *   format: "plr-champion-backup", schemaVersion, exportedAt, scope: "workspace" | "project",
 *   options: { includeVersions, includeFiles },
 *   data: { projects, assets, versions, snapshots, brandKits, exports, settings, files: [{ ...meta, base64 }] }
 * }
 */

export const BACKUP_FORMAT = "plr-champion-backup";

export interface BackupOptions {
  includeVersions: boolean;
  includeFiles: boolean;
  includeSettings?: boolean;
}

interface FileRecord extends Omit<StoredFile, "blob"> {
  base64: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  app: string;
  exportedAt: string;
  scope: "workspace" | "project";
  options: BackupOptions;
  data: {
    projects: Project[];
    assets: Asset[];
    versions: AssetVersion[];
    snapshots: ProjectSnapshot[];
    brandKits: BrandKit[];
    exports: ExportRecord[];
    settings: { key: string; value: unknown }[];
    files: FileRecord[];
  };
}

const idObj = z.object({ id: z.string().min(1) }).passthrough();

const BackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().min(1),
  app: z.string().optional(),
  exportedAt: z.string(),
  scope: z.enum(["workspace", "project"]),
  options: z.object({ includeVersions: z.boolean(), includeFiles: z.boolean(), includeSettings: z.boolean().optional() }).passthrough(),
  data: z.object({
    projects: z.array(idObj.extend({ name: z.string() })),
    assets: z.array(idObj.extend({ projectId: z.string(), type: z.string(), data: z.unknown() })),
    versions: z.array(idObj).default([]),
    snapshots: z.array(idObj).default([]),
    brandKits: z.array(idObj).default([]),
    exports: z.array(idObj).default([]),
    settings: z.array(z.object({ key: z.string(), value: z.unknown() })).default([]),
    files: z.array(idObj.extend({ base64: z.string(), mime: z.string().optional(), name: z.string().optional() })).default([]),
  }),
});

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}

async function serializeFiles(files: StoredFile[]): Promise<FileRecord[]> {
  const out: FileRecord[] = [];
  for (const f of files) {
    const { blob, ...meta } = f;
    out.push({ ...meta, base64: await blobToBase64(blob) });
  }
  return out;
}

export async function createWorkspaceBackup(opts: BackupOptions, repos: Repositories = getRepos()): Promise<BackupFile> {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: DATA_SCHEMA_VERSION,
    app: "PLR Champion Software Suite",
    exportedAt: nowIso(),
    scope: "workspace",
    options: opts,
    data: {
      projects: await repos.projects.list({ includeArchived: true, includeDeleted: true }),
      assets: await repos.assets.listAll({ includeDeleted: true }),
      versions: opts.includeVersions ? await repos.versions.listAll() : [],
      snapshots: opts.includeVersions ? await repos.snapshots.listAll() : [],
      brandKits: await repos.brandKits.list(),
      exports: await repos.exports.listAll(),
      settings: opts.includeSettings === false ? [] : await repos.settings.all(),
      files: opts.includeFiles ? await serializeFiles(await repos.files.listAll()) : [],
    },
  };
}

export async function createProjectBackup(projectId: string, opts: BackupOptions, repos: Repositories = getRepos()): Promise<BackupFile> {
  const project = await repos.projects.get(projectId);
  if (!project) throw new Error("Project not found.");
  const kits = project.brandKitId ? [await repos.brandKits.get(project.brandKitId)].filter((k): k is BrandKit => !!k) : [];
  const files = opts.includeFiles ? await repos.files.listByProject(projectId) : [];
  // Brand kit logos live outside the project; include them so the kit restores intact.
  for (const k of kits) if (opts.includeFiles && k.logoFileId) {
    const f = await repos.files.get(k.logoFileId);
    if (f && !files.some((x) => x.id === f.id)) files.push(f);
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: DATA_SCHEMA_VERSION,
    app: "PLR Champion Software Suite",
    exportedAt: nowIso(),
    scope: "project",
    options: { ...opts, includeSettings: false },
    data: {
      projects: [project],
      assets: await repos.assets.listByProject(projectId, { includeDeleted: true }),
      versions: opts.includeVersions ? await repos.versions.listByProject(projectId) : [],
      snapshots: opts.includeVersions ? await repos.snapshots.listByProject(projectId) : [],
      brandKits: kits,
      exports: await repos.exports.listByProject(projectId),
      settings: [],
      files: await serializeFiles(files),
    },
  };
}

export function backupToBlob(b: BackupFile): Blob {
  return new Blob([JSON.stringify(b)], { type: "application/json" });
}

/** Upgrades older backups to the current shape. Add a step here whenever DATA_SCHEMA_VERSION increases. */
export function migrateBackup(raw: BackupFile): BackupFile {
  const b = raw;
  // v1 is the first version — nothing to migrate yet.
  if (b.schemaVersion > DATA_SCHEMA_VERSION) {
    throw new Error(`This backup was made by a newer version of PLR Champion (schema ${b.schemaVersion}). Update the app before restoring it.`);
  }
  return { ...b, schemaVersion: DATA_SCHEMA_VERSION };
}

export interface ParsedBackup {
  backup: BackupFile;
  summary: { projects: number; assets: number; versions: number; files: number; brandKits: number; exportedAt: string; scope: string; projectNames: string[] };
}

export async function parseBackupFile(file: File | Blob): Promise<ParsedBackup> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error("This file is not valid JSON. Choose a backup file exported from PLR Champion.");
  }
  const res = BackupSchema.safeParse(json);
  if (!res.success) {
    const issue = res.error.issues[0];
    throw new Error(`This is not a valid PLR Champion backup (${issue?.path.join(".") || "format"}: ${issue?.message ?? "invalid"}).`);
  }
  const backup = migrateBackup(res.data as unknown as BackupFile);
  const unknownTypes = backup.data.assets.filter((a) => !ALL_ASSET_TYPES.includes(a.type));
  if (unknownTypes.length) throw new Error(`The backup contains ${unknownTypes.length} item(s) of a type this version does not recognise.`);
  return {
    backup,
    summary: {
      projects: backup.data.projects.length,
      assets: backup.data.assets.length,
      versions: backup.data.versions.length,
      files: backup.data.files.length,
      brandKits: backup.data.brandKits.length,
      exportedAt: backup.exportedAt,
      scope: backup.scope,
      projectNames: backup.data.projects.map((p) => p.name),
    },
  };
}

export type RestoreMode = "merge" | "copy" | "replace";

/**
 * merge   – items with the same id are overwritten by the backup; everything else is kept.
 * copy    – everything in the backup is imported as new copies (new ids); nothing existing changes.
 * replace – all local data is erased first, then the backup is restored exactly.
 */
export async function restoreBackup(backup: BackupFile, mode: RestoreMode, repos: Repositories = getRepos()): Promise<{ projects: number; assets: number }> {
  let d = backup.data;

  if (mode === "copy") {
    const map = new Map<string, string>();
    const prefix = (id: string) => id.split("_")[0] || "id";
    for (const list of [d.projects, d.assets, d.versions, d.snapshots, d.brandKits, d.files, d.exports]) for (const x of list as { id: string }[]) map.set(x.id, uid(prefix(x.id)));
    d = remapIds(d, map);
    d.projects = d.projects.map((p) => ({ ...p, name: `${p.name} (restored)`, isSample: false }));
  }

  const files: StoredFile[] = d.files.map((f) => {
    const { base64, ...meta } = f;
    return { ...meta, blob: base64ToBlob(base64, meta.mime) } as StoredFile;
  });

  await withStorage(async () => {
    if (mode === "replace") await repos.clearAll();
    await repos.transaction(async () => {
      // A replaced workspace is never re-seeded with the sample project.
      if (mode === "replace") await repos.meta.set(SAMPLE_FLAG, true);
      for (const f of files) await repos.files.put(f);
      for (const k of d.brandKits) await repos.brandKits.put(k);
      for (const p of d.projects) await repos.projects.put(normalizeProject(p));
      await repos.assets.bulkPut(d.assets.map((a) => normalizeAsset(a)));
      if (d.versions.length) await repos.versions.bulkPut(d.versions);
      for (const s of d.snapshots) await repos.snapshots.put(s);
      if (d.exports.length) await repos.exports.bulkPut(d.exports);
      if (mode !== "copy") for (const s of d.settings) await repos.settings.set(s.key, s.value);
    });
  });
  return { projects: d.projects.length, assets: d.assets.length };
}

export function backupFileName(scope: "workspace" | "project", name?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const safe = (name ?? "workspace").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 50) || "project";
  return scope === "workspace" ? `plr-champion-backup-${date}.json` : `plr-champion-project-${safe}-${date}.json`;
}
