/** Storage error helpers: turn browser/IndexedDB failures into messages a person can act on. */

export class StorageFullError extends Error {
  constructor() {
    super(
      "Your browser's storage for this app is full. Free space by deleting old versions, unused images or projects in the Trash (Settings → Storage), or export a backup and remove projects you no longer need.",
    );
    this.name = "StorageFullError";
  }
}

export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; inner?: unknown; message?: string };
  if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  if (e.inner && isQuotaError(e.inner)) return true;
  return typeof e.message === "string" && /quota/i.test(e.message);
}

export function toStorageError(err: unknown): Error {
  if (isQuotaError(err)) return new StorageFullError();
  if (err instanceof Error) return err;
  return new Error(String(err));
}

/** Wrap a write so quota failures surface as StorageFullError. */
export async function withStorage<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toStorageError(err);
  }
}
