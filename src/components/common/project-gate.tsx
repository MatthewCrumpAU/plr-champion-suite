"use client";

import * as React from "react";
import { FolderOpen, FolderPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import { useActiveProject, useBrandKits, useProjects } from "@/lib/data/hooks";
import { createProject } from "@/lib/services/projects";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, NativeSelect, PageContainer, PageHeader, Spinner, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { errorMessage, timeAgo } from "@/lib/utils";

export const PRODUCT_TYPES = [
  ["ebook", "Ebook"],
  ["report", "Report"],
  ["guide", "Guide"],
  ["workbook", "Workbook"],
  ["course", "Course"],
  ["mini-course", "Mini-course"],
  ["email-course", "Email course"],
  ["membership", "Membership content"],
  ["bundle", "Bundle"],
  ["other", "Other"],
] as const;

export function NewProjectDialog({ open, onOpenChange, onCreated, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (p: Project) => void; defaults?: Partial<Project> }) {
  const { data: kits } = useBrandKits();
  const [form, setForm] = React.useState({ name: "", niche: "", audience: "", productType: "ebook", description: "", brandKitId: "" });
  const [busy, setBusy] = React.useState(false);
  const { setActive } = useActiveProject();

  React.useEffect(() => {
    if (open) setForm({ name: defaults?.name ?? "", niche: defaults?.niche ?? "", audience: defaults?.audience ?? "", productType: defaults?.productType ?? "ebook", description: defaults?.description ?? "", brandKitId: defaults?.brandKitId ?? "" });
  }, [open, defaults]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Give the project a name.");
    setBusy(true);
    try {
      const p = await createProject({ ...form, brandKitId: form.brandKitId || null, stage: "idea" });
      setActive(p.id);
      toast.success(`Project “${p.name}” created`);
      onOpenChange(false);
      onCreated?.(p);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>A project holds one PLR product and everything you make from it: edits, covers, bonuses, marketing, funnels and launch plans.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" id="new-project-form">
          <Field label="Project name" htmlFor="np-name">
            <Input id="np-name" value={form.name} onChange={set("name")} placeholder="e.g. Productivity ebook rebrand" autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Niche" htmlFor="np-niche" optional>
              <Input id="np-niche" value={form.niche} onChange={set("niche")} placeholder="e.g. Remote work productivity" />
            </Field>
            <Field label="Product type" htmlFor="np-type">
              <NativeSelect id="np-type" value={form.productType} onChange={set("productType")}>
                {PRODUCT_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Target audience" htmlFor="np-aud" optional>
            <Input id="np-aud" value={form.audience} onChange={set("audience")} placeholder="Who is this product for?" />
          </Field>
          <Field label="Brand kit" htmlFor="np-kit" optional hint="Brand kits supply colours, fonts, author name and voice to every tool.">
            <NativeSelect id="np-kit" value={form.brandKitId} onChange={set("brandKitId")}>
              <option value="">No brand kit</option>
              {kits?.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Description" htmlFor="np-desc" optional>
            <Textarea id="np-desc" value={form.description} onChange={set("description")} rows={3} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-project-form" loading={busy}>
            <FolderPlus /> Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Shows a project picker when no project is active; otherwise renders the tool for the active project. */
export function ProjectGate({ tool, description, children }: { tool: string; description?: string; children: (project: Project) => React.ReactNode }) {
  const { project, loading, setActive } = useActiveProject();
  const { data: projects, loading: listLoading } = useProjects();
  const [creating, setCreating] = React.useState(false);

  if (loading || (listLoading && !project)) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  if (project) return <>{children(project)}</>;

  return (
    <PageContainer width="narrow">
      <PageHeader eyebrow={tool} title="Choose a project" description={description ?? `${tool} works inside a project so everything you create stays linked together.`} />
      <Card className="divide-y">
        {projects?.length ? (
          projects.map((p) => (
            <button key={p.id} type="button" onClick={() => setActive(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-secondary/60">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <FolderOpen className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 truncate text-sm font-medium">
                  {p.name} {p.isSample && <Badge variant="sample">Sample</Badge>}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {p.niche || "No niche set"} · updated {timeAgo(p.updatedAt)}
                </span>
              </span>
            </button>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">You don&apos;t have any projects yet.</p>
        )}
      </Card>
      <Button className="mt-4" onClick={() => setCreating(true)}>
        <Plus /> New project
      </Button>
      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </PageContainer>
  );
}
