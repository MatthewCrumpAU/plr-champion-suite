"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Archive, DatabaseBackup, Download, FileDown, History, Package, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Asset, AssetType, Project } from "@/lib/data/types";
import { useActiveProjectId, useAssets, useBrandKit, useExportLog, useProjects } from "@/lib/data/hooks";
import { ASSET_TYPES, assetInfo } from "@/lib/data/asset-types";
import { DEFAULT_PACKAGE_FORMAT, EXPORTERS, buildProjectZip, type ExportContext } from "@/lib/export/registry";
import { downloadBlob, downloadFile } from "@/lib/export/download";
import { logExport } from "@/lib/services/export-log";
import { backupFileName, backupToBlob, createWorkspaceBackup, parseBackupFile, restoreBackup, type ParsedBackup, type RestoreMode } from "@/lib/services/backup";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, Checkbox, EmptyState, NativeSelect, PageContainer, PageHeader, Progress, Switch } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { cn, errorMessage, formatBytes, formatDateTime } from "@/lib/utils";

const ORDER: AssetType[] = ["document", "outline", "cover", "mockup", "sales-page", "email-campaign", "social-campaign", "name-ideas", "opportunity-scan", "niche-research", "keyword-set", "rights-review", "funnel", "profit-scenario", "launch-plan"];

