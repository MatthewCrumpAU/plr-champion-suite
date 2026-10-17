"use client";

import * as React from "react";
import { ClipboardCopy, FileUp, KeyRound, Layers, ListPlus, Search, Sparkles, Star, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { Keyword, KeywordIntent, KeywordSetData, KeywordType, ItemSource } from "@/lib/models/research";
import { KEYWORD_KINDS } from "@/lib/ai/tasks";
import { useAITask, useAIStatus, parseJsonLoose } from "@/lib/ai/client";
import { apiJson } from "@/lib/client/api";
import { autoCluster, cleanKeyword, INTENT_LABELS, KEYWORD_TYPE_LABELS, keywordsFromCsv, keywordsToCsv, mergeKeywords, newKeyword, parseKeywordCsv, patternKeywords, SOURCE_LABELS, type CsvPreview } from "@/lib/research/keywords";
import { safeFileName, textFile } from "@/lib/export/download";
import { createAsset } from "@/lib/services/assets";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, Checkbox, EmptyState, Field, Input, NativeSelect, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Tooltip } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import { AIRunStatus, AIUsageLine } from "@/components/common/ai";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage } from "@/lib/utils";

type KwKind = (typeof KEYWORD_KINDS)[number];

const SOURCE_BADGE: Record<ItemSource, "secondary" | "ai" | "outline" | "default"> = { manual: "secondary", "ai-hypothesis": "ai", pattern: "outline", csv: "default" };

function useMetricsProvider() {
  const [state, setState] = React.useState<{ configured: boolean; provider: string | null } | null>(null);
  React.useEffect(() => {
    apiJson<{ configured: boolean; provider: string | null }>("/api/keywords/metrics")
      .then(setState)
      .catch(() => setState({ configured: false, provider: null }));
  }, []);
  return state;
}

