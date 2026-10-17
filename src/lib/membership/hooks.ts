"use client";

import * as React from "react";
import { liveQuery } from "dexie";
import { getMembershipRepos, type MembershipRepositories } from "./db";
import { memberFileUrl } from "./files";
import { ensureOwnerAccount } from "./account";
import { ensureSampleLibrary } from "./seed";
import type { BrandId } from "./types";

/** Reactive query over the membership database (same contract as the studio's useLive). */
export function useMemberLive<T>(query: (r: MembershipRepositories) => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean; error: Error | null } {
  const key = JSON.stringify(deps);
  const [state, setState] = React.useState<{ key: string | null; data: T | undefined; loading: boolean; error: Error | null }>({ key: null, data: undefined, loading: true, error: null });
  const queryRef = React.useRef(query);
  queryRef.current = query;

  React.useEffect(() => {
    let active = true;
    let repos: MembershipRepositories;
    try {
      repos = getMembershipRepos();
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

  if (state.key !== key) return { data: undefined, loading: true, error: null };
  return { data: state.data, loading: state.loading, error: state.error };
}

/** Object URL for a stored image/file (cached for the session). */
export function useMemberFileUrl(id: string | null | undefined): string | null {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let on = true;
    setUrl(null);
    if (!id) return;
    memberFileUrl(id)
      .then((u) => on && setUrl(u))
      .catch(() => on && setUrl(null));
    return () => {
      on = false;
    };
  }, [id]);
  return url;
}

export interface MembershipBootProgress {
  label: string;
  done: number;
  total: number;
}

const booting = new Map<BrandId, Promise<void>>();

/** Creates the owner account and, on first visit, the brand's sample library. Safe to call repeatedly. */
export function bootstrapMembership(brandId: BrandId, onProgress?: (p: MembershipBootProgress) => void): Promise<void> {
  let p = booting.get(brandId);
  if (!p) {
    p = (async () => {
      await ensureOwnerAccount();
      await ensureSampleLibrary(brandId, { onProgress: (label, done, total) => onProgress?.({ label, done, total }) });
    })().catch((e) => {
      booting.delete(brandId);
      throw e;
    });
    booting.set(brandId, p);
  }
  return p;
}
