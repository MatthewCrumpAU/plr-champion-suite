"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Package, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Field, Input, NativeSelect, PageContainer, PageHeader, Spinner, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { FileDrop } from "@/components/common/file-drop";
import { deleteResource, newResource, safeUrl, saveResource } from "@/lib/membership/catalog";
import { deleteMemberFiles, MAX_PRODUCT_FILE_BYTES, storeMemberFile } from "@/lib/membership/files";
import { ACCESS_TIERS, ACCESS_TIER_LABELS, PUBLISH_STATUS_LABELS, RESOURCE_TYPE_LABELS, type AccessTier, type PublishStatus, type Resource, type ResourceType } from "@/lib/membership/types";
import { errorMessage, formatBytes } from "@/lib/utils";
import { useCatalog, useMember } from "../member-context";
import { AccessBadge } from "../ui";
import { AdminGate } from "./admin-gate";

function ResourceDialog({ open, onOpenChange, resource, nextOrder }: { open: boolean; onOpenChange: (o: boolean) => void; resource: Resource | null; nextOrder: number }) {
  const m = useMember();
  const [form, setForm] = React.useState<Resource>(() => newResource(m.brandId));
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setForm(resource ?? newResource(m.brandId, { order: nextOrder, status: "published" }));
      setPendingFile(null);
    }
  }, [open, resource, m.brandId, nextOrder]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Give the resource a title.");
    if (form.url.trim() && !safeUrl(form.url)) return toast.error("Links must start with https:// (or / for a page in this app).");
    if (!form.url.trim() && !form.fileId && !pendingFile) return toast.error("Attach a file or add a link.");
    setBusy(true);
    try {
      let next = form;
      if (pendingFile) {
        const f = await storeMemberFile(pendingFile, pendingFile.name, m.brandId);
        if (form.fileId) await deleteMemberFiles([form.fileId]);
        next = { ...next, fileId: f.id, fileName: pendingFile.name, fileSize: f.size };
      }
      await saveResource(next);
      toast.success(resource ? "Resource updated" : "Resource added");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{resource ? "Edit resource" : "New resource"}</DialogTitle>
          <DialogDescription>Templates, checklists, swipes, guides or links for members.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} id="resource-form" className="grid grid-cols-1 gap-4">
          <Field label="Title" htmlFor="rs-title">
            <Input id="rs-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </Field>
          <Field label="Description" htmlFor="rs-desc" optional>
            <Textarea id="rs-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Type" htmlFor="rs-type">
              <NativeSelect id="rs-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ResourceType })}>
                {Object.entries(RESOURCE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Access" htmlFor="rs-access">
              <NativeSelect id="rs-access" value={form.access} onChange={(e) => setForm({ ...form, access: e.target.value as AccessTier })}>
                {ACCESS_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {ACCESS_TIER_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Status" htmlFor="rs-status">
              <NativeSelect id="rs-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PublishStatus })}>
                {(["draft", "published", "archived"] as PublishStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {PUBLISH_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="File" optional>
            {(form.fileName || pendingFile) && (
              <p className="flex items-center gap-2 text-sm">
                <Paperclip className="size-3.5" /> {pendingFile?.name ?? form.fileName} <span className="text-xs text-muted-foreground">{formatBytes(pendingFile?.size ?? form.fileSize)}</span>
              </p>
            )}
            <FileDrop
              accept="*/*"
              compact
              title={form.fileId || pendingFile ? "Replace file" : "Attach a file"}
              onFiles={([f]) => {
                if (f.size > MAX_PRODUCT_FILE_BYTES) return toast.error("That file is too large.");
                setPendingFile(f);
              }}
              testId="rs-file"
            />
          </Field>
          <Field label="Link" htmlFor="rs-url" hint="An https:// link, or a page in this app such as /profit." optional>
            <Input id="rs-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="resource-form" loading={busy} data-testid="save-resource">
            {resource ? "Save changes" : "Add resource"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResourcesAdmin() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  );
}

function Inner() {
  const confirm = useConfirm();
  const { data, loading } = useCatalog();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Resource | null>(null);
  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const list = data.resources;
  const move = async (i: number, d: -1 | 1) => {
    const next = [...list];
    if (!next[i + d]) return;
    [next[i], next[i + d]] = [next[i + d], next[i]];
    for (const [idx, r] of next.entries()) if (r.order !== idx) await saveResource({ ...r, order: idx });
  };
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Membership Admin"
        title="Member Resources"
        description="Files and links shown on the Member Resources page."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            data-testid="new-resource"
          >
            <Plus /> New resource
          </Button>
        }
      />
      {list.length === 0 ? (
        <EmptyState icon={<Package />} title="No resources yet" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y" data-testid="admin-resources">
            {list.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{r.title}</p>
                    <Badge variant="outline">{RESOURCE_TYPE_LABELS[r.type]}</Badge>
                    <AccessBadge tier={r.access} />
                    {r.status !== "published" && <Badge variant="secondary">{PUBLISH_STATUS_LABELS[r.status]}</Badge>}
                    {r.isSample && <Badge variant="sample">Sample</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{[r.fileName, r.url].filter(Boolean).join(" · ") || "No file or link"}</p>
                </div>
                <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${r.title} up`}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-xs" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${r.title} down`}>
                  <ArrowDown />
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setEditing(r);
                    setOpen(true);
                  }}
                >
                  <Pencil /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${r.title}`}
                  onClick={async () => {
                    if (!(await confirm({ title: `Delete “${r.title}”?`, confirmLabel: "Delete resource", destructive: true }))) return;
                    await deleteResource(r.id);
                    toast.success("Resource deleted");
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <ResourceDialog open={open} onOpenChange={setOpen} resource={editing} nextOrder={list.length} />
    </PageContainer>
  );
}
