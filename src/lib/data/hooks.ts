"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { liveQuery } from "dexie";
import { getRepos, type Repositories } from "./index";
import type { Asset, AssetType, BrandKit, Project } from "./types";
import { normalizeAsset } from "@/lib/services/assets";
import { normalizeProject } from "@/lib/services/projects";
import { fileObjectUrl } from "@/lib/services/files";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from "@/lib/services/settings";

/**
 * Reactive query hook. Re-runs automatically when the underlying IndexedDB tables change
 * (in this tab or another tab). This is the only place that knows the storage is reactive;
 * a future cloud implementation can swap this for polling or subscriptions.
 */
export function useLive<T>(query: (repos: Repositories) => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean; error: Error | null } {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string | null; data: T | undefined; loading: boolean; error: Error | null }>({ key: null, data: undefined, loading: true, error: null });
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    let active = true;
    let repos: Repositories;
    try {
      repos = getRepos();
    } catch (e) {
      setState({ key, data: undefined, loading: false, error: e as Error });
      return;
    }
    const sub = liveQuery(() => queryRef.current(repos)).subscribe({
      next: (data) => active && setState({ key, data, loading: false, error: null }),
      error: (error) => active && setState((s) => ({ key, data: s.data, loading: false, error: error instanceof Error ? error : new Error(String(error)) })),
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [key]);

  // Until the query for the current deps has answered, report loading (never stale data for other deps).
  if (state.key !== key) return { data: undefined, loading: true, error: null };
  return { data: state.data, loading: state.loading, error: state.error };
}

export function useProjects(opts: { includeArchived?: boolean; onlyDeleted?: boolean } = {}) {
  return useLive(async (r) => (await r.projects.list(opts)).map(normalizeProject), [opts.includeArchived, opts.onlyDeleted]);
}

export function useProject(id: string | null | undefined) {
  return useLive(async (r) => {
    if (!id) return null;
    const p = await r.projects.get(id);
    return p ? normalizeProject(p) : null;
  }, [id]);
}

export function useAssets<T extends AssetType = AssetType>(projectId: string | null | undefined, type?: T | T[], opts: { onlyDeleted?: boolean } = {}) {
  const key = Array.isArray(type) ? type.join(",") : (type ?? "");
  return useLive(async (r) => {
    if (!projectId) return [] as Asset<T>[];
    const list = await r.assets.listByProject(projectId, { type, onlyDeleted: opts.onlyDeleted });
    return list.map((a) => normalizeAsset(a)) as Asset<T>[];
  }, [projectId, key, opts.onlyDeleted]);
}

export function useAllAssets<T extends AssetType = AssetType>(type?: T | T[]) {
  const key = Array.isArray(type) ? type.join(",") : (type ?? "");
  return useLive(async (r) => (await r.assets.listAll({ type })).map((a) => normalizeAsset(a)) as Asset<T>[], [key]);
}

export function useAsset<T extends AssetType>(id: string | null | undefined) {
  return useLive(async (r) => {
    if (!id) return null;
    const a = await r.assets.get<T>(id);
    return a ? normalizeAsset(a) : null;
  }, [id]);
}

export function useBrandKits() {
  return useLive((r) => r.brandKits.list(), []);
}

export function useBrandKit(id: string | null | undefined) {
  return useLive(async (r): Promise<BrandKit | null> => (id ? ((await r.brandKits.get(id)) ?? null) : null), [id]);
}

export function useVersions(assetId: string | null | undefined) {
  return useLive(async (r) => (assetId ? r.versions.listByAsset(assetId) : []), [assetId]);
}

export function useSnapshots(projectId: string | null | undefined) {
  return useLive(async (r) => (projectId ? r.snapshots.listByProject(projectId) : []), [projectId]);
}

/** Object URL for a stored file id (images, logos). */
export function useFileUrl(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!id) {
      setUrl(null);
      return;
    }
    fileObjectUrl(id)
      .then((u) => active && setUrl(u))
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
    };
  }, [id]);
  return url;
}

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */
export function useSettings(): { settings: AppSettings; update: (patch: Partial<AppSettings>) => Promise<void>; loading: boolean } {
  const { data, loading } = useLive((r) => loadSettings(r), []);
  const update = useCallback(async (patch: Partial<AppSettings>) => {
    await saveSettings(patch);
  }, []);
  return { settings: data ?? DEFAULT_SETTINGS, update, loading };
}

/* ------------------------------------------------------------------ */
/* Active project (per browser)                                         */
/* ------------------------------------------------------------------ */
const ACTIVE_KEY = "plrc.activeProjectId";
const ACTIVE_EVENT = "plrc:active-project";

function readActive(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function subscribeActive(cb: () => void) {
  window.addEventListener(ACTIVE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(ACTIVE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function setActiveProjectId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(ACTIVE_EVENT));
}

export function useActiveProjectId(): [string | null, (id: string | null) => void] {
  const id = useSyncExternalStore(subscribeActive, readActive, () => null);
  return [id, setActiveProjectId];
}

/** Active project, validated against storage (cleared if it was deleted). */
export function useActiveProject(): { project: Project | null; loading: boolean; setActive: (id: string | null) => void } {
  const [id, setActive] = useActiveProjectId();
  const { data, loading } = useProject(id);
  const project = data && !data.deletedAt ? data : null;
  useEffect(() => {
    if (!loading && id && !project) setActive(null);
  }, [loading, id, project, setActive]);
  return { project, loading: loading && !!id, setActive };
}

export function useExportLog(projectId?: string | null) {
  return useLive(async (r) => (projectId ? r.exports.listByProject(projectId) : r.exports.listAll()), [projectId ?? "__all"]);
}

export function useTrashedAssets() {
  return useLive(async (r) => (await r.assets.listAll({ onlyDeleted: true })).map((a) => normalizeAsset(a)), ["trash"]);
}
