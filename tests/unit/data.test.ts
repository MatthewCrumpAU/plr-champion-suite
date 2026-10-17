// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { createDexieRepositories, PLRDatabase } from "@/lib/data/dexie";
import { setRepos, type Repositories } from "@/lib/data";
import { createProject, duplicateProject, trashProject, restoreProject, purgeProject, createProjectSnapshot, restoreProjectSnapshot, findDuplicateGroups } from "@/lib/services/projects";
import { createAsset, getAsset, updateAsset, trashAsset } from "@/lib/services/assets";
import { createVersion, restoreVersion } from "@/lib/services/versions";
import { storeFile } from "@/lib/services/files";
import { createWorkspaceBackup, createProjectBackup, parseBackupFile, restoreBackup, backupToBlob } from "@/lib/services/backup";
import { ensureSampleProject } from "@/lib/services/sample";
import { B } from "@/lib/doc/build";
import { normalizeTitle } from "@/lib/utils";
import type { DocumentData } from "@/lib/models/document";

let repos: Repositories;
let n = 0;

beforeEach(async () => {
  const db = new PLRDatabase(`test-${Date.now()}-${n++}`);
  await db.open();
  repos = createDexieRepositories(db);
  setRepos(repos, db);
});

describe("projects and assets", () => {
  it("creates, updates and lists assets for a project", async () => {
    const p = await createProject({ name: "My ebook" });
    const doc = await createAsset(p.id, "document", { title: "Main", data: { chapters: [{ id: "c1", title: "One", content: B.doc(B.p("Hello world")), notes: "", approved: false, sourceChapterId: null }] } as Partial<DocumentData> });
    expect(doc.data.chapters).toHaveLength(1);
    const updated = await updateAsset<"document">(doc.id, { title: "Renamed" });
    expect(updated.title).toBe("Renamed");
    const list = await repos.assets.listByProject(p.id);
    expect(list.map((a) => a.id)).toEqual([doc.id]);
  });

  it("soft deletes and restores projects, then purges with cascade", async () => {
    const p = await createProject({ name: "Trash me" });
    const a = await createAsset(p.id, "outline");
    await trashProject(p.id);
    expect(await repos.projects.list()).toHaveLength(0);
    expect(await repos.projects.list({ onlyDeleted: true })).toHaveLength(1);
    await restoreProject(p.id);
    expect(await repos.projects.list()).toHaveLength(1);
    await createVersion((await getAsset(a.id))!, "v1", "manual");
    await purgeProject(p.id);
    expect(await repos.projects.get(p.id)).toBeUndefined();
    expect(await repos.assets.get(a.id)).toBeUndefined();
    expect(await repos.versions.listByAsset(a.id)).toHaveLength(0);
  });

  it("duplicates a project with remapped internal references and copied files", async () => {
    const p = await createProject({ name: "Source" });
    const file = await storeFile(new Blob(["png-bytes"], { type: "image/png" }), { name: "a.png", projectId: p.id, kind: "image" });
    const cover = await createAsset(p.id, "cover", { data: { backgroundImageFileId: file.id } });
    const mockup = await createAsset(p.id, "mockup", { data: { sources: [{ id: "s1", kind: "cover", refId: cover.id }] } });
    const copy = await duplicateProject(p.id);
    const copied = await repos.assets.listByProject(copy.id);
    expect(copied).toHaveLength(2);
    const cCover = copied.find((a) => a.type === "cover")!;
    const cMock = copied.find((a) => a.type === "mockup")!;
    expect(cCover.id).not.toBe(cover.id);
    expect((cMock.data as { sources: { refId: string }[] }).sources[0].refId).toBe(cCover.id);
    const fileId = (cCover.data as { backgroundImageFileId: string }).backgroundImageFileId;
    expect(fileId).not.toBe(file.id);
    expect((await repos.files.get(fileId))?.projectId).toBe(copy.id);
    expect(mockup.id).toBeTruthy();
  });

  it("detects duplicate projects by fingerprint and name", () => {
    const base = { description: "", niche: "", audience: "", productType: "ebook", stage: "idea" as const, status: "active" as const, brandKitId: null, mainDocumentId: null, coverAssetId: null, tags: [], notes: "", plannedPrice: null, currency: "USD", isSample: false, createdAt: "", updatedAt: "", deletedAt: null };
    const groups = findDuplicateGroups(
      [
        { ...base, id: "a", name: "Focus Book", sourceFingerprints: ["x"] },
        { ...base, id: "b", name: "The Focus Book (copy)", sourceFingerprints: ["y"] },
        { ...base, id: "c", name: "Other", sourceFingerprints: ["x"] },
      ],
      normalizeTitle,
    );
    expect(groups.some((g) => g.reason.includes("source") && g.projectIds.includes("a") && g.projectIds.includes("c"))).toBe(true);
    expect(groups.some((g) => g.reason.includes("name") && g.projectIds.includes("a") && g.projectIds.includes("b"))).toBe(true);
  });
});