function CsvDialog({ preview, onClose, onImport }: { preview: CsvPreview | null; onClose: () => void; onImport: (map: CsvPreview["guess"]) => void }) {
  const [map, setMap] = React.useState<CsvPreview["guess"] | null>(null);
  React.useEffect(() => setMap(preview?.guess ?? null), [preview]);
  if (!preview || !map) return null;
  const col = (k: keyof CsvPreview["guess"], label: string, required = false) => (
    <Field label={label} htmlFor={`csv-${k}`}>
      <NativeSelect id={`csv-${k}`} value={map[k] ?? ""} onChange={(e) => setMap({ ...map, [k]: e.target.value || null })}>
        {!required && <option value="">— Not in this file —</option>}
        {preview.headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {preview.fileName}</DialogTitle>
          <DialogDescription>
            {preview.rows.length.toLocaleString()} rows found. Match the columns — metrics are stored with “CSV: {preview.fileName}” as their source.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {col("keyword", "Keyword column", true)}
          {col("cluster", "Group / cluster column")}
          {col("volume", "Search volume column")}
          {col("competition", "Competition / difficulty column")}
          {col("cpc", "CPC column")}
          {col("intent", "Intent column")}
        </div>
        <div className="plr-scroll max-h-44 overflow-auto rounded-lg border text-xs">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                {preview.headers.map((h) => (
                  <th key={h} className="px-2 py-1 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 5).map((r, i) => (
                <tr key={i} className="border-t">
                  {preview.headers.map((h) => (
                    <td key={h} className="px-2 py-1">
                      {r[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onImport(map)} data-testid="csv-import-confirm">
            Import keywords
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricInput({ value, onChange, label, step }: { value: number | string | null; onChange: (v: string) => void; label: string; step?: number }) {
  const [t, setT] = React.useState(value === null ? "" : String(value));
  React.useEffect(() => setT(value === null ? "" : String(value)), [value]);
  return (
    <input
      value={t}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => t !== (value === null ? "" : String(value)) && onChange(t)}
      placeholder="—"
      inputMode={step ? "decimal" : undefined}
      className="h-7 w-full rounded border border-transparent bg-transparent px-1 text-right text-xs tabular-nums outline-none hover:border-border focus:border-primary"
      aria-label={label}
    />
  );
}

function KeywordEditor({ editor, project }: { editor: AssetEditor<"keyword-set">; project: Project }) {
  const d = editor.data!;
  const set = (p: Partial<KeywordSetData>) => editor.update((x) => ({ ...x, ...p }));
  const setKeywords = (fn: (k: Keyword[]) => Keyword[]) => editor.update((x) => ({ ...x, keywords: fn(x.keywords) }));
  const patch = (id: string, p: Partial<Keyword>) => setKeywords((ks) => ks.map((k) => (k.id === id ? { ...k, ...p } : k)));
  const [kinds, setKinds] = React.useState<KwKind[]>(["long-tail", "question", "product"]);
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<KeywordType | "">("");
  const [sourceFilter, setSourceFilter] = React.useState<ItemSource | "">("");
  const [cluster, setCluster] = React.useState<string | null>(null);
  const [starredOnly, setStarredOnly] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = React.useState(false);
  const [addText, setAddText] = React.useState("");
  const [bulkCluster, setBulkCluster] = React.useState("");
  const [csv, setCsv] = React.useState<CsvPreview | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { configured } = useAIStatus();
  const ai = useAITask("research.keywords");
  const provider = useMetricsProvider();
  const confirm = useConfirm();

  React.useEffect(() => {
    if (!d.niche && !d.audience && (project.niche || project.audience)) set({ niche: project.niche, audience: project.audience });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addAll = (incoming: Keyword[], label: string) => {
    const r = mergeKeywords(d.keywords, incoming);
    set({ keywords: r.keywords });
    toast.success(`${label}: ${r.added} added${r.updated ? `, ${r.updated} updated with metrics` : ""}${incoming.length - r.added - r.updated > 0 ? `, ${incoming.length - r.added - r.updated} already listed` : ""}`);
  };

  const generatePatterns = () => {
    if (!d.seed.trim()) return toast.error("Enter a seed keyword first.");
    const seed = newKeyword(d.seed, { type: "seed", cluster: "Seed", source: "manual" });
    addAll([seed, ...patternKeywords(d.seed, { audience: d.audience, kinds })], "Patterns");
  };

  const suggestAI = async () => {
    if (!d.seed.trim()) return toast.error("Enter a seed keyword first.");
    const r = await ai.run({ seed: d.seed, niche: d.niche, audience: d.audience, kinds, count: 30, existing: d.keywords.map((k) => k.keyword) }, project.id);
    if (!r) return;
    try {
      const arr = parseJsonLoose<{ keyword?: string; type?: string; intent?: string; cluster?: string }[]>(r.text);
      const list = (Array.isArray(arr) ? arr : [])
        .filter((x) => x?.keyword)
        .map((x) =>
          newKeyword(String(x.keyword), {
            source: "ai-hypothesis",
            type: (Object.keys(KEYWORD_TYPE_LABELS) as KeywordType[]).includes(x.type as KeywordType) ? (x.type as KeywordType) : undefined,
            intent: x.intent && x.intent in INTENT_LABELS ? (x.intent as KeywordIntent) : undefined,
            cluster: String(x.cluster ?? "").slice(0, 60),
          }),
        );
      if (!list.length) throw new Error("The AI response did not contain any keywords. Try again.");
      addAll(list, "AI suggestions");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const runCluster = () => {
    const map = autoCluster(d.keywords, d.seed);
    setKeywords((ks) => ks.map((k) => ({ ...k, cluster: map.get(k.id) ?? k.cluster })));
    toast.success(`Grouped into ${new Set(map.values()).size} clusters`);
  };

  const clusters = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const k of d.keywords) m.set(k.cluster || "", (m.get(k.cluster || "") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [d.keywords]);

  const q = query.trim().toLowerCase();
  const visible = d.keywords.filter((k) => (!q || k.keyword.includes(q) || k.notes.toLowerCase().includes(q)) && (!typeFilter || k.type === typeFilter) && (!sourceFilter || k.source === sourceFilter) && (cluster === null || (k.cluster || "") === cluster) && (!starredOnly || k.starred));
  const allSelected = visible.length > 0 && visible.every((k) => selected.has(k.id));
  const selectedIds = [...selected].filter((id) => d.keywords.some((k) => k.id === id));
  const withMetrics = d.keywords.filter((k) => k.metrics.metricsSource).length;

  const setMetric = (k: Keyword, field: "volume" | "competition" | "cpc", raw: string) => {
    const v = raw.trim();
    const value = field === "competition" ? v || null : v === "" ? null : Number(v.replace(/[,$£€]/g, ""));
    if (field !== "competition" && value !== null && !Number.isFinite(value as number)) return toast.error("Enter a number.");
    const metrics = { ...k.metrics, [field]: value };
    const any = metrics.volume !== null || metrics.cpc !== null || metrics.competition !== null;
    patch(k.id, { metrics: { ...metrics, metricsSource: any ? (k.metrics.metricsSource?.startsWith("CSV") ? k.metrics.metricsSource : "Entered by me") : null } });
  };

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1500px] gap-4 px-4 py-6 sm:px-6">
      <Card className="grid gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
          <Field label="Seed keyword" htmlFor="kw-seed">
            <Input id="kw-seed" value={d.seed} onChange={(e) => set({ seed: e.target.value })} placeholder="e.g. work from home productivity" data-testid="kw-seed" />
          </Field>
          <Field label="Niche" htmlFor="kw-niche" optional>
            <Input id="kw-niche" value={d.niche} onChange={(e) => set({ niche: e.target.value })} />
          </Field>
          <Field label="Audience" htmlFor="kw-aud" optional>
            <Input id="kw-aud" value={d.audience} onChange={(e) => set({ audience: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[13px] font-medium">Include</span>
          {KEYWORD_KINDS.map((k) => (
            <label key={k} className="flex items-center gap-1.5 text-[13px]">
              <Checkbox checked={kinds.includes(k)} onCheckedChange={(v) => setKinds((x) => (v ? [...x, k] : x.filter((y) => y !== k)))} /> {KEYWORD_TYPE_LABELS[k]}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={generatePatterns} disabled={!kinds.length} data-testid="kw-patterns">
            <Wand2 /> Generate from patterns
          </Button>
          <Tooltip content={configured ? "Ask Claude for keyword ideas (no search data)" : "Configure AI in Settings to enable"}>
            <span>
              <Button variant="gradient" onClick={() => void suggestAI()} disabled={!configured || ai.running || !kinds.length} data-testid="kw-ai">
                <Sparkles /> Suggest with AI
              </Button>
            </span>
          </Tooltip>
          <Button variant="outline" onClick={() => setAddOpen(true)} data-testid="kw-add">
            <ListPlus /> Add keywords
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="kw-csv">
            <FileUp /> Import CSV
          </Button>
          <Button variant="outline" onClick={runCluster} disabled={d.keywords.length < 2} data-testid="kw-cluster">
            <Layers /> Auto-cluster
          </Button>
        </div>
        <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void ai.retry()} label="Finding keyword ideas…" />
        <AIUsageLine result={ai.result} />
        <Callout tone="neutral" icon={<KeyRound />}>
          {provider?.configured ? (
            <>Verified metrics provider: {provider.provider}.</>
          ) : (
            <>
              <b>Search volume, competition and CPC are never estimated.</b> No keyword data provider is connected, so these columns only show numbers you import from your keyword tool&apos;s CSV or type in yourself. AI and pattern suggestions are ideas to research, not data. {withMetrics > 0 && `${withMetrics} keyword${withMetrics === 1 ? " has" : "s have"} metrics with a recorded source.`}
            </>
          )}
        </Callout>
      </Card>

      {d.keywords.length === 0 ? (
        <EmptyState icon={<KeyRound />} title="No keywords yet" description="Enter a seed keyword and generate pattern ideas, ask AI for suggestions, paste your own list, or import a CSV export from your keyword tool." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <Card className="grid content-start gap-1 p-2" data-testid="kw-clusters">
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Clusters</p>
            <button type="button" onClick={() => setCluster(null)} className={cn("flex items-center rounded-md px-2 py-1.5 text-left text-[13px]", cluster === null ? "bg-primary-soft font-medium text-primary" : "hover:bg-secondary")}>
              All keywords <span className="ml-auto text-xs text-muted-foreground">{d.keywords.length}</span>
            </button>
            {clusters.map(([name, n]) => (
              <div key={name || "__none"} className={cn("group flex items-center rounded-md", cluster === name ? "bg-primary-soft" : "hover:bg-secondary")}>
                <button type="button" onClick={() => setCluster(name)} className={cn("min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[13px]", cluster === name && "font-medium text-primary", !name && "italic text-muted-foreground")}>
                  {name || "Unclustered"}
                </button>
                <span className="pr-2 text-xs text-muted-foreground">{n}</span>
              </div>
            ))}
            {cluster && (
              <form
                className="mt-2 grid gap-1 border-t p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = String(new FormData(e.currentTarget).get("rename") ?? "").trim();
                  setKeywords((ks) => ks.map((k) => ((k.cluster || "") === cluster ? { ...k, cluster: v } : k)));
                  setCluster(v);
                }}
              >
                <Input name="rename" defaultValue={cluster} key={cluster} className="h-8 text-xs" aria-label="Rename cluster" />
                <Button size="xs" type="submit" variant="outline">
                  Rename cluster
                </Button>
              </form>
            )}
          </Card>
          <Card className="grid min-w-0 content-start gap-3 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search keywords" className="h-8 w-56 pl-8 text-sm" />
              </div>
              <NativeSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as KeywordType | "")} className="h-8 w-auto text-xs" aria-label="Type filter">
                <option value="">All types</option>
                {Object.entries(KEYWORD_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as ItemSource | "")} className="h-8 w-auto text-xs" aria-label="Source filter">
                <option value="">All sources</option>
                {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={starredOnly} onCheckedChange={(v) => setStarredOnly(!!v)} /> Starred
              </label>
              <span className="ml-auto text-xs text-muted-foreground">
                {visible.length} of {d.keywords.length}
              </span>
              <Tooltip content="Copy visible keywords">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(visible.map((k) => k.keyword).join("\n"));
                    toast.success(`Copied ${visible.length} keywords`);
                  }}
                  aria-label="Copy keywords"
                >
                  <ClipboardCopy />
                </Button>
              </Tooltip>
            </div>
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-soft px-3 py-2 text-sm" data-testid="kw-bulk">
                <b>{selectedIds.length} selected</b>
                <Input value={bulkCluster} onChange={(e) => setBulkCluster(e.target.value)} placeholder="Cluster name" className="h-8 w-40 bg-white text-xs" list="kw-cluster-names" />
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setKeywords((ks) => ks.map((k) => (selected.has(k.id) ? { ...k, cluster: bulkCluster.trim() } : k)));
                    setBulkCluster("");
                  }}
                >
                  Set cluster
                </Button>
                <Button size="xs" variant="outline" onClick={() => setKeywords((ks) => ks.map((k) => (selected.has(k.id) ? { ...k, starred: true } : k)))}>
                  <Star /> Star
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    if (!(await confirm({ title: `Delete ${selectedIds.length} keywords?`, confirmLabel: "Delete", destructive: true }))) return;
                    setKeywords((ks) => ks.filter((k) => !selected.has(k.id)));
                    setSelected(new Set());
                  }}
                >
                  <Trash2 /> Delete
                </Button>
                <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
                  Clear selection
                </Button>
              </div>
            )}
            <datalist id="kw-cluster-names">
              {clusters.filter(([n]) => n).map(([n]) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <div className="plr-scroll max-h-[65vh] overflow-auto rounded-lg border">
              <table className="w-full min-w-[1080px] text-[13px]" data-testid="kw-table">
                <thead className="sticky top-0 z-10 bg-secondary text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-8 px-2 py-2">
                      <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? new Set(visible.map((k) => k.id)) : new Set())} aria-label="Select all" />
                    </th>
                    <th className="w-7" />
                    <th className="min-w-[280px] px-2 py-2">Keyword</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Intent</th>
                    <th className="px-2 py-2">Cluster</th>
                    <th className="w-20 px-2 py-2 text-right">Volume</th>
                    <th className="w-24 px-2 py-2 text-right">Competition</th>
                    <th className="w-16 px-2 py-2 text-right">CPC</th>
                    <th className="px-2 py-2">Source</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((k) => (
                    <tr key={k.id} className="border-t hover:bg-secondary/40">
                      <td className="px-2">
                        <Checkbox checked={selected.has(k.id)} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(k.id); else n.delete(k.id); return n; })} aria-label={`Select ${k.keyword}`} />
                      </td>
                      <td>
                        <button type="button" onClick={() => patch(k.id, { starred: !k.starred })} aria-label={k.starred ? "Unstar" : "Star"}>
                          <Star className={cn("size-4", k.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50")} />
                        </button>
                      </td>
                      <td className="px-2 py-1.5 font-medium">{k.keyword}</td>
                      <td className="px-1">
                        <select value={k.type} onChange={(e) => patch(k.id, { type: e.target.value as KeywordType })} className="h-7 rounded border-transparent bg-transparent text-xs hover:border-border" aria-label="Type">
                          {Object.entries(KEYWORD_TYPE_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1">
                        <select value={k.intent} onChange={(e) => patch(k.id, { intent: e.target.value as KeywordIntent })} className="h-7 rounded border-transparent bg-transparent text-xs hover:border-border" aria-label="Intent">
                          <option value="">—</option>
                          {Object.entries(INTENT_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1">
                        <input value={k.cluster} onChange={(e) => patch(k.id, { cluster: e.target.value })} list="kw-cluster-names" className="h-7 w-32 rounded border border-transparent bg-transparent px-1 text-xs outline-none hover:border-border focus:border-primary" aria-label="Cluster" />
                      </td>
                      <td className="px-1">
                        <MetricInput value={k.metrics.volume} onChange={(v) => setMetric(k, "volume", v)} label="Volume" />
                      </td>
                      <td className="px-1">
                        <MetricInput value={k.metrics.competition} onChange={(v) => setMetric(k, "competition", v)} label="Competition" />
                      </td>
                      <td className="px-1">
                        <MetricInput value={k.metrics.cpc} onChange={(v) => setMetric(k, "cpc", v)} label="CPC" step={0.01} />
                      </td>
                      <td className="px-2">
                        <Tooltip content={k.metrics.metricsSource ? `Metrics: ${k.metrics.metricsSource}` : "No metrics"}>
                          <span>
                            <Badge variant={SOURCE_BADGE[k.source]}>{SOURCE_LABELS[k.source]}</Badge>
                          </span>
                        </Tooltip>
                      </td>
                      <td>
                        <button type="button" onClick={() => setKeywords((ks) => ks.filter((x) => x.id !== k.id))} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${k.keyword}`}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add keywords</DialogTitle>
            <DialogDescription>One keyword per line. Duplicates are skipped.</DialogDescription>
          </DialogHeader>
          <Textarea rows={10} value={addText} onChange={(e) => setAddText(e.target.value)} placeholder={"morning routine for remote workers\nhow to focus working from home"} data-testid="kw-add-text" />
          <DialogFooter>
            <Button
              onClick={() => {
                const list = addText.split(/\n|,|;/).map(cleanKeyword).filter(Boolean).map((k) => newKeyword(k, { source: "manual" }));
                if (!list.length) return toast.error("Enter at least one keyword.");
                addAll(list, "Added");
                setAddText("");
                setAddOpen(false);
              }}
              data-testid="kw-add-confirm"
            >
              Add keywords
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        data-testid="kw-csv-input"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            if (f.size > 10 * 1024 * 1024) throw new Error("That CSV is over 10 MB. Split it into smaller files.");
            setCsv(parseKeywordCsv(await f.text(), f.name));
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
      <CsvDialog
        preview={csv}
        onClose={() => setCsv(null)}
        onImport={(map) => {
          try {
            const list = keywordsFromCsv(csv!, map);
            addAll(list, "CSV import");
            setCsv(null);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

export function KeywordFinder({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="keyword-set"
      tool="Keyword Finder"
      eyebrow="Research Studio"
      icon={<KeyRound />}
      description="Build and organise keyword lists — long-tail phrases, questions, product keywords and topic clusters. Import CSVs from your keyword tool; numbers are never made up."
      createLabel="New keyword list"
      onCreate={async () => (await createAsset(project.id, "keyword-set", { title: "Keyword list", data: { niche: project.niche, audience: project.audience } })).id}
      itemMeta={(a) => `${a.data.seed ? `“${a.data.seed}” · ` : ""}${a.data.keywords.length} keywords · ${new Set(a.data.keywords.map((k) => k.cluster).filter(Boolean)).size} clusters`}
      renderEditor={(editor) => <KeywordEditor editor={editor} project={project} />}
      versionText={(x) => ((x as KeywordSetData).keywords ?? []).map((k) => k.keyword).join("\n")}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "csv", label: "CSV (all keywords)", run: () => textFile(keywordsToCsv(editor.getData()!.keywords), safeFileName(editor.title, "csv"), "text/csv") },
            { id: "csv-starred", label: "CSV (starred only)", run: () => textFile(keywordsToCsv(editor.getData()!.keywords.filter((k) => k.starred)), safeFileName(`${editor.title} starred`, "csv"), "text/csv") },
            { id: "txt", label: "Plain list (.txt)", run: () => textFile(editor.getData()!.keywords.map((k) => k.keyword).join("\n"), safeFileName(editor.title, "txt")) },
          ]}
        />
      )}
    />
  );
}
