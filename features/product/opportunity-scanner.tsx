"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, EyeOff, Hammer, Lightbulb, Radar, RefreshCw, Sparkles, Star, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { Opportunity, FunnelRole } from "@/lib/models/product";
import { FUNNEL_ROLE_LABELS } from "@/lib/models/product";
import { useAITask, useAIStatus, parseJsonLoose } from "@/lib/ai/client";
import { analyseOpportunities, chapterSummaries, opportunityFromAI } from "@/lib/content/opportunities";
import { BUILDER_FORMATS, kindForFormat } from "@/lib/content/builders";
import { createAsset } from "@/lib/services/assets";
import { useAssets } from "@/lib/data/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, EmptyState, Input, NativeSelect, Stat, Switch } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger, Tooltip } from "@/components/ui/overlays";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { AIRunStatus, AIUsageLine, useBrief } from "@/components/common/ai";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage, timeAgo, titleCase } from "@/lib/utils";

const FORMAT_LABELS: Record<string, string> = Object.fromEntries(Object.values(BUILDER_FORMATS).flat().map((f) => [f.format, f.label]));
const formatLabel = (f: string) => FORMAT_LABELS[f] ?? titleCase(f.replace(/-/g, " "));

const ROUTES = { product: "/product-builder", bonus: "/bonus-builder", "lead-magnet": "/lead-magnets" } as const;

type RoleFilter = "all" | "lead" | "front" | "upsell" | "bonus";
const ROLE_FILTER: Record<RoleFilter, (r: FunnelRole) => boolean> = {
  all: () => true,
  lead: (r) => r === "lead-magnet",
  front: (r) => r === "front-end" || r === "membership",
  upsell: (r) => r === "upsell" || r === "order-bump" || r === "downsell",
  bonus: (r) => r === "bonus",
};

function priceText(o: Opportunity) {
  if (o.priceHigh <= 0) return "Free (opt-in or bonus)";
  return o.priceLow === o.priceHigh ? `$${o.priceLow}` : `$${o.priceLow}–$${o.priceHigh}`;
}

