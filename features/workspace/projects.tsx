"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, Camera, CheckCircle2, Circle, Copy, Download, FolderKanban, FolderOpen, MoreHorizontal, Package, Plus, RotateCcw, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Asset, AssetType, Project, ProjectStage } from "@/lib/data/types";
import { PROJECT_STAGE_LABELS } from "@/lib/data/types";
import { useActiveProjectId, useAllAssets, useAssets, useBrandKits, useExportLog, useProject, useProjects, useSnapshots, useTrashedAssets, setActiveProjectId } from "@/lib/data/hooks";
import { ASSET_TYPES, assetHref, assetInfo } from "@/lib/data/asset-types";
import { archiveProject, createProjectSnapshot, deleteProjectSnapshot, duplicateProject, emptyTrash, purgeProject, restoreProject, restoreProjectSnapshot, trashProject, updateProject } from "@/lib/services/projects";
import { duplicateAsset, purgeAsset, restoreAsset, trashAsset } from "@/lib/services/assets";
import { backupFileName, backupToBlob, createProjectBackup } from "@/lib/services/backup";
import { downloadBlob } from "@/lib/export/download";
import { workflowStatus } from "@/lib/workflow";
import { NewProjectDialog, PRODUCT_TYPES } from "@/components/common/project-gate";
import { useBreadcrumb } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Field, Input, NativeSelect, PageContainer, PageHeader, Progress, Spinner, Textarea } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { cn, errorMessage, formatBytes, formatDate, timeAgo } from "@/lib/utils";

const STUDIO_ORDER = ["content", "design", "product", "research", "marketing", "profit"] as const;
const STUDIO_LABELS: Record<string, string> = { content: "Content Studio", design: "Design Studio", product: "Product Studio", research: "Research Studio", marketing: "Marketing Studio", profit: "Profit Studio" };

