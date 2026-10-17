"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/overlays";
import { documentToHtml, type ExportableDocument } from "@/lib/export/document";
import { loadDocExportOptions } from "./doc-export";

/** Read-only, print-ready preview rendered in a sandboxed iframe. */
export function DocumentPreviewDialog({ open, onOpenChange, doc }: { open: boolean; onOpenChange: (o: boolean) => void; doc: ExportableDocument | null }) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const html = React.useMemo(() => (doc ? documentToHtml(doc, loadDocExportOptions()) : ""), [doc]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b px-5 py-3 pr-12">
          <DialogTitle className="min-w-0 flex-1 truncate text-base">Preview — {doc?.title}</DialogTitle>
          <Button size="sm" variant="outline" onClick={() => frameRef.current?.contentWindow?.print()}>
            <Printer /> Print / Save as PDF
          </Button>
        </div>
        <iframe ref={frameRef} title="Document preview" className="min-h-0 flex-1 bg-[#f4f5f8]" sandbox="allow-same-origin allow-modals" srcDoc={html} />
      </DialogContent>
    </Dialog>
  );
}
