"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, Copy, History, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Asset, AssetType, Project } from "@/lib/data/types";
import { ASSET_STATUS_LABELS, type AssetStatus } from "@/lib/data/types";
import { useAssets } from "@/lib/data/hooks";
import { assetInfo } from "@/lib/data/asset-types";
import { duplicateAsset, trashAsset } from "@/lib/services/assets";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, NativeSelect, PageContainer, PageHeader, Spinner } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { SaveStatus } from "@/components/common/save-status";
import { VersionHistoryDialog } from "@/components/common/version-history";
import { useBreadcrumb } from "@/components/shell/app-shell";
import { useAssetEditor, type AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage, timeAgo } from "@/lib/utils";

export function useAssetParam(): [string | null, (id: string | null) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("id");
  const set = React.useCallback(
    (next: string | null) => {
      const sp = new URLSearchParams(params.toString());
      if (next) sp.set("id", next);
      else sp.delete("id");
      const q = sp.toString();
      router.push(q ? `${pathname}?${q}` : pathname);
    },
    [params, router, pathname],
  );
  return [id, set];
}

const statusVariant = (s: AssetStatus) => (s === "approved" || s === "ready" ? "success" : s === "in-progress" ? "default" : "secondary");

export interface AssetWorkspaceProps<T extends AssetType> {
  project: Project;
  type: T;
  tool: string;
  eyebrow: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  createLabel?: string;
  /** Create a new asset and return its id. Omit to hide the create button. */
  onCreate?: () => Promise<string | null>;
  /** Optional custom create UI (e.g. template picker) rendered instead of calling onCreate directly. */
  createDialog?: (p: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) => React.ReactNode;
  itemMeta?: (asset: Asset<T>) => React.ReactNode;
  itemPreview?: (asset: Asset<T>) => React.ReactNode;
  renderEditor: (editor: AssetEditor<T>) => React.ReactNode;
  headerActions?: (editor: AssetEditor<T>) => React.ReactNode;
  versionPreview?: (data: unknown) => React.ReactNode;
  versionText?: (data: unknown) => string;
  listHeaderExtra?: React.ReactNode;
  /** Canvas-style tools fill the viewport height. */
  fullHeight?: boolean;
  emptyHint?: React.ReactNode;
}

export function AssetWorkspace<T extends AssetType>(props: AssetWorkspaceProps<T>) {
  const [id, setId] = useAssetParam();
  if (id) return <AssetEditorView key={id} {...props} id={id} onBack={() => setId(null)} onSwitch={setId} />;
  return <AssetList {...props} onOpen={setId} />;
}