/* ------------------------------------------------------------------ */
/* Shared actions                                                       */
/* ------------------------------------------------------------------ */
function useProjectActions() {
  const confirm = useConfirm();
  const router = useRouter();
  return {
    duplicate: async (p: Project) => {
      try {
        const c = await duplicateProject(p.id);
        toast.success(`Created “${c.name}”`);
        return c;
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    snapshot: async (p: Project) => {
      const s = await createProjectSnapshot(p.id, `Snapshot ${new Date().toLocaleString()}`);
      toast.success(`Snapshot saved (${s.assetCount} items)`);
    },
    archive: async (p: Project) => {
      await archiveProject(p.id, p.status !== "archived");
      toast.success(p.status === "archived" ? "Project restored from the archive" : "Project archived");
    },
    trash: async (p: Project) => {
      if (!(await confirm({ title: `Move “${p.name}” to the Trash?`, description: "You can restore it from the Trash tab until you empty it.", confirmLabel: "Move to Trash", destructive: true }))) return false;
      await trashProject(p.id);
      toast.success("Moved to Trash");
      return true;
    },
    purge: async (p: Project) => {
      if (!(await confirm({ title: `Permanently delete “${p.name}”?`, description: "This deletes the project and every asset, version, snapshot and file in it. It cannot be undone. Download a backup first if you might need it.", confirmLabel: "Delete forever", destructive: true, typeToConfirm: "DELETE" }))) return;
      await purgeProject(p.id);
      toast.success("Project permanently deleted");
    },
    backup: async (p: Project) => {
      const b = await createProjectBackup(p.id, { includeVersions: true, includeFiles: true });
      downloadBlob(backupToBlob(b), backupFileName("project", p.name));
      toast.success("Project backup downloaded");
    },
    open: (p: Project) => {
      setActiveProjectId(p.id);
      router.push(`/projects/view?id=${p.id}`);
    },
  };
}

function ProjectMenu({ p, onTrashed }: { p: Project; onTrashed?: () => void }) {
  const a = useProjectActions();
  const [activeId] = useActiveProjectId();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Project options" data-testid="project-menu">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {activeId !== p.id && (
          <DropdownMenuItem onSelect={() => { setActiveProjectId(p.id); toast.success(`“${p.name}” is now the active project`); }}>
            <Star /> Make active project
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void a.duplicate(p)} data-testid="project-duplicate">
          <Copy /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void a.snapshot(p)}>
          <Camera /> Save snapshot
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void a.backup(p)}>
          <Download /> Download backup
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void a.archive(p)} data-testid="project-archive">
          {p.status === "archived" ? <ArchiveRestore /> : <Archive />} {p.status === "archived" ? "Unarchive" : "Archive"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={async () => { if (await a.trash(p)) onTrashed?.(); }} data-testid="project-trash">
          <Trash2 /> Move to Trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Projects list                                                        */
/* ------------------------------------------------------------------ */
function TrashView() {
  const { data: projects } = useProjects({ onlyDeleted: true });
  const { data: assets } = useTrashedAssets();
  const { data: all } = useProjects({ includeArchived: true });
  const names = new Map((all ?? []).map((p) => [p.id, p.name]));
  const a = useProjectActions();
  const confirm = useConfirm();
  const empty = !projects?.length && !assets?.length;
  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">Items in the Trash can be restored until you delete them permanently.</p>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto text-destructive"
          disabled={empty}
          onClick={async () => {
            if (!(await confirm({ title: "Empty the Trash?", description: "Everything in the Trash is deleted permanently. This cannot be undone.", confirmLabel: "Empty Trash", destructive: true, typeToConfirm: "DELETE" }))) return;
            const n = await emptyTrash();
            toast.success(`Permanently deleted ${n} item${n === 1 ? "" : "s"}`);
          }}
          data-testid="empty-trash"
        >
          <Trash2 /> Empty Trash
        </Button>
      </div>
      {empty && <EmptyState icon={<Trash2 />} title="The Trash is empty" description="Deleted projects and items appear here." />}
      {!!projects?.length && (
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Projects ({projects.length})</h3>
          {projects.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center gap-3 p-3" data-testid="trash-project">
              <FolderKanban className="size-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">Deleted {timeAgo(p.deletedAt)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={async () => { await restoreProject(p.id); toast.success("Project restored"); }} data-testid="restore-project">
                <RotateCcw /> Restore
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void a.purge(p)}>
                Delete forever
              </Button>
            </Card>
          ))}
        </section>
      )}
      {!!assets?.length && (
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Items ({assets.length})</h3>
          {assets.map((x) => (
            <Card key={x.id} className="flex flex-wrap items-center gap-3 p-3" data-testid="trash-asset">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{x.title}</p>
                <p className="text-xs text-muted-foreground">
                  {assetInfo(x.type).label} · {names.get(x.projectId) ?? "Deleted project"} · deleted {timeAgo(x.deletedAt)}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={async () => { await restoreAsset(x.id); toast.success("Restored"); }}>
                <RotateCcw /> Restore
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  if (!(await confirm({ title: `Permanently delete “${x.title}”?`, description: "Its version history is deleted too. This cannot be undone.", confirmLabel: "Delete forever", destructive: true }))) return;
                  await purgeAsset(x.id);
                  toast.success("Deleted permanently");
                }}
              >
                Delete forever
              </Button>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

export function ProjectsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [newOpen, setNewOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"active" | "archived" | "trash">("active");
  const [q, setQ] = React.useState("");
  const { data: projects, loading } = useProjects({ includeArchived: true });
  const { data: trashed } = useProjects({ onlyDeleted: true });
  const { data: trashedAssets } = useTrashedAssets();
  const { data: assets } = useAllAssets();
  const [activeId] = useActiveProjectId();
  const a = useProjectActions();

  React.useEffect(() => {
    if (params.get("new") === "1") {
      setNewOpen(true);
      router.replace(pathname);
    }
  }, [params, pathname, router]);

  const counts = new Map<string, number>();
  for (const x of assets ?? []) if (!x.deletedAt) counts.set(x.projectId, (counts.get(x.projectId) ?? 0) + 1);
  const term = q.trim().toLowerCase();
  const list = (projects ?? []).filter((p) => (tab === "archived" ? p.status === "archived" : p.status !== "archived") && (!term || [p.name, p.niche, p.description, ...(p.tags ?? [])].some((s) => (s ?? "").toLowerCase().includes(term))));

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Each project holds one product and everything made for it — documents, covers, mockups, bonuses, sales copy, emails, funnels and numbers."
        actions={
          <Button onClick={() => setNewOpen(true)} data-testid="new-project">
            <Plus /> New project
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="active">Active ({(projects ?? []).filter((p) => p.status !== "archived").length})</TabsTrigger>
            <TabsTrigger value="archived" data-testid="tab-archived">
              Archived ({(projects ?? []).filter((p) => p.status === "archived").length})
            </TabsTrigger>
            <TabsTrigger value="trash" data-testid="tab-trash">
              Trash ({(trashed?.length ?? 0) + (trashedAssets?.length ?? 0)})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {tab !== "trash" && (
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="h-9 w-64 pl-8" />
          </div>
        )}
      </div>
      {tab === "trash" ? (
        <TrashView />
      ) : loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Spinner /> Loading…
        </div>
      ) : list.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="project-list">
          {list.map((p) => (
            <Card key={p.id} className={cn("flex flex-col gap-2 p-4 transition hover:shadow-md", p.id === activeId && "border-primary/50 ring-1 ring-primary/20")} data-testid="project-card">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => a.open(p)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-semibold hover:text-primary">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[PRODUCT_TYPES.find(([v]) => v === p.productType)?.[1], p.niche].filter(Boolean).join(" · ") || "No niche set"}</p>
                </button>
                <ProjectMenu p={p} />
              </div>
              {p.description && <p className="line-clamp-2 text-[13px] text-muted-foreground">{p.description}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                {p.id === activeId && <Badge>Active</Badge>}
                {p.isSample && <Badge variant="sample">Sample</Badge>}
                <Badge variant="outline">{PROJECT_STAGE_LABELS[p.stage]}</Badge>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {counts.get(p.id) ?? 0} assets · {timeAgo(p.updatedAt)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<FolderKanban />} title={tab === "archived" ? "No archived projects" : term ? "No projects match" : "No projects yet"} description={tab === "archived" ? "Archive finished projects to keep this list tidy — they stay fully available." : "Create a project for each PLR product you're working on."} action={tab === "active" && !term ? <Button onClick={() => setNewOpen(true)}><Plus /> New project</Button> : undefined} />
      )}
      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(p) => router.push(`/projects/view?id=${p.id}`)} />
    </PageContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Project overview                                                     */
/* ------------------------------------------------------------------ */
function DetailsForm({ p }: { p: Project }) {
  const { data: kits } = useBrandKits();
  const fromProject = (x: Project) => ({ name: x.name, description: x.description, niche: x.niche, audience: x.audience, productType: x.productType, stage: x.stage, brandKitId: x.brandKitId ?? "", plannedPrice: x.plannedPrice === null ? "" : String(x.plannedPrice), currency: x.currency || "USD", tags: (x.tags ?? []).join(", "), notes: x.notes });
  const [form, setForm] = React.useState(() => fromProject(p));
  const [saving, setSaving] = React.useState<"idle" | "saving" | "saved">("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const writing = React.useRef(false);
  const save = React.useCallback(
    (f: typeof form) => {
      if (timer.current) clearTimeout(timer.current);
      setSaving("saving");
      timer.current = setTimeout(async () => {
        timer.current = null;
        if (!f.name.trim()) return setSaving("idle");
        writing.current = true;
        try {
          await updateProject(p.id, { name: f.name.trim(), description: f.description, niche: f.niche, audience: f.audience, productType: f.productType, stage: f.stage as ProjectStage, brandKitId: f.brandKitId || null, plannedPrice: f.plannedPrice === "" ? null : Math.max(0, Number(f.plannedPrice) || 0), currency: f.currency, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), notes: f.notes });
          setSaving("saved");
        } finally {
          writing.current = false;
        }
      }, 600);
    },
    [p.id],
  );
  // Changes made elsewhere (a snapshot restore, another tab, an export marking the stage) refresh the form,
  // unless the owner has edits here that are still waiting to be saved.
  React.useEffect(() => {
    if (timer.current || writing.current) return;
    setForm(fromProject(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.updatedAt]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const next = { ...form, [k]: e.target.value };
    setForm(next);
    save(next);
  };
  return (
    <Card className="grid gap-4 p-5" data-testid="project-details">
      <div className="flex items-center">
        <p className="text-sm font-semibold">Project details</p>
        <span className="ml-auto text-xs text-muted-foreground">{saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : ""}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="pd-name" error={!form.name.trim() ? "A name is required." : undefined}>
          <Input id="pd-name" value={form.name} onChange={set("name")} data-testid="project-name" />
        </Field>
        <Field label="Stage" htmlFor="pd-stage">
          <NativeSelect id="pd-stage" value={form.stage} onChange={set("stage")} data-testid="project-stage">
            {Object.entries(PROJECT_STAGE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Niche" htmlFor="pd-niche">
          <Input id="pd-niche" value={form.niche} onChange={set("niche")} />
        </Field>
        <Field label="Product type" htmlFor="pd-type">
          <NativeSelect id="pd-type" value={form.productType} onChange={set("productType")}>
            {PRODUCT_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Audience" htmlFor="pd-aud" className="md:col-span-2">
          <Input id="pd-aud" value={form.audience} onChange={set("audience")} />
        </Field>
        <Field label="Brand kit" htmlFor="pd-kit">
          <NativeSelect id="pd-kit" value={form.brandKitId} onChange={set("brandKitId")}>
            <option value="">None</option>
            {kits?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-[1fr_100px] gap-2">
          <Field label="Planned price" htmlFor="pd-price" optional>
            <Input id="pd-price" type="number" min={0} step="0.01" value={form.plannedPrice} onChange={set("plannedPrice")} />
          </Field>
          <Field label="Currency" htmlFor="pd-cur">
            <NativeSelect id="pd-cur" value={form.currency} onChange={set("currency")}>
              {["USD", "AUD", "GBP", "EUR", "CAD", "NZD"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Description" htmlFor="pd-desc" className="md:col-span-2">
          <Textarea id="pd-desc" rows={2} value={form.description} onChange={set("description")} />
        </Field>
        <Field label="Tags" htmlFor="pd-tags" optional hint="Comma separated — used by Portfolio search.">
          <Input id="pd-tags" value={form.tags} onChange={set("tags")} />
        </Field>
        <Field label="Notes" htmlFor="pd-notes" optional>
          <Textarea id="pd-notes" rows={2} value={form.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Card>
  );
}

function AssetGroups({ assets }: { assets: Asset[] }) {
  const confirm = useConfirm();
  const byStudio = new Map<string, Asset[]>();
  for (const a of assets) {
    const s = ASSET_TYPES[a.type as AssetType].studio;
    byStudio.set(s, [...(byStudio.get(s) ?? []), a]);
  }
  if (!assets.length) return <EmptyState icon={<FolderOpen />} title="Nothing in this project yet" description="Start in the PLR Editor by importing a product, or use any studio — everything you create is linked here." action={<Button asChild><Link href="/editor?import=1">Import PLR</Link></Button>} />;
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="project-assets">
      {STUDIO_ORDER.filter((s) => byStudio.has(s)).map((s) => (
        <Card key={s} className="grid content-start gap-1 p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {STUDIO_LABELS[s]} ({byStudio.get(s)!.length})
          </p>
          {byStudio
            .get(s)!
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((a) => (
              <div key={a.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-secondary">
                <Link href={assetHref(a)} className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{a.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {assetInfo(a.type).label} · {a.status.replace("-", " ")} · {timeAgo(a.updatedAt)}
                  </span>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-xs" variant="ghost" className="opacity-60 group-hover:opacity-100" aria-label="Item options">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={async () => { await duplicateAsset(a.id); toast.success("Duplicated"); }}>
                      <Copy /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem destructive onSelect={async () => { if (await confirm({ title: `Move “${a.title}” to the Trash?`, confirmLabel: "Move to Trash", destructive: true })) { await trashAsset(a.id); toast.success("Moved to Trash"); } }}>
                      <Trash2 /> Move to Trash
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
        </Card>
      ))}
    </div>
  );
}

function Snapshots({ p }: { p: Project }) {
  const { data: snaps } = useSnapshots(p.id);
  const [label, setLabel] = React.useState("");
  const confirm = useConfirm();
  return (
    <Card className="grid content-start gap-3 p-5" data-testid="project-snapshots">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Camera className="size-4" /> Snapshots
      </p>
      <p className="text-xs text-muted-foreground">A snapshot saves the whole project — every document, design and plan — so you can roll everything back together.</p>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const s = await createProjectSnapshot(p.id, label);
          setLabel("");
          toast.success(`Snapshot “${s.label}” saved`);
        }}
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Before launch" className="h-8 text-sm" data-testid="snapshot-label" />
        <Button size="sm" type="submit" variant="outline" data-testid="snapshot-create">
          Save
        </Button>
      </form>
      <ul className="grid gap-1.5">
        {(snaps ?? [])
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-md border p-2 text-[13px]" data-testid="snapshot-row">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(s.createdAt)} · {s.assetCount} items · {formatBytes(s.size)}
                </p>
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={async () => {
                  if (!(await confirm({ title: `Restore “${s.label}”?`, description: "The project returns to this snapshot. Your current state is saved as a new snapshot first, and items created since are moved to the Trash (not deleted).", confirmLabel: "Restore snapshot" }))) return;
                  try {
                    await restoreProjectSnapshot(s.id);
                    toast.success("Snapshot restored");
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
                data-testid="snapshot-restore"
              >
                Restore
              </Button>
              <Button size="icon-xs" variant="ghost" aria-label="Delete snapshot" onClick={async () => { if (await confirm({ title: "Delete this snapshot?", confirmLabel: "Delete", destructive: true })) await deleteProjectSnapshot(s.id); }}>
                <Trash2 />
              </Button>
            </li>
          ))}
        {!snaps?.length && <li className="text-xs text-muted-foreground">No snapshots yet.</li>}
      </ul>
    </Card>
  );
}

export function ProjectView() {
  const params = useSearchParams();
  const id = params.get("id");
  const router = useRouter();
  const { data: p, loading } = useProject(id);
  const { data: assets } = useAssets(id);
  const { data: exports } = useExportLog(id);
  const [activeId] = useActiveProjectId();
  const a = useProjectActions();
  useBreadcrumb(p?.name ?? null);

  if (loading) return <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</div>;
  if (!p || p.deletedAt) return <PageContainer width="narrow"><EmptyState icon={<FolderKanban />} title="Project not found" description="It may have been deleted or moved to the Trash." action={<Button asChild><Link href="/projects">All projects</Link></Button>} /></PageContainer>;
  const status = workflowStatus(assets ?? [], p, (exports ?? []).some((e) => e.format === "zip"));

  return (
    <PageContainer width="wide">
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Project</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {p.id === activeId ? <Badge>Active project</Badge> : null}
            {p.isSample && <Badge variant="sample">Sample</Badge>}
            {p.status === "archived" && <Badge variant="secondary">Archived</Badge>}
            <Badge variant="outline">{PROJECT_STAGE_LABELS[p.stage]}</Badge>
            <span className="text-xs text-muted-foreground">Created {formatDate(p.createdAt)} · updated {timeAgo(p.updatedAt)}</span>
          </div>
        </div>
        {p.id !== activeId && (
          <Button variant="outline" onClick={() => { setActiveProjectId(p.id); toast.success("Active project changed"); }} data-testid="make-active">
            <Star /> Make active
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={`/export?project=${p.id}`}>
            <Package /> Export package
          </Link>
        </Button>
        <ProjectMenu p={p} onTrashed={() => router.push("/projects")} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          <DetailsForm key={p.id} p={p} />
          <section className="grid gap-3">
            <h2 className="text-base font-semibold">Everything in this project ({assets?.length ?? 0})</h2>
            <AssetGroups assets={assets ?? []} />
          </section>
        </div>
        <div className="grid content-start gap-5">
          <Card className="grid gap-3 p-5" data-testid="project-workflow">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Workflow</p>
              <span className="ml-auto text-xs text-muted-foreground">
                {status.done}/{status.total}
              </span>
            </div>
            <Progress value={(status.done / status.total) * 100} />
            <ol className="grid gap-0.5">
              {status.steps.map((s, i) => (
                <li key={s.id}>
                  <Link href={s.href} onClick={() => setActiveProjectId(p.id)} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-secondary">
                    {s.isDone ? <CheckCircle2 className="size-4 text-[#0ca30c]" aria-label="Done" /> : <Circle className="size-4 text-muted-foreground/50" aria-label="Not done" />}
                    <span className={cn(s.isDone && "text-muted-foreground")}>
                      {i + 1}. {s.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
          <Snapshots p={p} />
          <Card className="grid gap-2 p-5">
            <p className="text-sm font-semibold">Backup</p>
            <p className="text-xs text-muted-foreground">Download this project (with files and history) as a single backup file you can restore later or on another computer.</p>
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => void a.backup(p)} data-testid="project-backup">
              <Download /> Download project backup
            </Button>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
