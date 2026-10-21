import { getRepos, type Repositories } from "@/lib/data";
import { BRAND_IDS } from "@/lib/membership/types";
import { getMembershipRepos, type MembershipRepositories } from "@/lib/membership/db";
import { markSamplesRemoved, removeSampleContent } from "@/lib/membership/seed";
import { purgeProject } from "./projects";
import { SAMPLE_FLAG } from "./sample";

export interface CleanStartSummary {
  /** Sample projects removed from the studio (with their documents, images, versions and files). */
  projects: number;
  /** Sample brand kits removed (kits still used by one of your own projects are kept). */
  brandKits: number;
  /** Sample items removed from the memberships (products, drops, courses, resources…). */
  membershipItems: number;
}

/**
 * "Start clean": removes every piece of sample content — the studio's sample project and brand kit
 * and every membership brand's sample library — and makes sure none of it is created again.
 * Your own projects, documents, products, settings and AI key are never touched. A project you
 * duplicated from the sample is yours and stays (with the brand kit it uses).
 */
export async function removeAllSampleContent(studio: Repositories = getRepos(), membership?: MembershipRepositories): Promise<CleanStartSummary> {
  const summary: CleanStartSummary = { projects: 0, brandKits: 0, membershipItems: 0 };

  const projects = await studio.projects.list({ includeArchived: true, includeDeleted: true });
  for (const p of projects.filter((x) => x.isSample)) {
    await purgeProject(p.id, studio);
    summary.projects++;
  }
  const remaining = projects.filter((p) => !p.isSample);
  for (const k of await studio.brandKits.list()) {
    if (!k.isSample || remaining.some((p) => p.brandKitId === k.id)) continue;
    if (k.logoFileId) await studio.files.delete(k.logoFileId).catch(() => undefined);
    await studio.brandKits.delete(k.id);
    summary.brandKits++;
  }
  // Never add the sample project again automatically (Settings → Add the sample project still works).
  await studio.meta.set(SAMPLE_FLAG, true);

  const r = membership ?? getMembershipRepos();
  for (const brandId of BRAND_IDS) {
    summary.membershipItems += await removeSampleContent(brandId, r);
    await markSamplesRemoved(brandId, r);
  }
  return summary;
}