function AssetList<T extends AssetType>({ project, type, tool, eyebrow, description, icon, createLabel, onCreate, createDialog, itemMeta, itemPreview, onOpen, listHeaderExtra, emptyHint }: AssetWorkspaceProps<T> & { onOpen: (id: string) => void }) {
  const { data: assets, loading } = useAssets<T>(project.id, type);
  const [creating, setCreating] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const confirm = useConfirm();
  const info = assetInfo(type);

  const create = async () => {
    if (createDialog) return setDialogOpen(true);
    if (!onCreate) return;
    setCreating(true);
    try {
      const newId = await onCreate();
      if (newId) onOpen(newId);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow={eyebrow}
        title={tool}
        description={description}
        actions={
          (onCreate || createDialog) && (
            <Button onClick={() => void create()} loading={creating} data-testid="create-asset">
              <Plus /> {createLabel ?? `New ${info.label.toLowerCase()}`}
            </Button>
          )
        }
      />
      {listHeaderExtra}
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner /> Loading…
        </div>
      ) : !assets?.length ? (
        <EmptyState
          icon={icon}
          title={`No ${info.plural.toLowerCase()} in ${project.name} yet`}
          description={emptyHint ?? `Create your first ${info.label.toLowerCase()} to get started. It will be linked to this project.`}
          action={
            (onCreate || createDialog) && (
              <Button onClick={() => void create()} loading={creating}>
                <Plus /> {createLabel ?? `New ${info.label.toLowerCase()}`}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="asset-list">
          {assets.map((a) => (
            <Card key={a.id} className="group relative flex flex-col overflow-hidden transition hover:border-primary/40 hover:shadow-md">
              <button type="button" onClick={() => onOpen(a.id)} className="absolute inset-0 z-0" aria-label={`Open ${a.title}`} />
              {itemPreview && <div className="pointer-events-none border-b bg-secondary/40">{itemPreview(a)}</div>}
              <div className="flex items-start gap-3 p-4">
                {!itemPreview && <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-5">{icon}</span>}
                <div className="pointer-events-none min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{itemMeta ? itemMeta(a) : info.label}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" className="relative z-10" aria-label="Options">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={async () => {
                        const c = await duplicateAsset(a.id);
                        toast.success("Duplicated");
                        onOpen(c.id);
                      }}
                    >
                      <Copy /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      onSelect={async () => {
                        if (await confirm({ title: `Move “${a.title}” to the Trash?`, description: "You can restore it from Projects → Trash.", confirmLabel: "Move to Trash", destructive: true })) {
                          await trashAsset(a.id);
                          toast.success("Moved to Trash");
                        }
                      }}
                    >
                      <Trash2 /> Move to Trash
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="pointer-events-none mt-auto flex items-center gap-2 px-4 pb-3">
                <Badge variant={statusVariant(a.status)}>{ASSET_STATUS_LABELS[a.status]}</Badge>
                <span className="ml-auto text-[11px] text-muted-foreground">Updated {timeAgo(a.updatedAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {createDialog?.({ open: dialogOpen, onOpenChange: setDialogOpen, onCreated: (newId) => onOpen(newId) })}
    </PageContainer>
  );
}

function AssetEditorView<T extends AssetType>({ id, project, type, tool, renderEditor, headerActions, versionPreview, versionText, onBack, onSwitch, fullHeight }: AssetWorkspaceProps<T> & { id: string; onBack: () => void; onSwitch: (id: string) => void }) {
  const editor = useAssetEditor(id, type);
  const { data: siblings } = useAssets<T>(project.id, type);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const info = assetInfo(type);
  useBreadcrumb(editor.title || null);

  if (editor.missing) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<Trash2 />} title={`${info.label} not found`} description="It may have been deleted, moved to the Trash, or belongs to another project." action={<Button onClick={onBack}>Back to {tool}</Button>} />
      </PageContainer>
    );
  }
  if (!editor.asset || !editor.data) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }

  const header = (
    <div className={cn("no-print flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2 sm:px-4", !fullHeight && "sticky top-0 z-20")}>
      <Tooltip content={`All ${info.plural.toLowerCase()}`}>
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to list">
          <ArrowLeft />
        </Button>
      </Tooltip>
      <input
        value={editor.title}
        onChange={(e) => editor.setTitle(e.target.value)}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-[15px] font-semibold outline-none hover:border-border focus:border-primary sm:max-w-md"
        aria-label={`${info.label} title`}
        data-testid="asset-title"
      />
      {siblings && siblings.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Switch <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>{info.plural}</DropdownMenuLabel>
            {siblings.map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => onSwitch(s.id)} className={cn(s.id === id && "bg-secondary")}>
                <span className="truncate">{s.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SaveStatus state={editor.saveState} lastSavedAt={editor.lastSavedAt} onRetry={() => void editor.save()} />
        <NativeSelect value={editor.status} onChange={(e) => editor.setStatus(e.target.value as AssetStatus)} className="h-8 w-auto text-xs" aria-label="Status">
          {Object.entries(ASSET_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
        <Tooltip content="Version history">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={async () => {
              await editor.save();
              setHistoryOpen(true);
            }}
            aria-label="Version history"
            data-testid="open-history"
          >
            <History />
          </Button>
        </Tooltip>
        {headerActions?.(editor)}
      </div>
    </div>
  );

  return (
    <div className={cn(fullHeight ? "flex min-h-full flex-col lg:h-full lg:min-h-0" : "min-h-full")}>
      {header}
      {/* Full-height editors fill the window on large screens and stack into a scrolling page on small ones. */}
      <div className={cn(fullHeight ? "flex-1 lg:min-h-0" : "")}>{renderEditor(editor)}</div>
      <VersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        asset={editor.asset as Asset}
        beforeAction={editor.save}
        onRestored={editor.reload}
        toText={versionText}
        renderPreview={(d, t) =>
          versionPreview ? (
            versionPreview(d)
          ) : (
            <div className="grid gap-2 text-sm">
              <p className="font-semibold">{t}</p>
              <p className="text-muted-foreground">Restore this version to see it in the editor. Your current state is saved first.</p>
            </div>
          )
        }
      />
    </div>
  );
}
