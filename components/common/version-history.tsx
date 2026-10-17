"use client";

import * as React from "react";
import { History, RotateCcw, Save, Trash2, GitCompareArrows } from "lucide-react";
import { toast } from "sonner";
import type { Asset, AssetVersion } from "@/lib/data/types";
import { VERSION_REASON_LABELS } from "@/lib/data/types";
import { useVersions } from "@/lib/data/hooks";
import { createVersion, deleteVersion, restoreVersion } from "@/lib/services/versions";
import { getAsset } from "@/lib/services/assets";
import { diffText, diffToInlineHtml } from "@/lib/doc/diff";
import { Button } from "@/components/ui/button";
import { Badge, Input, Spinner } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { cn, errorMessage, formatBytes, formatDateTime } from "@/lib/utils";

export function VersionHistoryDialog({
  open,
  onOpenChange,
  asset,
  beforeAction,
  renderPreview,
  toText,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  asset: Asset;
  /** Flush unsaved edits before snapshotting or restoring. */
  beforeAction?: () => Promise<void>;
  renderPreview: (data: unknown, title: string) => React.ReactNode;
  /** Plain-text projection used for "compare with current". */
  toText?: (data: unknown) => string;
  onRestored?: () => void;
}) {
  const { data: versions, loading } = useVersions(open ? asset.id : null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [compare, setCompare] = React.useState(false);
  const [currentText, setCurrentText] = React.useState("");
  const confirm = useConfirm();

  const selected: AssetVersion | null = versions?.find((v) => v.id === selectedId) ?? versions?.[0] ?? null;

  React.useEffect(() => {
    if (!open || !compare || !toText) return;
    getAsset(asset.id).then((a) => a && setCurrentText(toText(a.data)));
  }, [open, compare, toText, asset.id]);

  async function saveSnapshot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await beforeAction?.();
      const fresh = await getAsset(asset.id);
      if (!fresh) throw new Error("Item not found.");
      await createVersion(fresh, label || `Snapshot ${new Date().toLocaleString()}`, "manual");
      setLabel("");
      toast.success("Snapshot saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function restore(v: AssetVersion) {
    const ok = await confirm({
      title: `Restore “${v.label}”?`,
      description: "Your current content is saved as a version first, so you can undo this restore from this list.",
      confirmLabel: "Restore version",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await beforeAction?.();
      await restoreVersion(v.id);
      toast.success("Version restored");
      onRestored?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(v: AssetVersion) {
    const ok = await confirm({ title: "Delete this version?", description: "This version will be permanently removed from history.", confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    await deleteVersion(v.id);
    if (selectedId === v.id) setSelectedId(null);
  }

  const diffHtml = React.useMemo(() => {
    if (!compare || !selected || !toText) return null;
    const d = diffText(toText(selected.data), currentText);
    return { html: diffToInlineHtml(d.parts), pct: d.changePercent };
  }, [compare, selected, toText, currentText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 p-0">
        <DialogHeader className="border-b p-5">
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" /> Version history
          </DialogTitle>
          <DialogDescription>Save named snapshots and restore any earlier version. Restoring first saves your current content, so it can always be undone.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 md:grid-cols-[320px_1fr]">
          <div className="flex min-h-0 flex-col border-b md:border-b-0 md:border-r">
            <form className="flex gap-2 border-b p-3" onSubmit={saveSnapshot}>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Snapshot name (optional)" aria-label="Snapshot name" />
              <Button type="submit" size="icon" loading={busy} aria-label="Save snapshot" data-testid="save-snapshot">
                {!busy && <Save />}
              </Button>
            </form>
            <div className="plr-scroll max-h-[55vh] overflow-y-auto p-2">
              {loading && (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Spinner /> Loading…
                </div>
              )}
              {!loading && !versions?.length && <p className="p-3 text-sm text-muted-foreground">No versions yet. Snapshots are also created automatically while you work and before imports, AI changes and bulk edits.</p>}
              {versions?.map((v) => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={cn("mb-1 flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition", selected?.id === v.id ? "bg-primary-soft" : "hover:bg-secondary")}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{v.label}</span>
                    <Badge variant={v.reason === "manual" ? "default" : "secondary"}>{VERSION_REASON_LABELS[v.reason]}</Badge>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(v.createdAt)} · {v.wordCount != null ? `${v.wordCount.toLocaleString()} words` : formatBytes(v.size)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex min-h-[50vh] min-w-0 flex-col">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{selected.title}</p>
                  {toText && (
                    <Button size="sm" variant={compare ? "soft" : "ghost"} onClick={() => setCompare((c) => !c)}>
                      <GitCompareArrows /> {compare ? "Show version" : "Compare with current"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(selected)} aria-label="Delete version">
                    <Trash2 />
                  </Button>
                  <Button size="sm" onClick={() => restore(selected)} disabled={busy} data-testid="restore-version">
                    <RotateCcw /> Restore
                  </Button>
                </div>
                <div className="plr-scroll max-h-[60vh] flex-1 overflow-y-auto p-6">
                  {compare && diffHtml ? (
                    <>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Changes from this version to your current content · about {diffHtml.pct}% different. <span className="plr-diff-removed px-1">removed</span> <span className="plr-diff-added px-1">added</span>
                      </p>
                      <div className="plr-prose whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: diffHtml.html }} />
                    </>
                  ) : (
                    renderPreview(selected.data, selected.title)
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a version to preview it.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
