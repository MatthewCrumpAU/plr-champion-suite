import { importFile } from "@/lib/import";
import { splitIntoChapters } from "@/lib/doc/chapters";
import { createDocumentFromImport } from "@/lib/services/documents";
import { createProject } from "@/lib/services/projects";
import { setActiveProjectId } from "@/lib/data/hooks";
import { getMembershipRepos, type MembershipRepositories } from "./db";
import type { Product, ProductAttachment } from "./types";

/**
 * "Edit in PLR Editor": copies a library file into a new studio project, splits it into chapters
 * with the same importer the editor uses, and returns the new document's id. The library copy is
 * never modified.
 */
export async function openProductInEditor(p: Product, att: ProductAttachment, repos: MembershipRepositories = getMembershipRepos()): Promise<{ projectId: string; documentId: string; chapters: number }> {
  if (!att.editable) throw new Error(`“${att.name}” can't be opened in the editor. Use a DOCX, PDF, TXT, Markdown or HTML file.`);
  const stored = await repos.files.get(att.fileId);
  if (!stored) throw new Error(`“${att.name}” is missing from storage.`);
  const file = new File([stored.blob], att.name, { type: stored.mime });
  const result = await importFile(file);
  if (result.empty) throw new Error("No editable text could be found in this file (it may be a scanned PDF).");
  const split = splitIntoChapters(result.doc, "auto");
  const project = await createProject({
    name: p.title,
    productType: p.format === "course" ? "course" : p.format === "workbook" ? "workbook" : "ebook",
    stage: "editing",
    description: p.subtitle,
    tags: [...p.tags, "From library"],
    notes: `Started from the ${p.brandId === "plrforim" ? "PLRforIM" : "PLR Champion"} library product “${p.title}”. Check its licence (${p.licence.type.toUpperCase()}) before selling.`,
  });
  const doc = await createDocumentFromImport({ projectId: project.id, result, title: split.documentTitle || p.title, chapters: split.chapters });
  setActiveProjectId(project.id);
  return { projectId: project.id, documentId: doc.id, chapters: split.chapters.length };
}
