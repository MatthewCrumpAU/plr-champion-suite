"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileDown, Settings2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Label, NativeSelect } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { DEFAULT_DOC_EXPORT, DOC_EXPORT_LABELS, exportDocument, type DocExportFormat, type DocExportOptions, type ExportableDocument } from "@/lib/export/document";
import { downloadFile } from "@/lib/export/download";
import { logExport } from "@/lib/services/export-log";
import { useAssets } from "@/lib/data/hooks";
import { errorMessage } from "@/lib/utils";

const OPTS_KEY = "plrc.docExportOptions";

export function loadDocExportOptions(): DocExportOptions {
  try {
    const raw = window.localStorage.getItem(OPTS_KEY);
    if (raw) return { ...DEFAULT_DOC_EXPORT, ...(JSON.parse(raw) as Partial<DocExportOptions>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_DOC_EXPORT;
}

function saveDocExportOptions(o: DocExportOptions) {
  try {
    window.localStorage.setItem(OPTS_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

/** True when the project has at least one rights review marked as reviewed. */
export function useLicenceReviewed(projectId: string | null | undefined): boolean | null {
  const { data, loading } = useAssets(projectId, "rights-review");
  if (loading) return null;
  return !!data?.some((a) => !!a.data.reviewedAt);
}

export function ExportOptionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [o, setO] = React.useState<DocExportOptions>(DEFAULT_DOC_EXPORT);
  React.useEffect(() => {
    if (open) setO(loadDocExportOptions());
  }, [open]);
  const toggle = (k: "titlePage" | "toc" | "pageBreaks") => setO((x) => ({ ...x, [k]: !x[k] }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Document export options</DialogTitle>
          <DialogDescription>Used for Word, PDF, HTML, Markdown and text exports.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {(
            [
              ["titlePage", "Title page (title, subtitle and author)"],
              ["toc", "Table of contents"],
              ["pageBreaks", "Start each chapter on a new page (Word/PDF)"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={o[k]} onCheckedChange={() => toggle(k)} /> {l}
            </label>
          ))}
          <div className="grid gap-1.5">
            <Label htmlFor="pagesize">Page size</Label>
            <NativeSelect id="pagesize" value={o.pageSize} onChange={(e) => setO((x) => ({ ...x, pageSize: e.target.value as DocExportOptions["pageSize"] }))}>
              <option value="A4">A4</option>
              <option value="LETTER">US Letter</option>
            </NativeSelect>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              saveDocExportOptions(o);
              onOpenChange(false);
              toast.success("Export options saved");
            }}
          >
            Save options
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function runDocumentExport(doc: ExportableDocument, format: DocExportFormat, meta: { projectId: string | null; assetId: string | null; label: string }) {
  const file = await exportDocument(doc, format, loadDocExportOptions());
  downloadFile(file);
  await logExport({ projectId: meta.projectId, assetId: meta.assetId, label: meta.label, format, fileName: file.fileName, size: file.blob.size });
  return file;
}

export function DocumentExportMenu({
  getDocument,
  projectId,
  assetId,
  size = "sm",
  label = "Export",
}: {
  getDocument: () => Promise<ExportableDocument> | ExportableDocument;
  projectId: string | null;
  assetId: string | null;
  size?: "sm" | "xs";
  label?: string;
}) {
  const [busy, setBusy] = React.useState<DocExportFormat | null>(null);
  const [optsOpen, setOptsOpen] = React.useState(false);
  const reviewed = useLicenceReviewed(projectId);

  async function run(format: DocExportFormat) {
    setBusy(format);
    try {
      const doc = await getDocument();
      const file = await runDocumentExport(doc, format, { projectId, assetId, label: doc.title });
      toast.success(`Exported ${file.fileName}`);
    } catch (err) {
      toast.error(`Export failed: ${errorMessage(err)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} variant="outline" loading={!!busy} data-testid="export-menu">
            {!busy && <Download />} {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Download as</DropdownMenuLabel>
          {(Object.keys(DOC_EXPORT_LABELS) as DocExportFormat[]).map((f) => (
            <DropdownMenuItem key={f} onSelect={() => void run(f)} data-testid={`export-${f}`}>
              <FileDown /> {DOC_EXPORT_LABELS[f]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOptsOpen(true)}>
            <Settings2 /> Export options…
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/export">More options in Export Centre</Link>
          </DropdownMenuItem>
          {reviewed === false && (
            <div className="m-1 flex gap-2 rounded-lg bg-amber-50 p-2 text-[11.5px] leading-snug text-amber-900">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Licence not reviewed yet. Check what you&apos;re allowed to do in{" "}
                <Link href="/rights" className="font-medium underline">
                  PLR Rights Review
                </Link>{" "}
                before selling.
              </span>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ExportOptionsDialog open={optsOpen} onOpenChange={setOptsOpen} />
    </>
  );
}
