import { createDexieRepositories, PLRDatabase } from "./dexie";
import type { Repositories } from "./repositories";

let db: PLRDatabase | null = null;
let repos: Repositories | null = null;

/** Browser-only singleton. Server components must never call this. */
export function getRepos(): Repositories {
  if (repos) return repos;
  if (typeof indexedDB === "undefined") throw new Error("Local storage (IndexedDB) is not available in this environment.");
  db = new PLRDatabase();
  repos = createDexieRepositories(db);
  return repos;
}

export function getDb(): PLRDatabase {
  getRepos();
  return db!;
}

/** For tests and future providers. */
export function setRepos(r: Repositories, database: PLRDatabase | null = null) {
  repos = r;
  db = database;
}

export async function openDatabase(): Promise<void> {
  const d = getDb();
  if (!d.isOpen()) await d.open();
}

export type { Repositories } from "./repositories";
export * from "./types";