function FitStars({ rating }: { rating: number }) {
  if (!rating) return <span className="text-[11px] text-muted-foreground">Not scored</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Fit estimate ${rating} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", rating >= i ? "fill-amber-400 text-amber-400" : rating >= i - 0.5 ? "fill-amber-200 text-amber-400" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}

function OpportunityCard({ o, chapterTitles, onChange, onBuild }: { o: Opportunity; chapterTitles: Map<string, string>; onChange: (patch: Partial<Opportunity>) => void; onBuild: () => void }) {
  const sources = o.sourceChapterIds.map((id) => chapterTitles.get(id)).filter(Boolean) as string[];
  return (
    <Card className={cn("flex flex-col gap-3 p-4", o.dismissed && "opacity-60")} data-testid="opportunity">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{formatLabel(o.format)}</Badge>
        <Badge variant="secondary">{FUNNEL_ROLE_LABELS[o.funnelRole]}</Badge>
        {o.origin === "ai" ? <Badge variant="ai">AI idea</Badge> : <Badge variant="outline">From analysis</Badge>}
        {o.builtAssetId && (
          <Badge variant="success">
            <CheckCircle2 /> Built
          </Badge>
        )}
      </div>
      <Input value={o.name} onChange={(e) => onChange({ name: e.target.value })} className="h-9 border-transparent px-1 text-[15px] font-semibold hover:border-border" aria-label="Product name" />
      {o.positioning && <p className="text-[13px] leading-relaxed">{o.positioning}</p>}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
        <div>
          <dt className="text-muted-foreground">Source material</dt>
          <dd>
            <Tooltip content={sources.length ? sources.join(" · ") : "No chapters matched"}>
              <span className="cursor-help underline decoration-dotted">{sources.length} chapter{sources.length === 1 ? "" : "s"}</span>
            </Tooltip>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Complexity</dt>
          <dd className="capitalize">{o.complexity}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Price idea (estimate)</dt>
          <dd>{priceText(o)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fit (estimate)</dt>
          <dd>
            <FitStars rating={o.rating} />
          </dd>
        </div>
      </dl>
      {o.rationale && <p className="rounded-lg bg-secondary/60 p-2.5 text-[12px] leading-relaxed text-muted-foreground">{o.rationale}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {o.builtAssetId ? (
          <>
            <Button size="sm" variant="soft" asChild>
              <Link href={`/editor?id=${o.builtAssetId}`}>Open the draft</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={onBuild}>
              <Hammer /> Build again
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onBuild} disabled={o.dismissed} data-testid="build-this">
            <Hammer /> Build this product
          </Button>
        )}
        <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={() => onChange({ dismissed: !o.dismissed })}>
          {o.dismissed ? (
            <>
              <Undo2 /> Restore
            </>
          ) : (
            <>
              <EyeOff /> Dismiss
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

function ScanEditor({ editor, project }: { editor: AssetEditor<"opportunity-scan">; project: Project }) {
  const data = editor.data!;
  const { data: docs } = useAssets<"document">(project.id, "document");
  const doc = docs?.find((d) => d.id === data.documentId) ?? null;
  const { configured } = useAIStatus();
  const ai = useAITask("opportunity.scan");
  const brief = useBrief(project.id);
  const router = useRouter();
  const [filter, setFilter] = React.useState<RoleFilter>("all");
  const [showDismissed, setShowDismissed] = React.useState(false);
  const chapterTitles = React.useMemo(() => new Map((doc?.data.chapters ?? []).map((c) => [c.id, c.title])), [doc]);

  const analyse = React.useCallback(
    (replaceAnalysis = true) => {
      if (!doc) return;
      const { stats, opportunities } = analyseOpportunities({ title: doc.title, audience: project.audience, chapters: doc.data.chapters });
      editor.update((d) => {
        // Keep AI ideas and anything already built or renamed; refresh the rule-based ones.
        const keep = d.opportunities.filter((o) => o.origin === "ai" || o.builtAssetId || !replaceAnalysis);
        const fresh = opportunities.filter((n) => !keep.some((k) => k.origin === "analysis" && k.format === n.format));
        return { ...d, documentId: doc.id, stats, scannedAt: new Date().toISOString(), opportunities: [...keep, ...fresh] };
      });
    },
    [doc, project.audience, editor],
  );

  // First open: analyse automatically.
  React.useEffect(() => {
    if (doc && !data.scannedAt) analyse();
  }, [doc, data.scannedAt, analyse]);

  // Default the source document.
  React.useEffect(() => {
    if (data.documentId || !docs?.length) return;
    const main = docs.find((d) => d.data.role === "main") ?? docs[0];
    editor.update((d) => ({ ...d, documentId: main.id }));
  }, [docs, data.documentId, editor]);

  const askAI = async () => {
    if (!doc) return;
    const r = await ai.run({ title: doc.title, niche: project.niche, audience: project.audience, chapters: chapterSummaries(doc.data.chapters), brief }, project.id);
    if (!r) return;
    try {
      const arr = parseJsonLoose<unknown[]>(r.text);
      const list = (Array.isArray(arr) ? arr : []).map((x) => opportunityFromAI(x, doc.data.chapters)).filter((x): x is Opportunity => !!x);
      if (!list.length) throw new Error("The AI response did not contain any usable ideas. Try again.");
      editor.update((d) => ({ ...d, opportunities: [...d.opportunities, ...list] }));
      toast.success(`Added ${list.length} AI ideas`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const patch = (id: string, p: Partial<Opportunity>) => editor.update((d) => ({ ...d, opportunities: d.opportunities.map((o) => (o.id === id ? { ...o, ...p } : o)) }));
  const build = async (o: Opportunity) => {
    await editor.save();
    const kind = kindForFormat(o.format, o.funnelRole);
    router.push(`${ROUTES[kind]}?scan=${editor.asset!.id}&opp=${o.id}`);
  };

  const visible = data.opportunities.filter((o) => ROLE_FILTER[filter](o.funnelRole) && (showDismissed || !o.dismissed)).sort((a, b) => Number(a.dismissed) - Number(b.dismissed) || b.rating - a.rating);
  const s = data.stats;

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1400px] gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 flex-1 basis-64 gap-1 sm:max-w-md">
          <span className="text-[13px] font-medium">PLR product to analyse</span>
          <NativeSelect
            value={data.documentId ?? ""}
            onChange={(e) => editor.update((d) => ({ ...d, documentId: e.target.value || null, scannedAt: null, stats: null, opportunities: d.opportunities.filter((o) => o.builtAssetId) }))}
            aria-label="Source document"
          >
            {!docs?.length && <option value="">No documents yet</option>}
            {docs?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button variant="outline" onClick={() => analyse()} disabled={!doc} data-testid="scan-run">
          <RefreshCw /> Re-run analysis
        </Button>
        <Tooltip content={configured ? "Ask Claude for more repurposing ideas" : "Configure AI in Settings to enable"}>
          <span>
            <Button variant="gradient" onClick={() => void askAI()} disabled={!configured || !doc || ai.running} data-testid="scan-ai">
              <Sparkles /> Ask AI for more ideas
            </Button>
          </span>
        </Tooltip>
        {data.scannedAt && <span className="pb-2 text-xs text-muted-foreground">Analysed {timeAgo(data.scannedAt)}</span>}
      </div>
      <Callout tone="warning" title="Estimates, not market research">
        Price ideas and fit scores come from the structure of your content (chapters, action steps, lists) and typical price points for each format. They are planning estimates — not verified demand, sales data or guaranteed results. Check your licence allows each derivative product.
      </Callout>
      <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void ai.retry()} label="Looking for more ideas…" />
      <AIUsageLine result={ai.result} />
      {!docs?.length ? (
        <EmptyState icon={<Radar />} title="Nothing to analyse yet" description="Import a PLR product in the PLR Editor, then come back to scan it." action={<Button asChild><Link href="/editor">Open PLR Editor</Link></Button>} />
      ) : (
        <>
          {s && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="scan-stats">
              <Stat label="Chapters" value={s.chapters} />
              <Stat label="Words" value={s.words.toLocaleString()} />
              <Stat label="Action steps" value={s.actionSteps} hint="Verb-first instructions" />
              <Stat label="List items" value={s.listItems} />
              <Stat label="Questions" value={s.questions} />
              <Stat label="How-to sections" value={s.howToHeadings} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as RoleFilter)} className="min-w-0 max-w-full">
              <TabsList>
                <TabsTrigger value="all">All ({data.opportunities.filter((o) => !o.dismissed).length})</TabsTrigger>
                <TabsTrigger value="lead">Lead magnets</TabsTrigger>
                <TabsTrigger value="front">Front-end</TabsTrigger>
                <TabsTrigger value="upsell">Bumps &amp; upsells</TabsTrigger>
                <TabsTrigger value="bonus">Bonuses</TabsTrigger>
              </TabsList>
            </Tabs>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Switch checked={showDismissed} onCheckedChange={setShowDismissed} /> Show dismissed
            </label>
          </div>
          {visible.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="opportunities">
              {visible.map((o) => (
                <OpportunityCard key={o.id} o={o} chapterTitles={chapterTitles} onChange={(p) => patch(o.id, p)} onBuild={() => void build(o)} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Lightbulb />} title="No opportunities in this view" description="Try another filter, re-run the analysis, or ask AI for more ideas." />
          )}
        </>
      )}
    </div>
  );
}

export function OpportunityScanner({ project }: { project: Project }) {
  const { data: docs } = useAssets<"document">(project.id, "document");
  return (
    <AssetWorkspace
      project={project}
      type="opportunity-scan"
      tool="Opportunity Scanner"
      eyebrow="Product Studio"
      icon={<Radar />}
      description="Analyse a PLR product and see the different products it could become — format, name, source chapters, complexity, positioning and funnel role — then build any of them in one click."
      createLabel="New scan"
      onCreate={async () => {
        const main = docs?.find((d) => d.data.role === "main") ?? docs?.[0];
        const a = await createAsset(project.id, "opportunity-scan", { title: main ? `${main.title} — opportunities` : "Opportunity scan", data: { documentId: main?.id ?? null } });
        return a.id;
      }}
      itemMeta={(a) => `${a.data.opportunities.filter((o) => !o.dismissed).length} opportunities · ${a.data.opportunities.filter((o) => o.builtAssetId).length} built`}
      renderEditor={(editor) => <ScanEditor editor={editor} project={project} />}
      versionText={(d) => ((d as { opportunities?: Opportunity[] }).opportunities ?? []).map((o) => `${o.name} (${o.format})`).join("\n")}
    />
  );
}
