import { getRepos, type Repositories } from "@/lib/data";
import type { Asset, Project, ProjectBundle, ProjectSnapshot, StoredFile } from "@/lib/data/types";
import { withStorage } from "@/lib/data/errors";
import { deepClone, nowIso, uid } from "@/lib/utils";
import { normalizeAsset } from "./assets";

export type NewProjectInput = Partial<Omit<Project, "id" | "createdAt" | "updatedAt" | "deletedAt">> & { name: string };

export function newProject(input: NewProjectInput): Project {
  const now = nowIso();
  return {
    id: uid("prj"),
    name: input.name.trim() || "Untitled project",
    description: input.description ?? "",
    niche: input.niche ?? "",
    audience: input.audience ?? "",
    productType: input.productType ?? "ebook",
    stage: input.stage ?? "idea",
    status: input.status ?? "active",
    brandKitId: input.brandKitId ?? null,
    mainDocumentId: input.mainDocumentId ?? null,
    coverAssetId: input.coverAssetId ?? null,
    tags: input.tags ?? [],
    notes: input.notes ?? "",
    plannedPrice: input.plannedPrice ?? null,
    currency: input.currency ?? "USD",
    sourceFingerprints: input.sourceFingerprints ?? [],
    isSample: input.isSample ?? false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function normalizeProject(p: Project): Project {
  return { ...newProject({ name: p.name }), ...p, tags: p.tags ?? [], sourceFingerprints: p.sourceFingerprints ?? [], deletedAt: p.deletedAt ?? null };
}

export async function createProject(input: NewProjectInput, repos: Repositories = getRepos()): Promise<Project> {
  const p = newProject(input);
  await withStorage(() => repos.projects.put(p));
  return p;
}

export async function getProject(id: string | null | undefined, repos: Repositories = getRepos()): Promise<Project | undefined> {
  if (!id) return undefined;
  const p = await repos.projects.get(id);
  return p ? normalizeProject(p) : undefined;
}

export async function updateProject(id: string, patch: Partial<Omit<Project, "id" | "createdAt">>, repos: Repositories = getRepos()): Promise<Project> {
  const p = await repos.projects.get(id);
  if (!p) throw new Error("Project not found.");
  const next = { ...p, ...patch, updatedAt: nowIso() };
  await withStorage(() => repos.projects.put(next));
  return next;
}

export const archiveProject = (id: string, archived: boolean, repos: Repositories = getRepos()) => updateProject(id, { status: archived ? "archived" : "active" }, repos);
export const trashProject = (id: string, repos: Repositories = getRepos()) => updateProject(id, { deletedAt: nowIso() }, repos);
export const restoreProject = (id: string, repos: Repositories = getRepos()) => updateProject(id, { deletedAt: null }, repos);

/** Permanently deletes a project and everything that belongs to it. */
export async function purgeProject(id: string, repos: Repositories = getRepos()) {
  await repos.transaction(async () => {
    await repos.assets.deleteByProject(id);
    await repos.versions.deleteByProject(id);
    await repos.snapshots.deleteByProject(id);
    await repos.files.deleteByProject(id);
    await repos.exports.deleteByProject(id);
    await repos.projects.delete(id);
  });
}

export async function emptyTrash(repos: Repositories = getRepos()): Promise<number> {
  const trashed = await repos.projects.list({ onlyDeleted: true });
  for (const p of trashed) await purgeProject(p.id, repos);
  const assets = await repos.assets.listAll({ onlyDeleted: true });
  for (const a of assets) {
    await repos.versions.deleteByAsset(a.id);
    await repos.assets.delete(a.id);
  }
  return trashed.length + assets.length;
}

/** Replace every occurrence of old ids in a JSON-serialisable value. Ids are random and prefixed, so this is safe. */
export function remapIds<T>(value: T, map: Map<string, string>): T {
  if (!map.size) return deepClone(value);
  let json = JSON.stringify(value);
  for (const [from, to] of map) json = json.split(`"${from}"`).join(`"${to}"`);
  return JSON.parse(json) as T;
}

/** Full copy: project, assets and stored files, with every internal reference re-pointed to the copies. */
export async function duplicateProject(id: string, opts: { name?: string } = {}, repos: Repositories = getRepos()): Promise<Project> {
  const src = await getProject(id, repos);
  if (!src) throw new Error("Project not found.");
  const assets = await repos.assets.listByProject(id);
  const files = await repos.files.listByProject(id);
  const now = nowIso();

  const map = new Map<string, string>();
  const newProjectId = uid("prj");
  map.set(src.id, newProjectId);
  for (const a of assets) map.set(a.id, uid("ast"));
  for (const f of files) map.set(f.id, uid("file"));

  const copyAssets: Asset[] = assets.map((a) => remapIds({ ...a, createdAt: now, updatedAt: now }, map));
  const copyFiles: StoredFile[] = files.map((f) => ({ ...f, id: map.get(f.id)!, projectId: newProjectId, createdAt: now }));
  const project: Project = remapIds(
    { ...src, name: opts.name ?? `${src.name} (copy)`, isSample: false, createdAt: now, updatedAt: now, deletedAt: null, status: "active" as const },
    map,
  );
  project.id = newProjectId;

  await withStorage(async () => {
    for (const f of copyFiles) await repos.files.put(f);
    await repos.assets.bulkPut(copyAssets);
    await repos.projects.put(project);
  });
  return project;
}

/* ------------------------------------------------------------------ */
/* Project snapshots (whole-project restore points)                     */
/* ------------------------------------------------------------------ */
export async function bundleProject(id: string, repos: Repositories = getRepos()): Promise<ProjectBundle> {
  const project = await getProject(id, repos);
  if (!project) throw new Error("Project not found.");
  const assets = (await repos.assets.listByProject(id)).map((a) => normalizeAsset(a));
  return { project, assets };
}

export async function createProjectSnapshot(projectId: string, label: string, repos: Repositories = getRepos()): Promise<ProjectSnapshot> {
  const payload = deepClone(await bundleProject(projectId, repos));
  const snap: ProjectSnapshot = {
    id: uid("snap"),
    projectId,
    label: label.trim() || `Snapshot ${new Date().toLocaleString()}`,
    createdAt: nowIso(),
    size: JSON.stringify(payload).length,
    assetCount: payload.assets.length,
    payload,
  };
  await withStorage(() => repos.snapshots.put(snap));
  return snap;
}

/**
 * Restores a whole-project snapshot. A snapshot of the current state is taken first.
 * Assets that did not exist in the snapshot are moved to the Trash (not destroyed).
 */
export async function restoreProjectSnapshot(snapshotId: string, repos: Repositories = getRepos()): Promise<void> {
  const snap = await repos.snapshots.get(snapshotId);
  if (!snap) throw new Error("Snapshot not found.");
  await createProjectSnapshot(snap.projectId, `Before restoring “${snap.label}”`, repos);
  const current = await repos.assets.listByProject(snap.projectId, { includeDeleted: true });
  const keep = new Set(snap.payload.assets.map((a) => a.id));
  const now = nowIso();
  await withStorage(() =>
    repos.transaction(async () => {
      for (const a of current) if (!keep.has(a.id) && !a.deletedAt) await repos.assets.put({ ...a, deletedAt: now, updatedAt: now });
      await repos.assets.bulkPut(snap.payload.assets.map((a) => ({ ...deepClone(a), deletedAt: null, updatedAt: now })));
      await repos.projects.put({ ...deepClone(snap.payload.project), deletedAt: null, updatedAt: now });
    }),
  );
}

export async function deleteProjectSnapshot(id: string, repos: Repositories = getRepos()) {
  await repos.snapshots.delete(id);
}

/** Projects that share an imported source file or a normalised name. */
export function findDuplicateGroups(projects: Project[], normalize: (s: string) => string): { reason: string; projectIds: string[] }[] {
  const groups: { reason: string; projectIds: string[] }[] = [];
  const byFp = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  for (const p of projects) {
    for (const fp of p.sourceFingerprints ?? []) byFp.set(fp, [...(byFp.get(fp) ?? []), p.id]);
    const n = normalize(p.name.replace(/\(copy\)/gi, "").replace(/^sample\s*[—-]\s*/i, ""));
    if (n) byName.set(n, [...(byName.get(n) ?? []), p.id]);
  }
  for (const ids of byFp.values()) if (new Set(ids).size > 1) groups.push({ reason: "Same imported source file", projectIds: [...new Set(ids)] });
  for (const [, ids] of byName) if (ids.length > 1) groups.push({ reason: "Same project name", projectIds: ids });
  return groups;
}
