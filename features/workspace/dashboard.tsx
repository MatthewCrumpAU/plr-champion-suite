"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Clock, FileUp, FolderPlus, HardDrive, Sparkles } from "lucide-react";
import type { Asset } from "@/lib/data/types";
import { PROJECT_STAGE_LABELS } from "@/lib/data/types";
import { useActiveProject, useAllAssets, useAssets, useExportLog, useProjects, setActiveProjectId } from "@/lib/data/hooks";
import { assetHref, assetInfo } from "@/lib/data/asset-types";
import { useAIStatus } from "@/lib/ai/client";
import { storageReport, type StorageReport } from "@/lib/services/storage";
import { workflowStatus } from "@/lib/workflow";
import { NAV } from "@/components/shell/nav";
import { NewProjectDialog } from "@/components/common/project-gate";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageContainer, Progress, Spinner } from "@/components/ui/primitives";
import { cn, formatBytes, timeAgo } from "@/lib/utils";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function ActiveProjectPanel() {
  const { project } = useActiveProject();
  const { data: assets } = useAssets(project?.id ?? null);
  const { data: exports } = useExportLog(project?.id ?? null);
  if (!project) {
    return (
      <Card className="grid gap-3 p-6">
        <p className="text-lg font-semibold">No project selected</p>
        <p className="text-sm text-muted-foreground">Projects keep everything for one product together — the PLR document, covers, bonuses, sales copy, funnel and numbers.</p>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/projects?new=1">
              <FolderPlus /> New project
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/projects">Open a project</Link>
          </Button>
        </div>
      </Card>
    );
  }
  const status = workflowStatus(assets ?? [], project, (exports ?? []).some((e) => e.format === "zip"));
  return (
    <Card className="grid grid-cols-[minmax(0,1fr)] gap-4 p-5" data-testid="dashboard-project">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Active project</p>
          <Link href={`/projects/view?id=${project.id}`} className="mt-0.5 block truncate text-xl font-semibold hover:text-primary">
            {project.name}
          </Link>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{[project.niche, PROJECT_STAGE_LABELS[project.stage]].filter(Boolean).join(" · ")}</p>
        </div>
        {project.isSample && <Badge variant="sample">Sample</Badge>}
        <Button size="sm" variant="outline" asChild>
          <Link href={`/projects/view?id=${project.id}`}>Project overview</Link>
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <Progress value={(status.done / status.total) * 100} className="flex-1" />
        <span className="text-sm font-medium tabular-nums">
          {status.done}/{status.total} steps
        </span>
      </div>
      {status.next && (
        <Link href={status.next.href} className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft/60 p-3 hover:bg-primary-soft" data-testid="dashboard-next">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ArrowRight className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-primary">Next step</span>
            <span className="block truncate font-semibold">{status.next.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{status.next.hint}</span>
          </span>
        </Link>
      )}
      <ol className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3" data-testid="workflow-steps">
        {status.steps.map((s, i) => (
          <li key={s.id}>
            <Link href={s.href} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-secondary">
              {s.isDone ? <CheckCircle2 className="size-4 shrink-0 text-[#0ca30c]" aria-label="Done" /> : <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-label="Not done" />}
              <span className={cn("truncate", s.isDone && "text-muted-foreground")}>
                {i + 1}. {s.label}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function RecentWork() {
  const { data: assets } = useAllAssets();
  const { data: projects } = useProjects();
  const names = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const recent = (assets ?? []).filter((a) => !a.deletedAt && names.has(a.projectId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  return (
    <Card className="grid content-start gap-2 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Clock className="size-4 text-muted-foreground" /> Recently edited
      </p>
      {recent.length ? (
        <ul className="grid gap-0.5" data-testid="recent-work">
          {recent.map((a: Asset) => (
            <li key={a.id}>
              <Link href={assetHref(a)} onClick={() => setActiveProjectId(a.projectId)} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{a.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {assetInfo(a.type).label} · {names.get(a.projectId)}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(a.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing yet — import a PLR product to get started.</p>
      )}
    </Card>
  );
}

function WorkspaceStats() {
  const { data: projects } = useProjects({ includeArchived: true });
  const { data: assets } = useAllAssets();
  const { data: exports } = useExportLog(null);
  const { status } = useAIStatus();
  const [storage, setStorage] = React.useState<StorageReport | null>(null);
  React.useEffect(() => {
    storageReport().then(setStorage).catch(() => undefined);
  }, []);
  const items = [
    ["Projects", String(projects?.length ?? "—")],
    ["Assets", String(assets?.filter((a) => !a.deletedAt).length ?? "—")],
    ["Exports", String(exports?.length ?? "—")],
    ["Browser storage", storage?.usage != null ? formatBytes(storage.usage) : "—"],
  ];
  return (
    <Card className="grid content-start gap-3 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <HardDrive className="size-4 text-muted-foreground" /> Workspace
      </p>
      <div className="grid grid-cols-2 gap-2" data-testid="workspace-stats">
        {items.map(([l, v]) => (
          <div key={l} className="rounded-lg bg-secondary/60 p-2.5">
            <p className="text-[11px] text-muted-foreground">{l}</p>
            <p className="text-base font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Sparkles className="size-3.5" />
        {status === null ? "Checking AI…" : status.testMode ? "AI test mode (not real AI)" : status.configured ? `AI ready · ${status.defaultModel}` : "AI is off — templates and manual tools still work"}
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">Your work is stored privately in this browser. Download a backup from the Export Centre regularly.</p>
    </Card>
  );
}

function RecentProjects() {
  const { data: projects, loading } = useProjects();
  const { data: assets } = useAllAssets();
  const counts = new Map<string, number>();
  for (const a of assets ?? []) if (!a.deletedAt) counts.set(a.projectId, (counts.get(a.projectId) ?? 0) + 1);
  const list = [...(projects ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex items-center">
        <h2 className="text-base font-semibold">Projects</h2>
        <Link href="/projects" className="ml-auto text-sm font-medium text-primary">
          View all
        </Link>
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <Link key={p.id} href={`/projects/view?id=${p.id}`} onClick={() => setActiveProjectId(p.id)} className="rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
              <p className="flex items-center gap-2 truncate font-semibold">
                <span className="truncate">{p.name}</span>
                {p.isSample && <Badge variant="sample">Sample</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {PROJECT_STAGE_LABELS[p.stage]} · {counts.get(p.id) ?? 0} assets · updated {timeAgo(p.updatedAt)}
              </p>
            </Link>
          ))}
          <Link href="/projects?new=1" className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary">
            <FolderPlus className="size-4" /> New project
          </Link>
        </div>
      )}
    </section>
  );
}

function StudioLauncher() {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <h2 className="text-base font-semibold">Studios</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="studios">
        {NAV.filter((s) => s.title && s.id !== "workspace").map((s) => (
          <Card key={s.id} className="grid content-start gap-1 p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.title}</p>
            {s.items.map((i) => (
              <Link key={i.href} href={i.href} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-secondary">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4">
                  <i.icon />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium group-hover:text-primary">{i.label}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{i.description}</span>
                </span>
              </Link>
            ))}
          </Card>
        ))}
      </div>
    </section>
  );
}

export function Dashboard() {
  const [newOpen, setNewOpen] = React.useState(false);
  return (
    <PageContainer width="wide">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">PLR Champion Software Suite</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{greeting()}</h1>
          <p className="text-sm text-muted-foreground">Turn PLR into finished, branded products — and everything you need to sell them.</p>
        </div>
        <Button variant="outline" onClick={() => setNewOpen(true)}>
          <FolderPlus /> New project
        </Button>
        <Button asChild>
          <Link href="/editor?import=1">
            <FileUp /> Import PLR
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ActiveProjectPanel />
        <div className="grid content-start gap-5">
          <WorkspaceStats />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <RecentProjects />
        <RecentWork />
      </div>
      <div className="mt-8">
        <StudioLauncher />
      </div>
      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} />
    </PageContainer>
  );
}
