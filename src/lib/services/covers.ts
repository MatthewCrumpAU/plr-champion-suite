import { getRepos, type Repositories } from "@/lib/data";
import type { Asset } from "@/lib/data/types";
import { COVER_TEMPLATES, buildFromTemplate } from "@/lib/covers/templates";
import { createAsset } from "./assets";
import { getProject } from "./projects";

/** Best-fit cover template for a product format. */
export function templateForFormat(format: string): string {
  if (format === "checklist" || format === "quick-start-plan" || format === "worksheet") return "free-checklist";
  if (format === "cheat-sheet") return "cheat-sheet";
  if (format === "workbook" || format === "action-plan" || format === "implementation-plan" || format === "template") return "workbook-clean";
  if (["mini-course", "email-course", "mini-email-course", "challenge", "membership-module"].includes(format)) return "module-card";
  if (format === "short-report" || format === "resource-guide" || format === "resource-list") return "executive-report";
  return "bold-gradient";
}

/** Creates a cover from a template, filled with the given text and the project's brand kit. */
export async function createCoverFor(projectId: string, opts: { title: string; subtitle?: string; templateId?: string; sourceAssetId?: string }, repos: Repositories = getRepos()): Promise<Asset<"cover">> {
  const project = await getProject(projectId, repos);
  if (!project) throw new Error("Project not found.");
  const kit = project.brandKitId ? await repos.brandKits.get(project.brandKitId) : undefined;
  const tpl = COVER_TEMPLATES.find((t) => t.id === opts.templateId) ?? COVER_TEMPLATES[0];
  const data = buildFromTemplate(
    tpl,
    { title: opts.title, subtitle: opts.subtitle ?? "", author: kit?.authorName || "Author Name", tagline: kit?.tagline ?? "", brand: kit?.brandName ?? "" },
    kit ? { palette: kit.colors, heading: kit.headingFont, body: kit.bodyFont } : {},
  );
  return createAsset(projectId, "cover", { title: `${opts.title} — cover`, data, sourceAssetIds: opts.sourceAssetId ? [opts.sourceAssetId] : [] }, repos);
}
