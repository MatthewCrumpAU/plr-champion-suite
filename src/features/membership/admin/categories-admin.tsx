"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Field, Input, PageContainer, PageHeader, Spinner, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { deleteCategory, reorderCategories, saveCategory } from "@/lib/membership/catalog";
import type { Category } from "@/lib/membership/types";
import { cn, errorMessage, plural } from "@/lib/utils";
import { useCatalog, useMember } from "../member-context";
import { CATEGORY_ICONS, CategoryIcon } from "../ui";
import { AdminGate } from "./admin-gate";

const COLOURS = ["#5b4df5", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#0ea5e9", "#ef4444", "#14b8a6", "#64748b", "#0f8a7a"];

function CategoryDialog({ open, onOpenChange, category }: { open: boolean; onOpenChange: (o: boolean) => void; category: Category | null }) {
  const m = useMember();
  const [form, setForm] = React.useState({ name: "", description: "", icon: "folder", color: COLOURS[0] });
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setForm({ name: category?.name ?? "", description: category?.description ?? "", icon: category?.icon ?? "folder", color: category?.color ?? COLOURS[0] });
  }, [open, category]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Give the category a name.");
    setBusy(true);
    try {
      await saveCategory(m.brandId, { ...(category ?? {}), ...form, id: category?.id, slug: category?.slug });
      toast.success(category ? "Category updated" : `Category “${form.name.trim()}” created`);
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
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>Categories group the library into niches members can browse.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4" id="category-form">
          <Field label="Name" htmlFor="cat-name">
            <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Description" htmlFor="cat-desc" optional>
            <Textarea id="cat-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Icon">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
              {Object.keys(CATEGORY_ICONS).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={form.icon === k} aria-label={k} onClick={() => setForm({ ...form, icon: k })} className={cn("flex size-8 items-center justify-center rounded-lg border transition", form.icon === k ? "border-primary bg-primary-soft text-primary" : "hover:bg-secondary")}>
                  <CategoryIcon icon={k} className="size-4" />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Colour">
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Colour">
              {COLOURS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={form.color === c} aria-label={c} onClick={() => setForm({ ...form, color: c })} className={cn("size-7 rounded-full ring-offset-2 transition", form.color === c && "ring-2 ring-foreground")} style={{ background: c }} />
              ))}
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border" aria-label="Custom colour" />
            </div>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={busy} data-testid="save-category">
            {category ? "Save changes" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriesAdmin() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  );
}

function Inner() {
  const m = useMember();
  const confirm = useConfirm();
  const { data, loading } = useCatalog();
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [open, setOpen] = React.useState(false);
  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const cats = data.categories;
  const move = async (i: number, dir: -1 | 1) => {
    const ids = cats.map((c) => c.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderCategories(m.brandId, ids);
  };
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Membership Admin"
        title="Categories"
        description="Organise the library into niches. The order here is the order members see."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            data-testid="new-category"
          >
            <Plus /> New category
          </Button>
        }
      />
      {cats.length === 0 ? (
        <EmptyState icon={<Shapes />} title="No categories yet" action={<Button onClick={() => setOpen(true)}>New category</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y" data-testid="admin-categories">
            {cats.map((c, i) => {
              const count = data.products.filter((p) => p.categoryIds.includes(c.id)).length;
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: c.color }}>
                    <CategoryIcon icon={c.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {plural(count, "product")}
                      {c.description ? ` · ${c.description}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.name} up`}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-xs" disabled={i === cats.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.name} down`}>
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setEditing(c);
                      setOpen(true);
                    }}
                  >
                    <Pencil /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${c.name}`}
                    onClick={async () => {
                      if (!(await confirm({ title: `Delete “${c.name}”?`, description: count ? `${plural(count, "product")} will be left without this category. The products themselves aren't deleted.` : "This category has no products.", confirmLabel: "Delete category", destructive: true }))) return;
                      await deleteCategory(c.id);
                      toast.success("Category deleted");
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <CategoryDialog open={open} onOpenChange={setOpen} category={editing} />
    </PageContainer>
  );
}
