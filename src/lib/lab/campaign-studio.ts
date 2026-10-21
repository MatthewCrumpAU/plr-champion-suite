import { importFile } from "@/lib/import";
import { splitIntoChapters } from "@/lib/doc/chapters";
import { createDocumentFromImport } from "@/lib/services/documents";

/**
 * Browser-only: imports a campaign's featured product file into a studio project as its main
 * document, using the same importer and chapter splitter as the PLR Editor. Passed to
 * campaignToProject() as `importDocument` (kept separate so the campaign library stays testable in Node).
 */
export async function importCampaignDocument(file: File, projectId: string, title: string): Promise<void> {
  const result = await importFile(file);
  if (result.empty) return;
  const split = splitIntoChapters(result.doc, "auto");
  await createDocumentFromImport({ projectId, result, title: split.documentTitle || title, chapters: split.chapters });
}
