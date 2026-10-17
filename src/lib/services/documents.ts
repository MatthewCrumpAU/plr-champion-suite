import { getRepos, type Repositories } from "@/lib/data";
import type { Asset, Project } from "@/lib/data/types";
import { newChapter, type Chapter, type DocumentData, type DocumentRole, type ImportSource } from "@/lib/models/document";
import type { SplitChapter } from "@/lib/doc/chapters";
import { docWords } from "@/lib/doc/text";
import { deepClone, nowIso, uid } from "@/lib/utils";
import { createAsset, getAsset, updateAsset } from "./assets";
import { storeFile } from "./files";
import { getProject, updateProject } from "./projects";
import { createVersion, snapshotById } from "./versions";
import type { PMDoc } from "@/lib/doc/types";
import type { ImportResult } from "@/lib/import";

export interface CreateFromImportInput {
  projectId: string;
  result: Pick<ImportResult, "fileName" | "format" | "fingerprint" | "blob" | "warnings" | "pageCount">;
  title: string;
  chapters: SplitChapter[];
  role?: DocumentRole;
  format?: string;
  keepFile?: boolean;
}

/** Saves an import: original file, frozen original chapters, editable chapters and an "Import" version. */
export async function createDocumentFromImport(input: CreateFromImportInput, repos: Repositories = getRepos()): Promise<Asset<"document">> {
  const project = await getProject(input.projectId, repos);
  if (!project) throw new Error("Project not found.");

  let fileId: string | null = null;
  if (input.keepFile !== false) {
    const f = await storeFile(input.result.blob, { name: input.result.fileName, projectId: project.id, kind: "import", fingerprint: input.result.fingerprint }, repos);
    fileId = f.id;
  }

  const originals: Chapter[] = input.chapters.map((c) => newChapter(c.title, deepClone(c.content)));
  const edited: Chapter[] = originals.map((o) => ({ ...newChapter(o.title, deepClone(o.content)), sourceChapterId: o.id }));
  const source: ImportSource = {
    id: uid("src"),
    fileName: input.result.fileName,
    format: input.result.format,
    fileId,
    fingerprint: input.result.fingerprint,
    importedAt: nowIso(),
    warnings: input.result.warnings,
    wordCount: originals.reduce((n, c) => n + docWords(c.content), 0),
    pageCount: input.result.pageCount,
  };
  const role: DocumentRole = input.role ?? (project.mainDocumentId ? "product" : "main");
  const data: Partial<DocumentData> = {
    role,
    format: input.format ?? project.productType ?? "ebook",
    chapterLabel: "Chapter",
    chapters: edited,
    original: { sources: [source], chapters: originals },
  };
  const asset = await createAsset(project.id, "document", { title: input.title, data, status: "draft" }, repos);
  await createVersion(asset, `Imported ${input.result.fileName}`, "import", repos);

  const patch: Partial<Project> = { sourceFingerprints: [...new Set([...(project.sourceFingerprints ?? []), input.result.fingerprint])] };
  if (!project.mainDocumentId || role === "main") patch.mainDocumentId = asset.id;
  if (project.stage === "idea") patch.stage = "editing";
  await updateProject(project.id, patch, repos);
  return asset;
}

/** Creates a blank or pre-filled document. */
export async function createDocument(projectId: string, opts: { title: string; chapters?: { title: string; content: Chapter["content"] }[]; role?: DocumentRole; format?: string; chapterLabel?: string; subtitle?: string; description?: string; sourceAssetIds?: string[]; builder?: DocumentData["builder"] }, repos: Repositories = getRepos()) {
  const project = await getProject(projectId, repos);
  if (!project) throw new Error("Project not found.");
  const chapters = (opts.chapters?.length ? opts.chapters : [{ title: `${opts.chapterLabel ?? "Chapter"} 1`, content: undefined }]).map((c) => newChapter(c.title, c.content ? deepClone(c.content) : undefined));
  const role = opts.role ?? (project.mainDocumentId ? "draft" : "main");
  const asset = await createAsset(
    projectId,
    "document",
    {
      title: opts.title,
      sourceAssetIds: opts.sourceAssetIds,
      data: { role, format: opts.format ?? project.productType ?? "ebook", chapterLabel: opts.chapterLabel ?? "Chapter", chapters, subtitle: opts.subtitle ?? "", description: opts.description ?? "", builder: opts.builder ?? null },
    },
    repos,
  );
  await createVersion(asset, "Created", "created", repos);
  if (!project.mainDocumentId && role === "main") await updateProject(projectId, { mainDocumentId: asset.id }, repos);
  return asset;
}

/** Projects that already contain an import of this exact file. */
export async function findProjectsWithFingerprint(fingerprint: string, repos: Repositories = getRepos()): Promise<Project[]> {
  const all = await repos.projects.list({ includeArchived: true });
  return all.filter((p) => (p.sourceFingerprints ?? []).includes(fingerprint));
}

/* ------------------------------------------------------------------ */
/* Writing generated content into existing documents                    */
/* ------------------------------------------------------------------ */

export type InsertMode = { kind: "new-chapter"; afterChapterId: string | null } | { kind: "replace-chapter"; chapterId: string } | { kind: "append-to-chapter"; chapterId: string };

/** Adds content to an existing document. A version is saved first for replace operations. */
export async function insertIntoDocument(documentId: string, content: { title: string; doc: PMDoc }, mode: InsertMode, repos: Repositories = getRepos()) {
  const asset = await getAsset<"document">(documentId, repos);
  if (!asset) throw new Error("Document not found.");
  const chapters = [...asset.data.chapters];
  if (mode.kind === "replace-chapter") {
    await snapshotById(documentId, "Before replacing a chapter with AI Writer content", "pre-ai", repos);
    const i = chapters.findIndex((c) => c.id === mode.chapterId);
    if (i < 0) throw new Error("Chapter not found.");
    chapters[i] = { ...chapters[i], title: content.title || chapters[i].title, content: deepClone(content.doc) };
  } else if (mode.kind === "append-to-chapter") {
    await snapshotById(documentId, "Before adding AI Writer content", "pre-apply", repos);
    const i = chapters.findIndex((c) => c.id === mode.chapterId);
    if (i < 0) throw new Error("Chapter not found.");
    const existing = chapters[i].content.content.filter((n) => !(n.type === "paragraph" && !n.content?.length));
    chapters[i] = { ...chapters[i], content: { type: "doc", content: [...existing, ...deepClone(content.doc.content)] } };
  } else {
    const ch = newChapter(content.title || "New chapter", deepClone(content.doc));
    const i = mode.afterChapterId ? chapters.findIndex((c) => c.id === mode.afterChapterId) : chapters.length - 1;
    chapters.splice(i + 1, 0, ch);
  }
  return updateAsset<"document">(documentId, { data: { ...asset.data, chapters } }, repos);
}
