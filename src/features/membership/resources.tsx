"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Download, ExternalLink, FileText, Lock, Megaphone, Package, SquareCheckBig, Wrench, LayoutTemplate, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageContainer, PageHeader, Spinner } from "@/components/ui/primitives";
import { downloadStoredFile } from "@/lib/membership/member-actions";
import { RESOURCE_TYPE_LABELS, type Resource, type ResourceType } from "@/lib/membership/types";
import { cn, errorMessage, formatBytes } from "@/lib/utils";
import { useCatalog, useMember } from "./member-context";
import { AccessBadge } from "./ui";

const TYPE_ICON: Record<ResourceType, typeof FileText> = { template: LayoutTemplate, checklist: SquareCheckBig, swipe: Megaphone, tool: Wrench, guide: BookOpen, link: Link2 };
const ORDER: ResourceType[] = ["template", "checklist", "swipe", "guide", "tool", "link"];

function ResourceCard({ r }: { r: Resource }) {
  const m = useMember();
  const [busy, setBusy] = React.useState(false);
  const Icon = TYPE_ICON[r.type];
  const lock = m.lockReason({ access: r.access, status: r.status, publishAt: null });
  const internal = r.url.startsWith("/");
  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="resource-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{r.title}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="outline">{RESOURCE_TYPE_LABELS[r.type]}</Badge>
            <AccessBadge tier={r.access} />
            {m.isAdmin && r.status !== "published" && <Badge variant="warning">{r.status}</Badge>}
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{r.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {lock ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> {lock}
          </span>
        ) : (
          <>
            {r.fileId && (
              <Button
                size="sm"
                variant="outline"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await downloadStoredFile(m.brandId, r.fileId!, r.fileName ?? r.title, m.account.id, "resource", r.title);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Download /> Download {r.fileSize ? <span className="text-muted-foreground">({formatBytes(r.fileSize)})</span> : null}
              </Button>
            )}
            {r.url &&
              (internal ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={r.url}>
                    <Wrench /> Open
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> Visit
                  </a>
                </Button>
              ))}
          </>
        )}
      </div>
    </Card>
  );
}

export function ResourcesPage() {
  const m = useMember();
  const { data, loading } = useCatalog();
  const [type, setType] = React.useState<ResourceType | "all">("all");
  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading…
      </div>
    );
  }
  const visible = data.resources.filter((r) => m.canSee({ status: r.status, publishAt: null }));
  const types = ORDER.filter((t) => visible.some((r) => r.type === t));
  const shown = visible.filter((r) => type === "all" || r.type === type);
  return (
    <PageContainer width="wide">
      <PageHeader eyebrow={m.brand.name} title="Member Resources" description="Templates, checklists, swipe files and guides to help you package and sell your PLR." actions={m.isAdmin ? <Button asChild variant="outline"><Link href={m.adminHref("resources")}>Manage resources</Link></Button> : undefined} />
      {visible.length === 0 ? (
        <EmptyState icon={<Package />} title="No resources yet" />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {(["all", ...types] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition", type === t ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary")}>
                {t === "all" ? `All (${visible.length})` : `${RESOURCE_TYPE_LABELS[t]}s (${visible.filter((r) => r.type === t).length})`}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((r) => (
              <ResourceCard key={r.id} r={r} />
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