describe("versions and snapshots", () => {
  it("restores an asset version and keeps a pre-restore copy", async () => {
    const p = await createProject({ name: "V" });
    const doc = await createAsset(p.id, "document", { title: "Draft A" });
    const v1 = await createVersion(doc, "First", "manual");
    await updateAsset<"document">(doc.id, { title: "Draft B" });
    await restoreVersion(v1.id);
    expect((await getAsset(doc.id))!.title).toBe("Draft A");
    const versions = await repos.versions.listByAsset(doc.id);
    expect(versions.some((v) => v.reason === "pre-restore" && v.title === "Draft B")).toBe(true);
  });

  it("restores a whole-project snapshot and trashes assets created after it", async () => {
    const p = await createProject({ name: "Snap" });
    const a = await createAsset(p.id, "outline", { title: "Keep" });
    const snap = await createProjectSnapshot(p.id, "Before experiment");
    await updateAsset(a.id, { title: "Changed" });
    const extra = await createAsset(p.id, "funnel", { title: "Later" });
    await restoreProjectSnapshot(snap.id);
    expect((await getAsset(a.id))!.title).toBe("Keep");
    expect((await repos.assets.get(extra.id))!.deletedAt).not.toBeNull();
  });
});

describe("backup and restore", () => {
  it("round-trips a workspace backup including files (replace mode)", async () => {
    const p = await createProject({ name: "Backup me" });
    const f = await storeFile(new Blob(["hello file"], { type: "text/plain" }), { name: "x.txt", projectId: p.id, kind: "import" });
    await createAsset(p.id, "document", { title: "Doc" });
    const backup = await createWorkspaceBackup({ includeVersions: true, includeFiles: true });
    const parsed = await parseBackupFile(backupToBlob(backup));
    expect(parsed.summary.projects).toBe(1);
    await repos.clearAll();
    expect(await repos.projects.count()).toBe(0);
    await restoreBackup(parsed.backup, "replace");
    expect((await repos.projects.list())[0].name).toBe("Backup me");
    const restoredFile = await repos.files.get(f.id);
    expect(await restoredFile!.blob.text()).toBe("hello file");
  });

  it("imports a project backup as a copy without touching existing data", async () => {
    const p = await createProject({ name: "Original" });
    await createAsset(p.id, "cover");
    const backup = await createProjectBackup(p.id, { includeVersions: false, includeFiles: false });
    await restoreBackup(backup, "copy");
    const all = await repos.projects.list();
    expect(all).toHaveLength(2);
    expect(all.some((x) => x.name === "Original (restored)")).toBe(true);
  });

  it("rejects invalid backups with a clear message", async () => {
    await expect(parseBackupFile(new Blob(["{\"hello\":1}"]))).rejects.toThrow(/not a valid PLR Champion backup/);
    await expect(parseBackupFile(new Blob(["not json"]))).rejects.toThrow(/not valid JSON/);
  });
});

describe("sample project", () => {
  it("seeds once into an empty workspace", async () => {
    const first = await ensureSampleProject();
    expect(first?.isSample).toBe(true);
    const second = await ensureSampleProject();
    expect(second).toBeNull();
    const docs = await repos.assets.listByProject(first!.id, { type: "document" });
    expect(docs).toHaveLength(1);
    const d = docs[0].data as DocumentData;
    expect(d.original?.chapters.length).toBe(5);
    expect(d.chapters.length).toBe(5);
  });

  it("finishes an interrupted first-run seed instead of leaving half a sample", async () => {
    // Simulate a first visit that was interrupted after the sample project record was written.
    await createProject({ name: "SAMPLE — partial", isSample: true });
    const sample = await ensureSampleProject();
    expect(sample?.isSample).toBe(true);
    const all = await repos.projects.list({ includeArchived: true, includeDeleted: true });
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(sample!.id);
  });

  it("never seeds next to real work or after a replace restore", async () => {
    await createProject({ name: "Real product" });
    expect(await ensureSampleProject()).toBeNull();
    const backup = await createWorkspaceBackup({ includeVersions: true, includeFiles: true });
    const parsed = await parseBackupFile(backupToBlob(backup));
    await restoreBackup(parsed.backup, "replace");
    expect(await ensureSampleProject()).toBeNull();
    expect((await repos.projects.list()).map((p) => p.name)).toEqual(["Real product"]);
  });
});

void trashAsset;
void Dexie;
