"use client";

import * as React from "react";
import { Download, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlays";
import { downloadFile, type ExportFile } from "@/lib/export/download";
import { logExport } from "@/lib/services/export-log";
import { errorMessage } from "@/lib/utils";

export interface ExportOption {
  id: string;
  label: string;
  run: () => Promise<ExportFile> | ExportFile;
}

/** Generic export dropdown: runs an exporter, downloads the file and records it in export history. */
export function ExportMenu({ options, projectId, assetId, label = "Export", assetLabel, size = "sm", beforeExport }: { options: ExportOption[]; projectId: string | null; assetId: string | null; label?: string; assetLabel: string; size?: "sm" | "xs" | "default"; beforeExport?: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  async function run(o: ExportOption) {
    setBusy(true);
    try {
      await beforeExport?.();
      const f = await o.run();
      downloadFile(f);
      await logExport({ projectId, assetId, label: assetLabel, format: o.id, fileName: f.fileName, size: f.blob.size });
      toast.success(`Exported ${f.fileName}`);
    } catch (e) {
      toast.error(`Export failed: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant="outline" loading={busy} data-testid="export-menu">
          {!busy && <Download />} {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Download as</DropdownMenuLabel>
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => void run(o)} data-testid={`export-${o.id}`}>
            <FileDown /> {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
