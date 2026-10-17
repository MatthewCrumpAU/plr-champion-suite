"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FileInput } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { PMDoc } from "@/lib/doc/types";
import { splitIntoChapters } from "@/lib/doc/chapters";
import { useAssets } from "@/lib/data/hooks";
import { createDocument, insertIntoDocument, type InsertMode } from "@/lib/services/documents";
import type { DocumentRole } from "@/lib/models/document";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, NativeSelect } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { cn, errorMessage } from "@/lib/utils";

/** Save generated or drafted content as a new document, or into an existing one. */
export function SaveOutputDialog({
  open,
  onOpenChange,
  project,
  getContent,
  defaultTitle,
  role = "draft",
  format,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: Project;
  getContent: () => PMDoc;
  defaultTitle: string;
  role?: DocumentRole;
  format?: string;
  onSaved?: (documentId: string) => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { data: docs } = useAssets(project.id, "document");
  const [target, setTarget] = React.useState<"new" | "existing">("new");
  const [title, setTitle] = React.useState(defaultTitle);
  const [splitHeadings, setSplitHeadings] = React.useState(true);
  const [docId, setDocId] = React.useState("");
  const [mode, setMode] = React.useState<"end" | "after" | "replace" | "append">("end");
  const [chapterId, setChapterId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setTarget("new");
    }
  }, [open, defaultTitle]);
  React.useEffect(() => {
    if (!docId && docs?.length) setDocId((docs.find((d) => d.id === project.mainDocumentId) ?? docs[0]).id);
  }, [docs, docId, project.mainDocumentId]);
  const doc = docs?.find((d) => d.id === docId);
  React.useEffect(() => {
    if (doc && !doc.data.chapters.some((c) => c.id === chapterId)) setChapterId(doc.data.chapters[0]?.id ?? "");
  }, [doc, chapterId]);

  async function save() {
    const content = getContent();
    setBusy(true);
    try {
      if (target === "new") {
        const chapters = splitHeadings ? splitIntoChapters(content, "auto").chapters : [{ title: title || "Chapter 1", content }];
        const a = await createDocument(project.id, { title: title.trim() || defaultTitle, chapters, role, format });
        toast.success("Saved as a new document", { action: { label: "Open", onClick: () => router.push(`/editor?id=${a.id}`) } });
        onSaved?.(a.id);
      } else {
        if (!doc) throw new Error("Choose a document.");
        let m: InsertMode;
        if (mode === "replace") {
          const ok = await confirm({ title: "Replace this chapter?", description: "The chapter's current content is saved in Version history first.", confirmLabel: "Replace chapter" });
          if (!ok) return;
          m = { kind: "replace-chapter", chapterId };
        } else if (mode === "append") m = { kind: "append-to-chapter", chapterId };
        else m = { kind: "new-chapter", afterChapterId: mode === "after" ? chapterId : null };
        await insertIntoDocument(doc.id, { title: title.trim(), doc: content }, m);
        toast.success(`Saved into “${doc.title}”`, { action: { label: "Open", onClick: () => router.push(`/editor?id=${doc.id}`) } });
        onSaved?.(doc.id);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save to project</DialogTitle>
          <DialogDescription>Keep this content in {project.name}. Nothing in an existing chapter is replaced without a saved version.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["new", "New document", FilePlus2],
              ["existing", "Existing document", FileInput],
            ] as const
          ).map(([v, l, Icon]) => (
            <button key={v} type="button" onClick={() => setTarget(v)} disabled={v === "existing" && !docs?.length} className={cn("flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition disabled:opacity-50", target === v ? "border-primary bg-primary-soft" : "hover:bg-secondary")}>
              <Icon className="size-4 text-primary" /> {l}
            </button>
          ))}
        </div>
        <Field label={target === "new" ? "Document title" : "Chapter title"} htmlFor="so-title">
          <Input id="so-title" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="save-output-title" />
        </Field>
        {target === "new" ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={splitHeadings} onCheckedChange={(v) => setSplitHeadings(!!v)} /> Split into chapters at headings
          </label>
        ) : (
          <div className="grid gap-3">
            <Field label="Document" htmlFor="so-doc">
              <NativeSelect id="so-doc" value={docId} onChange={(e) => setDocId(e.target.value)}>
                {docs?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Where" htmlFor="so-mode">
              <NativeSelect id="so-mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                <option value="end">As a new chapter at the end</option>
                <option value="after">As a new chapter after…</option>
                <option value="append">Add to the end of a chapter…</option>
                <option value="replace">Replace a chapter…</option>
              </NativeSelect>
            </Field>
            {mode !== "end" && doc && (
              <Field label="Chapter" htmlFor="so-ch">
                <NativeSelect id="so-ch" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                  {doc.data.chapters.map((c, i) => (
                    <option key={c.id} value={c.id}>
                      {i + 1}. {c.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={busy} data-testid="save-output-confirm">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
