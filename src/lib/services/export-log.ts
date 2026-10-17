import { getRepos, type Repositories } from "@/lib/data";
import type { ExportRecord } from "@/lib/data/types";
import { nowIso, uid } from "@/lib/utils";

export async function logExport(rec: Omit<ExportRecord, "id" | "createdAt">, repos: Repositories = getRepos()) {
  try {
    await repos.exports.add({ ...rec, id: uid("exp"), createdAt: nowIso() });
  } catch {
    /* export history is best-effort */
  }
}
