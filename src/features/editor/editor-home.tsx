"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilePlus2, FileText, FileUp, MoreHorizontal, Copy, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import { DOCUMENT_ROLE_LABELS } from "@/lib/models/document";
import { useAssets } from "@/lib/data/hooks";
import { createDocument } from "@/lib/services/documents";
import { duplicateAsset, trashAsset } from "@/lib/services/assets";
import { updateProject } from "@/lib/services/projects";
import { docWords } from "@/lib/doc/text";
import { ACCEPTED_IMPORT, ACCEPTED_LABEL } from "@/lib/import";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageContainer, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { FileDrop } from "@/components/common/file-drop";
import { errorMessage, timeAgo } from "@/lib/utils";
import { ImportDialog } from "./import-dialog";

export function EditorHome({ project }: { project: Project }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { data: docs, loading } = useAssets(project.id, "document");
  const [importOpen, setImportOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [creating, setCreating] = React.useState(false);
  const params = useSearchParams();
  const pathname = usePathname();
  // /editor?import=1 (from the Dashboard) opens the import dialog straight away.
  React.useEffect(() => {
    if (params.get("import") === "1") {
      setImportOpen(true);
      router.replace(pathname);
    }
  }, [params, pathname, router]);

  async function newBlank() {
    setCreating(true);
    try {
      const a = await createDocument(project.id, { title: "Untitled document" });
      router.push(`/editor?id=${a.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setCreating(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Content Studio · PLR Editor"
        title="PLR Editor"
        description="Import a PLR file, split it into chapters, edit with full formatting, compare against the original and export to Word, PDF, HTML or Markdown."
        actions={
          <>
            <Button variant="outline" onClick={() => void newBlank()} loading={creating} data-testid="new-blank-doc">
              <FilePlus2 /> Blank document
            </Button>
            <Button onClick={() => { setFile(null); setImportOpen(true); }} data-testid="open-import">
              <FileUp /> Import file
            </Button>
          </>
        }
      />
      <FileDrop
        accept={ACCEPTED_IMPORT}
        onFiles={(f) => {
          setFile(f[0]);
          setImportOpen(true);
        }}
        title="Drag and drop a PLR file to import it"
        hint={`${ACCEPTED_LABEL} · read privately in your browser`}
        className="mb-8"
        testId="home-drop"
      />
      <SectionTitle>Documents in {project.name}</SectionTitle>
      {!loading && !docs?.length ? (
        <EmptyState icon={<FileText />} title="No documents yet" description="Import your first PLR file or start a blank document." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs?.map((d) => {
            const words = d.data.chapters.reduce((n, c) => n + docWords(c.content), 0);
            const isMain = project.mainDocumentId === d.id;
            return (
              <Card key={d.id} className="group relative flex flex-col p-4 transition hover:border-primary/40 hover:shadow-md">
                <Link href={`/editor?id=${d.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${d.title}`} />
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.data.chapters.length} {d.data.chapterLabel.toLowerCase()}s · {words.toLocaleString()} words
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-xs" className="relative z-10" aria-label="Document options">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!isMain && (
                        <DropdownMenuItem onSelect={() => void updateProject(project.id, { mainDocumentId: d.id }).then(() => toast.success("Set as main document"))}>
                          <Star /> Set as main document
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => void duplicateAsset(d.id).then(() => toast.success("Document duplicated"))}>
                        <Copy /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onSelect={async () => {
                          if (await confirm({ title: `Move “${d.title}” to the Trash?`, description: "You can restore it from Projects → Trash.", confirmLabel: "Move to Trash", destructive: true })) {
                            await trashAsset(d.id);
                            toast.success("Moved to Trash");
                          }
                        }}
                      >
                        <Trash2 /> Move to Trash
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {isMain && <Badge>Main product</Badge>}
                  {!isMain && <Badge variant="secondary">{DOCUMENT_ROLE_LABELS[d.data.role]}</Badge>}
                  {d.data.original && <Badge variant="outline">Original preserved</Badge>}
                  <span className="ml-auto text-[11px] text-muted-foreground">Edited {timeAgo(d.updatedAt)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} project={project} initialFile={file} />
    </PageContainer>
  );
}