function PackageBuilder({ project }: { project: Project }) {
  const { data: assets } = useAssets(project.id);
  const { data: kit } = useBrandKit(project.brandKitId);
  const exportable = React.useMemo(() => (assets ?? []).filter((a) => EXPORTERS[a.type].length).sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || a.title.localeCompare(b.title)), [assets]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [formats, setFormats] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<{ done: number; total: number; label: string } | null>(null);
  const [single, setSingle] = React.useState<string | null>(null);
  const initFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!assets || initFor.current === project.id) return;
    initFor.current = project.id;
    setSelected(new Set(exportable.map((a) => a.id)));
  }, [assets, exportable, project.id]);

  const ctx: ExportContext = { project, assets: assets ?? [], kit: kit ?? null };
  const fmt = (a: Asset) => formats[a.id] ?? DEFAULT_PACKAGE_FORMAT[a.type] ?? EXPORTERS[a.type][0]?.id;

  const zip = async () => {
    const items = exportable.filter((a) => selected.has(a.id)).map((a) => ({ asset: a, format: fmt(a)! }));
    if (!items.length) return toast.error("Select at least one item.");
    setBusy({ done: 0, total: items.length, label: "Starting…" });
    try {
      const r = await buildProjectZip(items, ctx, (done, total, label) => setBusy({ done, total, label }));
      downloadBlob(r.blob, r.fileName);
      await logExport({ projectId: project.id, assetId: null, label: `${project.name} package`, format: "zip", fileName: r.fileName, size: r.blob.size });
      if (r.failed.length) toast.warning(`Package downloaded with ${r.count} files. ${r.failed.length} could not be exported: ${r.failed.map((f) => f.title).join(", ")}`);
      else toast.success(`Package downloaded — ${r.count} files`);
    } catch (e) {
      toast.error(`Package failed: ${errorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const one = async (a: Asset) => {
    const opt = EXPORTERS[a.type].find((o) => o.id === fmt(a)) ?? EXPORTERS[a.type][0];
    setSingle(a.id);
    try {
      const f = await opt.run(a, ctx);
      downloadFile(f);
      await logExport({ projectId: project.id, assetId: a.id, label: a.title, format: opt.id, fileName: f.fileName, size: f.blob.size });
      toast.success(`Exported ${f.fileName}`);
    } catch (e) {
      toast.error(`Export failed: ${errorMessage(e)}`);
    } finally {
      setSingle(null);
    }
  };

  if (!assets) return null;
  if (!exportable.length) return <EmptyState icon={<Package />} title="Nothing to export yet" description="Create documents, covers, sales pages or plans in this project and they'll appear here." />;
  const allOn = exportable.every((a) => selected.has(a.id));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={allOn} onCheckedChange={(v) => setSelected(v ? new Set(exportable.map((a) => a.id)) : new Set())} aria-label="Select all" /> Select all ({exportable.length})
        </label>
        <Button className="ml-auto" onClick={() => void zip()} loading={!!busy} disabled={!selected.size} data-testid="export-zip">
          {!busy && <Archive />} Download ZIP package ({selected.size})
        </Button>
      </div>
      {busy && (
        <div className="grid gap-1 rounded-lg bg-secondary/60 p-3 text-sm">
          <Progress value={(busy.done / Math.max(1, busy.total)) * 100} />
          <span className="text-xs text-muted-foreground">
            {busy.done}/{busy.total} · {busy.label}
          </span>
        </div>
      )}
      <Card className="divide-y p-0" data-testid="package-items">
        {exportable.map((a) => (
          <div key={a.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2", !selected.has(a.id) && "opacity-60")} data-testid="package-item">
            <Checkbox checked={selected.has(a.id)} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(a.id); else n.delete(a.id); return n; })} aria-label={`Include ${a.title}`} />
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate text-[13.5px] font-medium">{a.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {assetInfo(a.type).label} · {ASSET_TYPES[a.type].studio} studio
              </p>
            </div>
            <NativeSelect value={fmt(a)} onChange={(e) => setFormats((f) => ({ ...f, [a.id]: e.target.value }))} className="h-8 w-44 text-xs" aria-label={`Format for ${a.title}`}>
              {EXPORTERS[a.type].map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
            <Button size="sm" variant="ghost" onClick={() => void one(a)} loading={single === a.id} aria-label={`Download ${a.title}`}>
              {single !== a.id && <FileDown />} Download
            </Button>
          </div>
        ))}
      </Card>
      <p className="text-[11px] text-muted-foreground">The ZIP is organised into folders (products, design, marketing, research, licence, planning) and includes a README. Anything that can&apos;t be exported is listed in the README instead of being silently skipped.</p>
    </div>
  );
}

function Backups() {
  const [includeFiles, setIncludeFiles] = React.useState(true);
  const [includeVersions, setIncludeVersions] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [parsed, setParsed] = React.useState<ParsedBackup | null>(null);
  const [mode, setMode] = React.useState<RestoreMode>("merge");
  const [restoring, setRestoring] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  return (
    <Card className="grid content-start gap-4 p-5" id="backup" data-testid="backups">
      <div className="flex items-center gap-2">
        <DatabaseBackup className="size-5 text-primary" />
        <p className="font-semibold">Backup &amp; restore</p>
      </div>
      <p className="text-sm text-muted-foreground">Your work lives in this browser only. Download a full backup regularly and keep it somewhere safe — it&apos;s also how you move your workspace to another computer.</p>
      <div className="grid gap-2 text-sm">
        <label className="flex items-center justify-between">
          Include images and imported files
          <Switch checked={includeFiles} onCheckedChange={setIncludeFiles} />
        </label>
        <label className="flex items-center justify-between">
          Include version history
          <Switch checked={includeVersions} onCheckedChange={setIncludeVersions} />
        </label>
      </div>
      <Button
        onClick={async () => {
          setBusy(true);
          try {
            const b = await createWorkspaceBackup({ includeFiles, includeVersions });
            const blob = backupToBlob(b);
            downloadBlob(blob, backupFileName("workspace"));
            await logExport({ projectId: null, assetId: null, label: "Workspace backup", format: "backup", fileName: backupFileName("workspace"), size: blob.size });
            toast.success(`Backup downloaded (${formatBytes(blob.size)})`);
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
        loading={busy}
        data-testid="workspace-backup"
      >
        {!busy && <Download />} Download full backup
      </Button>
      <div className="border-t pt-4">
        <p className="mb-1 text-sm font-medium">Restore from a backup</p>
        <p className="mb-3 text-xs text-muted-foreground">Accepts workspace or project backup files from PLR Champion. You&apos;ll see what&apos;s inside before anything changes.</p>
        <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="restore-backup">
          <Upload /> Choose backup file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-testid="restore-input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              setParsed(await parseBackupFile(f));
              setMode("merge");
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }}
        />
      </div>
      <Dialog open={!!parsed} onOpenChange={(o) => !o && setParsed(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Restore backup</DialogTitle>
            <DialogDescription>
              {parsed?.summary.scope === "project" ? "Project" : "Workspace"} backup from {parsed ? formatDateTime(parsed.summary.exportedAt) : ""}
            </DialogDescription>
          </DialogHeader>
          {parsed && (
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary/60 p-3 sm:grid-cols-4">
                {[
                  ["Projects", parsed.summary.projects],
                  ["Items", parsed.summary.assets],
                  ["Versions", parsed.summary.versions],
                  ["Files", parsed.summary.files],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <p className="text-[11px] text-muted-foreground">{l}</p>
                    <p className="font-semibold tabular-nums">{v}</p>
                  </div>
                ))}
              </div>
              {parsed.summary.projectNames.length > 0 && <p className="text-xs text-muted-foreground">Projects: {parsed.summary.projectNames.slice(0, 8).join(", ")}{parsed.summary.projectNames.length > 8 ? "…" : ""}</p>}
              <div className="grid gap-2" data-testid="restore-modes">
                {(
                  [
                    ["merge", "Merge", "Add the backup's items. Items with the same ID are replaced by the backup's version; everything else stays."],
                    ["copy", "Import as copies", "Bring everything in as new copies. Nothing you have now changes."],
                    ["replace", "Replace everything", "Erase all data in this browser, then restore the backup exactly."],
                  ] as [RestoreMode, string, string][]
                ).map(([v, l, d]) => (
                  <label key={v} className={cn("flex cursor-pointer gap-2 rounded-lg border p-2.5", mode === v ? "border-primary bg-primary-soft/50" : "hover:border-primary/40", v === "replace" && mode === v && "border-red-300 bg-red-50")}>
                    <input type="radio" name="restore-mode" checked={mode === v} onChange={() => setMode(v)} className="mt-1" />
                    <span>
                      <span className="block font-medium">{l}</span>
                      <span className="block text-xs text-muted-foreground">{d}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setParsed(null)}>
              Cancel
            </Button>
            <Button
              variant={mode === "replace" ? "destructive" : "default"}
              loading={restoring}
              onClick={async () => {
                if (!parsed) return;
                if (mode === "replace" && !(await confirm({ title: "Erase this browser's data and restore?", description: "Everything currently stored here is deleted before the backup is restored. Download a backup of your current data first if you might need it.", confirmLabel: "Erase and restore", destructive: true, typeToConfirm: "REPLACE" }))) return;
                setRestoring(true);
                try {
                  const r = await restoreBackup(parsed.backup, mode);
                  toast.success(`Restored ${r.projects} project${r.projects === 1 ? "" : "s"} and ${r.assets} item${r.assets === 1 ? "" : "s"}`);
                  setParsed(null);
                } catch (e) {
                  toast.error(`Restore failed: ${errorMessage(e)}`);
                } finally {
                  setRestoring(false);
                }
              }}
              data-testid="restore-confirm"
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function HistoryTable({ projects }: { projects: Project[] }) {
  const { data: log } = useExportLog(null);
  const [filter, setFilter] = React.useState("");
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const rows = (log ?? []).filter((e) => !filter || e.projectId === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2">
        <History className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Export history</h2>
        <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} className="ml-auto h-8 w-56 text-xs" aria-label="Filter by project">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {rows.length ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-[13px]" data-testid="export-history">
            <thead className="bg-secondary text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {["When", "Project", "Item", "Format", "File", "Size"].map((h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-1.5">{formatDateTime(e.createdAt)}</td>
                  <td className="max-w-48 truncate px-3">{e.projectId ? (names.get(e.projectId) ?? "Deleted project") : "Workspace"}</td>
                  <td className="max-w-56 truncate px-3">{e.label}</td>
                  <td className="px-3">
                    <Badge variant="secondary" className="uppercase">
                      {e.format}
                    </Badge>
                  </td>
                  <td className="max-w-64 truncate px-3 text-muted-foreground">{e.fileName}</td>
                  <td className="whitespace-nowrap px-3 tabular-nums">{formatBytes(e.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing exported yet.</p>
      )}
    </section>
  );
}

export function ExportCentre() {
  const params = useSearchParams();
  const [activeId] = useActiveProjectId();
  const { data: projects } = useProjects({ includeArchived: true });
  const [projectId, setProjectId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (projectId || !projects?.length) return;
    const want = params.get("project") ?? activeId;
    setProjectId(projects.find((p) => p.id === want)?.id ?? projects[0].id);
  }, [projects, params, activeId, projectId]);
  const project = projects?.find((p) => p.id === projectId) ?? null;

  return (
    <PageContainer width="wide">
      <PageHeader eyebrow="Workspace" title="Export Centre" description="Download any project asset in the format you need, build a complete marketing package as a ZIP, back up your whole workspace and see everything you've exported." />
      <Callout tone="info" className="mb-5">
        Before selling, check your licence review for each product. Projections and price ideas included in planning files are hypothetical estimates, not forecasts or guaranteed earnings.
      </Callout>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Package className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Project package</h2>
            <NativeSelect value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-full sm:ml-auto sm:w-72" aria-label="Project" data-testid="export-project">
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === "archived" ? " (archived)" : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
          {project ? <PackageBuilder key={project.id} project={project} /> : <EmptyState icon={<Package />} title="No projects yet" description="Create a project to start exporting." />}
        </section>
        <Backups />
      </div>
      <div className="mt-8">
        <HistoryTable projects={projects ?? []} />
      </div>
    </PageContainer>
  );
}
