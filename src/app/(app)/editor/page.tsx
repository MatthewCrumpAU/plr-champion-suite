"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProjectGate } from "@/components/common/project-gate";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";
import { useActiveProjectId, useAsset, useProject } from "@/lib/data/hooks";
import { EditorHome } from "@/features/editor/editor-home";
import { EditorWorkspace } from "@/features/editor/editor-workspace";

function OpenDocument({ id }: { id: string }) {
  const { data: asset, loading } = useAsset<"document">(id);
  const { data: project, loading: pLoading } = useProject(asset?.projectId);
  const [activeId, setActive] = useActiveProjectId();
  React.useEffect(() => {
    if (asset && asset.projectId !== activeId) setActive(asset.projectId);
  }, [asset, activeId, setActive]);

  if (loading || (asset && pLoading)) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Opening…
      </div>
    );
  }
  if (!asset || asset.type !== "document" || !project) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <p className="text-lg font-semibold">Document not found</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted, or it belongs to a project in the Trash.</p>
        <Button asChild className="mt-4">
          <Link href="/editor">Back to documents</Link>
        </Button>
      </div>
    );
  }
  return <EditorWorkspace key={id} assetId={id} project={project} />;
}

export default function EditorPage() {
  const params = useSearchParams();
  const id = params.get("id");
  if (id) return <OpenDocument id={id} />;
  return <ProjectGate tool="PLR Editor">{(project) => <EditorHome project={project} />}</ProjectGate>;
}
