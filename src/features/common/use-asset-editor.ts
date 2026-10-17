"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Asset, AssetDataMap, AssetStatus, AssetType } from "@/lib/data/types";
import { getAsset, updateAsset } from "@/lib/services/assets";
import { createVersion, dataSignature } from "@/lib/services/versions";
import { loadSettings } from "@/lib/services/settings";
import { deepClone, errorMessage } from "@/lib/utils";
import type { SaveState } from "@/components/common/save-status";

/**
 * Generic autosaving editor state for any non-document asset.
 * `update` accepts an updater; changes are saved after a short pause and auto-versioned every N minutes.
 */
export function useAssetEditor<T extends AssetType>(assetId: string | null, type: T) {
  const [asset, setAsset] = React.useState<Asset<T> | null>(null);
  const [data, setDataState] = React.useState<AssetDataMap[T] | null>(null);
  const [title, setTitleState] = React.useState("");
  const [status, setStatusState] = React.useState<AssetStatus>("draft");
  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [missing, setMissing] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [loadCount, setLoadCount] = React.useState(0);

  const ref = React.useRef<{ data: AssetDataMap[T] | null; title: string; status: AssetStatus; dirty: boolean; saving: boolean; delay: number; versionMins: number; lastVersionAt: number; lastSig: string }>({
    data: null,
    title: "",
    status: "draft",
    dirty: false,
    saving: false,
    delay: 800,
    versionMins: 10,
    lastVersionAt: Date.now(),
    lastSig: "",
  });
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = React.useRef(assetId);
  idRef.current = assetId;

  React.useEffect(() => {
    let active = true;
    if (!assetId) {
      setAsset(null);
      setDataState(null);
      return;
    }
    (async () => {
      const [a, settings] = await Promise.all([getAsset<T>(assetId), loadSettings().catch(() => null)]);
      if (!active) return;
      if (settings) {
        ref.current.delay = settings.autosaveDelayMs;
        ref.current.versionMins = settings.autoVersionMinutes;
      }
      if (!a || a.type !== type || a.deletedAt) {
        setMissing(true);
        setAsset(null);
        setDataState(null);
        return;
      }
      setMissing(false);
      setAsset(a);
      setDataState(a.data);
      setTitleState(a.title);
      setStatusState(a.status);
      setLastSavedAt(a.updatedAt);
      setSaveState("saved");
      ref.current = { ...ref.current, data: a.data, title: a.title, status: a.status, dirty: false, lastSig: dataSignature(a.data), lastVersionAt: Date.now() };
      setLoadCount((n) => n + 1);
    })();
    return () => {
      active = false;
    };
  }, [assetId, type, reloadToken]);

  const save = React.useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const id = idRef.current;
    if (!id || !ref.current.dirty || !ref.current.data) return;
    if (ref.current.saving) {
      timer.current = setTimeout(() => void save(), 250);
      return;
    }
    ref.current.saving = true;
    ref.current.dirty = false;
    setSaveState("saving");
    try {
      const updated = await updateAsset<T>(id, { data: deepClone(ref.current.data), title: ref.current.title.trim() || "Untitled", status: ref.current.status });
      setAsset(updated);
      setLastSavedAt(updated.updatedAt);
      setSaveState(ref.current.dirty ? "unsaved" : "saved");
      const sig = dataSignature(updated.data);
      if (ref.current.versionMins > 0 && Date.now() - ref.current.lastVersionAt > ref.current.versionMins * 60_000 && sig !== ref.current.lastSig) {
        ref.current.lastVersionAt = Date.now();
        ref.current.lastSig = sig;
        await createVersion(updated, "Auto-save", "auto").catch(() => undefined);
      }
    } catch (err) {
      ref.current.dirty = true;
      setSaveState("error");
      toast.error(errorMessage(err));
    } finally {
      ref.current.saving = false;
    }
  }, []);

  const lastChange = React.useRef(0);
  const schedule = React.useCallback(() => {
    ref.current.dirty = true;
    setSaveState((s) => (s === "saving" ? s : "unsaved"));
    // Single actions (a click, a pasted value) save almost immediately; bursts such as typing are debounced.
    const now = Date.now();
    const burst = now - lastChange.current < ref.current.delay;
    lastChange.current = now;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), burst ? ref.current.delay : 150);
  }, [save]);

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (ref.current.dirty || ref.current.saving) {
        void save();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    const r = ref;
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (r.current.dirty) void save();
    };
  }, [save]);

  const update = React.useCallback(
    (fn: (d: AssetDataMap[T]) => AssetDataMap[T]) => {
      const cur = ref.current.data;
      if (!cur) return;
      const next = fn(cur);
      ref.current.data = next;
      setDataState(next);
      schedule();
    },
    [schedule],
  );

  const patch = React.useCallback((p: Partial<AssetDataMap[T]>) => update((d) => ({ ...d, ...p })), [update]);

  const setTitle = React.useCallback(
    (t: string) => {
      ref.current.title = t;
      setTitleState(t);
      schedule();
    },
    [schedule],
  );
  const setStatus = React.useCallback(
    (s: AssetStatus) => {
      ref.current.status = s;
      setStatusState(s);
      schedule();
    },
    [schedule],
  );

  const snapshot = React.useCallback(
    async (label: string, reason: Parameters<typeof createVersion>[2] = "manual") => {
      await save();
      const id = idRef.current;
      if (!id) return;
      const a = await getAsset(id);
      if (a) await createVersion(a, label, reason);
    },
    [save],
  );

  return {
    asset,
    data,
    title,
    status,
    saveState,
    lastSavedAt,
    missing,
    loadCount,
    update,
    patch,
    setTitle,
    setStatus,
    save,
    snapshot,
    getData: () => ref.current.data,
    reload: () => setReloadToken((t) => t + 1),
  };
}

export type AssetEditor<T extends AssetType> = ReturnType<typeof useAssetEditor<T>>;
