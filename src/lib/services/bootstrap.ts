import { getRepos, openDatabase } from "@/lib/data";
import { setActiveProjectId } from "@/lib/data/hooks";
import { ensureSampleProject } from "./sample";

let booted: Promise<void> | null = null;

/** Opens IndexedDB and seeds the sample project on first run. Safe to call repeatedly. */
export function bootstrapWorkspace(): Promise<void> {
  if (!booted) {
    booted = (async () => {
      await openDatabase();
      const repos = getRepos();
      try {
        const sample = await ensureSampleProject(repos);
        if (sample) setActiveProjectId(sample.id);
      } catch (e) {
        console.warn("Sample project could not be created", e);
      }
    })().catch((e) => {
      booted = null;
      throw e;
    });
  }
  return booted;
}
