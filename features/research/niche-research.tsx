"use client";

import * as React from "react";
import { Compass, ExternalLink, FolderPlus, Link2, Plus, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { ContentOpportunity, IdeaScores, ItemSource, NicheResearchData, Persona, ProductIdea, ResearchItem } from "@/lib/models/research";
import { NICHE_KINDS } from "@/lib/ai/tasks";
import { useAITask, useAIStatus, parseJsonLoose } from "@/lib/ai/client";
import { markdownToDoc } from "@/lib/doc/parse";
import { exportDocument } from "@/lib/export/document";
import { safeFileName, textFile } from "@/lib/export/download";
import { loadDocExportOptions } from "@/components/common/doc-export";
import { createAsset } from "@/lib/services/assets";
import { createProject } from "@/lib/services/projects";
import { setActiveProjectId } from "@/lib/data/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, Checkbox, EmptyState, Field, Input, NativeSelect, Slider, Textarea } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from "@/components/ui/overlays";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import { AIRunStatus, AIUsageLine } from "@/components/common/ai";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage, nowIso, uid } from "@/lib/utils";
import { researchMarkdown, weightedScore } from "@/lib/research/niche";

type NicheKind = (typeof NICHE_KINDS)[number];

const SOURCE_TEXT: Record<ItemSource, string> = { manual: "Your note", "ai-hypothesis": "AI hypothesis — unverified", pattern: "Pattern", csv: "Imported" };
const SCORE_LABELS: Record<keyof IdeaScores, { label: string; hint: string }> = {
  demand: { label: "Demand", hint: "5 = you've seen strong evidence people want this" },
  competition: { label: "Room to compete", hint: "5 = little direct competition / easy to stand out" },
  fit: { label: "Fit with your PLR", hint: "5 = your existing content covers it well" },
  effort: { label: "Ease", hint: "5 = quick to produce" },
  profit: { label: "Profit potential", hint: "5 = you can price it well or upsell from it" },
};

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function SourceBadge({ source }: { source: ItemSource }) {
  return source === "ai-hypothesis" ? <Badge variant="ai">{SOURCE_TEXT[source]}</Badge> : <Badge variant="secondary">{SOURCE_TEXT[source]}</Badge>;
}

function ItemList({ items, onChange, withSeverity, placeholder, testid }: { items: ResearchItem[]; onChange: (items: ResearchItem[]) => void; withSeverity?: boolean; placeholder: string; testid: string }) {
  const [text, setText] = React.useState("");
  const patch = (id: string, p: Partial<ResearchItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  return (
    <div className="grid gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onChange([...items, { id: uid("ri"), text: text.trim(), why: "", severity: withSeverity ? "medium" : null, source: "manual", validated: false, evidence: "", createdAt: nowIso() }]);
          setText("");
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} data-testid={`${testid}-input`} />
        <Button type="submit" variant="outline">
          <Plus /> Add
        </Button>
      </form>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <ul className="grid gap-2" data-testid={testid}>
          {items.map((i) => (
            <li key={i.id} className={cn("grid gap-2 rounded-lg border p-3", i.validated && "border-green-300 bg-green-50/40")}>
              <div className="flex flex-wrap items-start gap-2">
                <Input value={i.text} onChange={(e) => patch(i.id, { text: e.target.value })} className="h-8 min-w-0 flex-1 border-transparent px-1 font-medium hover:border-border" aria-label="Text" />
                {withSeverity && (
                  <NativeSelect value={i.severity ?? "medium"} onChange={(e) => patch(i.id, { severity: e.target.value as ResearchItem["severity"] })} className="h-8 w-28 text-xs" aria-label="Severity">
                    <option value="low">Low impact</option>
                    <option value="medium">Medium impact</option>
                    <option value="high">High impact</option>
                  </NativeSelect>
                )}
                <SourceBadge source={i.source} />
                <button type="button" onClick={() => onChange(items.filter((x) => x.id !== i.id))} className="pt-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_1fr] sm:items-center">
                <Input value={i.why} onChange={(e) => patch(i.id, { why: e.target.value })} placeholder="Why it matters / context" className="h-8 text-xs" aria-label="Why" />
                <label className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                  <Checkbox checked={i.validated} onCheckedChange={(v) => patch(i.id, { validated: !!v })} /> Validated
                </label>
                <Input value={i.evidence} onChange={(e) => patch(i.id, { evidence: e.target.value })} placeholder="Evidence (forum thread, survey, customer email…)" className="h-8 text-xs" aria-label="Evidence" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IdeasPanel({ d, set, project }: { d: NicheResearchData; set: (p: Partial<NicheResearchData>) => void; project: Project }) {
  const [name, setName] = React.useState("");
  const patch = (id: string, p: Partial<ProductIdea>) => set({ ideas: d.ideas.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const sorted = [...d.ideas].sort((a, b) => weightedScore(b.scores, d.weights) - weightedScore(a.scores, d.weights));
  return (
    <div className="grid gap-4">
      <Callout tone="neutral">Scores are your own judgement from 1 to 5 — they are not market data. Adjust the weights to reflect what matters most to you, and record your evidence in Needs and Problems.</Callout>
      <Card className="grid gap-2 p-4">
        <p className="text-sm font-semibold">Weights</p>
        <div className="grid gap-3 sm:grid-cols-5">
          {(Object.keys(SCORE_LABELS) as (keyof IdeaScores)[]).map((k) => (
            <div key={k} className="grid gap-1">
              <span className="text-[12px] text-muted-foreground">
                {SCORE_LABELS[k].label} ×{d.weights[k]}
              </span>
              <Slider value={[d.weights[k]]} min={0} max={5} step={1} onValueChange={([v]) => set({ weights: { ...d.weights, [k]: v } })} aria-label={`${SCORE_LABELS[k].label} weight`} />
            </div>
          ))}
        </div>
      </Card>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          set({ ideas: [...d.ideas, { id: uid("idea"), name: name.trim(), format: "ebook", angle: "", scores: { demand: 3, competition: 3, fit: 3, effort: 3, profit: 3 }, notes: "", source: "manual" }] });
          setName("");
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product idea, e.g. “Remote work focus planner”" data-testid="idea-input" />
        <Button type="submit" variant="outline">
          <Plus /> Add idea
        </Button>
      </form>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No product ideas yet.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2" data-testid="ideas">
          {sorted.map((i, rank) => (
            <Card key={i.id} className="grid gap-3 p-4">
              <div className="flex items-start gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{rank + 1}</span>
                <div className="grid min-w-0 flex-1 gap-1">
                  <Input value={i.name} onChange={(e) => patch(i.id, { name: e.target.value })} className="h-8 border-transparent px-1 font-semibold hover:border-border" aria-label="Idea name" />
                  <div className="flex flex-wrap gap-2">
                    <Input value={i.format} onChange={(e) => patch(i.id, { format: e.target.value })} className="h-7 w-32 text-xs" aria-label="Format" />
                    <SourceBadge source={i.source} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold tabular-nums">{weightedScore(i.scores, d.weights).toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">your score / 5</p>
                </div>
              </div>
              <Input value={i.angle} onChange={(e) => patch(i.id, { angle: e.target.value })} placeholder="Angle / positioning" className="h-8 text-xs" />
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(SCORE_LABELS) as (keyof IdeaScores)[]).map((k) => (
                  <Tooltip key={k} content={SCORE_LABELS[k].hint}>
                    <label className="grid gap-1 text-center">
                      <span className="truncate text-[10.5px] text-muted-foreground">{SCORE_LABELS[k].label}</span>
                      <NativeSelect value={i.scores[k]} onChange={(e) => patch(i.id, { scores: { ...i.scores, [k]: Number(e.target.value) } })} className="h-7 px-1 text-center text-xs" aria-label={SCORE_LABELS[k].label}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                  </Tooltip>
                ))}
              </div>
              <Textarea rows={2} value={i.notes} onChange={(e) => patch(i.id, { notes: e.target.value })} placeholder="Notes" className="text-xs" />
              <div className="flex gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const p = await createProject({ name: i.name, niche: d.niche || project.niche, audience: d.audience || project.audience, description: i.angle, productType: "ebook", stage: "idea", notes: `Created from niche research “${d.niche}”.` });
                      setActiveProjectId(p.id);
                      toast.success(`Project “${p.name}” created and opened`);
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  <FolderPlus /> Start a project from this idea
                </Button>
                <Button size="xs" variant="ghost" className="ml-auto text-muted-foreground" onClick={() => set({ ideas: d.ideas.filter((x) => x.id !== i.id) })}>
                  <Trash2 /> Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonaCard({ p, onChange, onRemove }: { p: Persona; onChange: (x: Partial<Persona>) => void; onRemove: () => void }) {
  const list = (k: "goals" | "pains" | "objections" | "channels", label: string) => (
    <Field label={label}>
      <Textarea rows={3} value={p[k].join("\n")} onChange={(e) => onChange({ [k]: e.target.value.split("\n") } as Partial<Persona>)} onBlur={(e) => onChange({ [k]: lines(e.target.value) } as Partial<Persona>)} className="text-xs" placeholder="One per line" />
    </Field>
  );
  return (
    <Card className="grid gap-3 p-4">
      <div className="flex items-start gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <UserRound className="size-5" />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <Input value={p.name} onChange={(e) => onChange({ name: e.target.value })} className="h-8 border-transparent px-1 font-semibold hover:border-border" aria-label="Persona name" />
          <SourceBadge source={p.source} />
        </div>
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="Remove persona">
          <Trash2 className="size-4" />
        </button>
      </div>
      <Textarea rows={2} value={p.summary} onChange={(e) => onChange({ summary: e.target.value })} placeholder="Who they are, in a sentence or two" className="text-sm" />
      <Input value={p.demographics} onChange={(e) => onChange({ demographics: e.target.value })} placeholder="Situation / demographics (optional)" className="h-8 text-xs" />
      <div className="grid gap-2 sm:grid-cols-2">
        {list("goals", "Goals")}
        {list("pains", "Pains")}
        {list("objections", "Objections")}
        {list("channels", "Where to reach them")}
      </div>
    </Card>
  );
}

function NicheEditor({ editor, project }: { editor: AssetEditor<"niche-research">; project: Project }) {
  const d = editor.data!;
  const set = (p: Partial<NicheResearchData>) => editor.update((x) => ({ ...x, ...p }));
  const { configured } = useAIStatus();
  const ai = useAITask("research.niche");
  const [tab, setTab] = React.useState<NicheKind | "notes">("needs");
  const [contentTitle, setContentTitle] = React.useState("");
  const [ref, setRef] = React.useState({ title: "", url: "" });
  const [subNiche, setSubNiche] = React.useState("");

  React.useEffect(() => {
    if (!d.niche && !d.audience && (project.niche || project.audience)) set({ niche: project.niche, audience: project.audience });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggest = async (kind: NicheKind) => {
    if (d.niche.trim().length < 2) return toast.error("Enter a niche first.");
    const existing = kind === "needs" ? d.needs.map((x) => x.text) : kind === "problems" ? d.problems.map((x) => x.text) : kind === "ideas" ? d.ideas.map((x) => x.name) : kind === "personas" ? d.personas.map((x) => x.name) : d.content.map((x) => x.title);
    const r = await ai.run({ kind, niche: d.niche, audience: d.audience, notes: d.notes.slice(0, 2500), existing, count: kind === "personas" ? 3 : 8 }, project.id);
    if (!r) return;
    try {
      const arr = parseJsonLoose<Record<string, unknown>[]>(r.text);
      const list = Array.isArray(arr) ? arr.filter((x) => x && typeof x === "object") : [];
      const str = (v: unknown) => String(v ?? "").trim();
      const arrOf = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
      const sev = (v: unknown): ResearchItem["severity"] => (["low", "medium", "high"].includes(String(v)) ? (v as ResearchItem["severity"]) : "medium");
      const src: ItemSource = "ai-hypothesis";
      let added = 0;
      if (kind === "needs" || kind === "problems") {
        const items: ResearchItem[] = list.filter((x) => str(x.text)).map((x) => ({ id: uid("ri"), text: str(x.text), why: str(x.why), severity: kind === "problems" ? sev(x.severity) : null, source: src, validated: false, evidence: "", createdAt: nowIso() }));
        added = items.length;
        set(kind === "needs" ? { needs: [...d.needs, ...items] } : { problems: [...d.problems, ...items] });
      } else if (kind === "ideas") {
        const ideas: ProductIdea[] = list.filter((x) => str(x.name)).map((x) => ({ id: uid("idea"), name: str(x.name), format: str(x.format) || "ebook", angle: str(x.angle), scores: { demand: 3, competition: 3, fit: 3, effort: 3, profit: 3 }, notes: "", source: src }));
        added = ideas.length;
        set({ ideas: [...d.ideas, ...ideas] });
      } else if (kind === "personas") {
        const ps: Persona[] = list.filter((x) => str(x.name)).map((x) => ({ id: uid("per"), name: str(x.name), summary: str(x.summary), demographics: "", goals: arrOf(x.goals), pains: arrOf(x.pains), objections: arrOf(x.objections), channels: arrOf(x.channels), source: src }));
        added = ps.length;
        set({ personas: [...d.personas, ...ps] });
      } else {
        const cs: ContentOpportunity[] = list.filter((x) => str(x.title)).map((x) => ({ id: uid("co"), title: str(x.title), format: str(x.format) || "article", angle: str(x.angle), status: "idea", source: src }));
        added = cs.length;
        set({ content: [...d.content, ...cs] });
      }
      if (!added) throw new Error("The AI response didn't contain usable items. Try again.");
      toast.success(`Added ${added} AI hypotheses — validate before relying on them`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const aiButton = (kind: NicheKind, label: string) => (
    <Tooltip content={configured ? "Generates unverified hypotheses to research — not market data" : "Configure AI in Settings to enable"}>
      <span>
        <Button size="sm" variant="soft" onClick={() => void suggest(kind)} disabled={!configured || ai.running} data-testid={`niche-ai-${kind}`}>
          <Sparkles /> {label}
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1300px] gap-5 px-4 py-6 sm:px-6">
      <Card className="grid gap-4 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Niche" htmlFor="n-niche">
            <Input id="n-niche" value={d.niche} onChange={(e) => set({ niche: e.target.value })} placeholder="e.g. Productivity for remote workers" data-testid="niche-input" />
          </Field>
          <Field label="Audience" htmlFor="n-aud">
            <Input id="n-aud" value={d.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Who you want to serve" />
          </Field>
        </div>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium">Sub-niches to explore</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {d.subNiches.map((s, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {s}
                <button type="button" onClick={() => set({ subNiches: d.subNiches.filter((_, j) => j !== i) })} aria-label={`Remove ${s}`}>
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (subNiche.trim()) set({ subNiches: [...d.subNiches, subNiche.trim()] });
                setSubNiche("");
              }}
            >
              <Input value={subNiche} onChange={(e) => setSubNiche(e.target.value)} placeholder="Add a sub-niche" className="h-7 w-44 text-xs" />
            </form>
          </div>
        </div>
      </Card>
      <Callout tone="warning" title="Hypotheses until you validate them">
        AI suggestions are clearly marked and are ideas to investigate — not verified market facts, statistics or demand. Tick “Validated” only when you have your own evidence, and note where it came from.
      </Callout>
      <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void ai.retry()} label="Generating research hypotheses…" />
      <AIUsageLine result={ai.result} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as NicheKind | "notes")}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="needs">Needs ({d.needs.length})</TabsTrigger>
          <TabsTrigger value="problems">Problems ({d.problems.length})</TabsTrigger>
          <TabsTrigger value="ideas">Product ideas ({d.ideas.length})</TabsTrigger>
          <TabsTrigger value="personas">Personas ({d.personas.length})</TabsTrigger>
          <TabsTrigger value="content">Content ({d.content.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes &amp; sources</TabsTrigger>
        </TabsList>
        <TabsContent value="needs" className="mt-4 grid gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">What does this audience want to achieve?</p>
            {aiButton("needs", "Suggest needs")}
          </div>
          <ItemList items={d.needs} onChange={(needs) => set({ needs })} placeholder="An audience need, e.g. “Finish work on time without overtime”" testid="needs" />
        </TabsContent>
        <TabsContent value="problems" className="mt-4 grid gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">What gets in their way?</p>
            {aiButton("problems", "Suggest problems")}
          </div>
          <ItemList items={d.problems} onChange={(problems) => set({ problems })} withSeverity placeholder="A common problem, e.g. “Constant interruptions at home”" testid="problems" />
        </TabsContent>
        <TabsContent value="ideas" className="mt-4 grid gap-3">
          <div className="flex justify-end">{aiButton("ideas", "Suggest product ideas")}</div>
          <IdeasPanel d={d} set={set} project={project} />
        </TabsContent>
        <TabsContent value="personas" className="mt-4 grid gap-3">
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={() => set({ personas: [...d.personas, { id: uid("per"), name: "New persona", summary: "", demographics: "", goals: [], pains: [], objections: [], channels: [], source: "manual" }] })}
              data-testid="persona-add"
            >
              <Plus /> Add persona
            </Button>
            {aiButton("personas", "Draft personas")}
          </div>
          {d.personas.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {d.personas.map((p) => (
                <PersonaCard key={p.id} p={p} onChange={(x) => set({ personas: d.personas.map((y) => (y.id === p.id ? { ...y, ...x } : y)) })} onRemove={() => set({ personas: d.personas.filter((y) => y.id !== p.id) })} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<UserRound />} title="No personas yet" description="Personas are fictional profiles that help you write for a real reader. Base them on what you've learned from customers." />
          )}
        </TabsContent>
        <TabsContent value="content" className="mt-4 grid gap-3">
          <div className="flex items-center gap-2">
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!contentTitle.trim()) return;
                set({ content: [...d.content, { id: uid("co"), title: contentTitle.trim(), format: "article", angle: "", status: "idea", source: "manual" }] });
                setContentTitle("");
              }}
            >
              <Input value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} placeholder="Content idea — blog post, video, email, lead magnet…" />
              <Button type="submit" variant="outline">
                <Plus /> Add
              </Button>
            </form>
            {aiButton("content", "Suggest content")}
          </div>
          {d.content.length ? (
            <ul className="grid gap-2">
              {d.content.map((c) => (
                <li key={c.id} className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_140px_130px_auto] sm:items-center">
                  <div className="grid gap-1">
                    <Input value={c.title} onChange={(e) => set({ content: d.content.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x)) })} className="h-8 border-transparent px-1 font-medium hover:border-border" aria-label="Title" />
                    <Input value={c.angle} onChange={(e) => set({ content: d.content.map((x) => (x.id === c.id ? { ...x, angle: e.target.value } : x)) })} placeholder="Angle" className="h-7 text-xs" />
                  </div>
                  <Input value={c.format} onChange={(e) => set({ content: d.content.map((x) => (x.id === c.id ? { ...x, format: e.target.value } : x)) })} className="h-8 text-xs" aria-label="Format" />
                  <NativeSelect value={c.status} onChange={(e) => set({ content: d.content.map((x) => (x.id === c.id ? { ...x, status: e.target.value as ContentOpportunity["status"] } : x)) })} className="h-8 text-xs" aria-label="Status">
                    <option value="idea">Idea</option>
                    <option value="planned">Planned</option>
                    <option value="created">Created</option>
                  </NativeSelect>
                  <div className="flex items-center gap-2">
                    <SourceBadge source={c.source} />
                    <button type="button" onClick={() => set({ content: d.content.filter((x) => x.id !== c.id) })} className="text-muted-foreground hover:text-destructive" aria-label="Delete">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No content ideas yet.</p>
          )}
        </TabsContent>
        <TabsContent value="notes" className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="grid gap-2 p-4">
            <p className="text-sm font-semibold">Research notes</p>
            <Textarea rows={16} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="What you've read, heard from customers, seen in communities and reviews…" data-testid="niche-notes" />
          </Card>
          <Card className="grid content-start gap-3 p-4">
            <p className="text-sm font-semibold">Sources</p>
            <ul className="grid gap-2">
              {d.references.map((r) => (
                <li key={r.id} className="flex items-start gap-2 rounded-md border p-2 text-[13px]">
                  <Link2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title || r.url}</p>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 truncate text-xs text-primary">
                        {r.url} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                  <button type="button" onClick={() => set({ references: d.references.filter((x) => x.id !== r.id) })} className="text-muted-foreground hover:text-destructive" aria-label="Remove source">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!ref.title.trim() && !ref.url.trim()) return;
                const url = ref.url.trim();
                if (url && !/^https?:\/\//i.test(url)) return toast.error("Links must start with http:// or https://");
                set({ references: [...d.references, { id: uid("ref"), title: ref.title.trim(), url, notes: "", addedAt: nowIso() }] });
                setRef({ title: "", url: "" });
              }}
            >
              <Input value={ref.title} onChange={(e) => setRef({ ...ref, title: e.target.value })} placeholder="Title" className="h-8 text-xs" />
              <Input value={ref.url} onChange={(e) => setRef({ ...ref, url: e.target.value })} placeholder="https://…" className="h-8 text-xs" />
              <Button size="sm" type="submit" variant="outline">
                <Plus /> Add source
              </Button>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function exportResearch(d: NicheResearchData, title: string, format: "md" | "docx" | "pdf") {
  const md = researchMarkdown(d, title);
  if (format === "md") return textFile(md, safeFileName(title, "md"), "text/markdown");
  return exportDocument({ title, chapters: [{ title: "Niche research", content: markdownToDoc(md.replace(/^# .*\n/, "")) }] }, format, { ...loadDocExportOptions(), toc: false });
}

export function NicheResearch({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="niche-research"
      tool="Niche Research"
      eyebrow="Research Studio"
      icon={<Compass />}
      description="Explore a niche: record audience needs and problems, compare product ideas with your own weighted scores, build personas, organise content ideas and keep your notes and sources together."
      createLabel="New niche research"
      onCreate={async () => (await createAsset(project.id, "niche-research", { title: project.niche ? `${project.niche} research` : "Niche research", data: { niche: project.niche, audience: project.audience } })).id}
      itemMeta={(a) => `${a.data.niche || "No niche set"} · ${a.data.needs.length + a.data.problems.length} findings · ${a.data.ideas.length} ideas`}
      renderEditor={(editor) => <NicheEditor editor={editor} project={project} />}
      versionText={(x) => researchMarkdown(x as NicheResearchData, "Version")}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "pdf", label: "PDF summary", run: () => exportResearch(editor.getData()!, editor.title, "pdf") },
            { id: "docx", label: "Word (.docx)", run: () => exportResearch(editor.getData()!, editor.title, "docx") },
            { id: "md", label: "Markdown", run: () => exportResearch(editor.getData()!, editor.title, "md") },
          ]}
        />
      )}
    />
  );
}

