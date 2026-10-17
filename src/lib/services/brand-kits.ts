import { getRepos, type Repositories } from "@/lib/data";
import type { BrandKit } from "@/lib/data/types";
import { withStorage } from "@/lib/data/errors";
import { nowIso, uid } from "@/lib/utils";

export function newBrandKit(partial: Partial<BrandKit> = {}): BrandKit {
  const now = nowIso();
  return {
    id: uid("kit"),
    name: "New brand kit",
    brandName: "",
    tagline: "",
    logoFileId: null,
    colors: { primary: "#5b4df5", secondary: "#1e1b4b", accent: "#f5b544", dark: "#0f1222", light: "#ffffff" },
    palette: [],
    headingFont: "montserrat",
    bodyFont: "inter",
    authorName: "",
    website: "",
    email: "",
    voice: "",
    positioning: "",
    audience: "",
    notes: "",
    isSample: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export async function createBrandKit(partial: Partial<BrandKit> = {}, repos: Repositories = getRepos()): Promise<BrandKit> {
  const kit = newBrandKit(partial);
  await withStorage(() => repos.brandKits.put(kit));
  return kit;
}

export async function updateBrandKit(id: string, patch: Partial<BrandKit>, repos: Repositories = getRepos()): Promise<BrandKit> {
  const k = await repos.brandKits.get(id);
  if (!k) throw new Error("Brand kit not found.");
  const next = { ...k, ...patch, colors: { ...k.colors, ...(patch.colors ?? {}) }, updatedAt: nowIso() };
  await withStorage(() => repos.brandKits.put(next));
  return next;
}

export async function duplicateBrandKit(id: string, repos: Repositories = getRepos()): Promise<BrandKit> {
  const k = await repos.brandKits.get(id);
  if (!k) throw new Error("Brand kit not found.");
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = k;
  return createBrandKit({ ...rest, name: `${k.name} (copy)`, isSample: false }, repos);
}

/** Deletes a kit and unlinks it from any project that used it. */
export async function deleteBrandKit(id: string, repos: Repositories = getRepos()): Promise<number> {
  const projects = await repos.projects.list({ includeArchived: true, includeDeleted: true });
  let unlinked = 0;
  for (const p of projects) {
    if (p.brandKitId === id) {
      await repos.projects.put({ ...p, brandKitId: null, updatedAt: nowIso() });
      unlinked++;
    }
  }
  await repos.brandKits.delete(id);
  return unlinked;
}
