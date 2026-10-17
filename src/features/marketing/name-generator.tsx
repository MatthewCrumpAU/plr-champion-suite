"use client";

import * as React from "react";
import { CheckCircle2, ClipboardCopy, LayoutTemplate, Plus, Sparkles, Star, Tags, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { NameCategory, NameIdea, NameIdeasData } from "@/lib/models/marketing";
import { NAME_CATEGORY_LABELS } from "@/lib/models/marketing";
import { NAME_CATEGORIES } from "@/lib/ai/tasks";
import { namesText, templateNames } from "@/lib/marketing/names";
import { useAITask, useAIStatus, parseJsonLoose } from "@/lib/ai/client";
import { useAssets, useBrandKit } from "@/lib/data/hooks";
import { createAsset, mutateAssetData, updateAsset } from "@/lib/services/assets";
import { updateProject } from "@/lib/services/projects";
import { updateBrandKit } from "@/lib/services/brand-kits";
import { fillBoundText } from "@/lib/covers/templates";
import { safeFileName, textFile } from "@/lib/export/download";
import { Button } from "@/components/ui/button";
import { Badge, Card, Checkbox, EmptyState, Field, Input } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, Tabs, TabsList, TabsTrigger, Tooltip } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import { AIRunStatus, AIUsageLine } from "@/components/common/ai";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage, nowIso, uid } from "@/lib/utils";

interface ApplyTarget {
  id: string;
  label: string;
  current: string;
  run: (value: string) => Promise<unknown>;
}

function useApplyTargets(project: Project, category: NameCategory): ApplyTarget[] {
  const { data: docs } = useAssets<"document">(project.id, "document");
  const { data: covers } = useAssets<"cover">(project.id, "cover");
  const { data: sales } = useAssets<"sales-page">(project.id, "sales-page");
  const { data: kit } = useBrandKit(project.brandKitId);
  const main = docs?.find((d) => d.id === project.mainDocumentId) ?? docs?.find((d) => d.data.role === "main");
  const cover = covers?.find((c) => c.id === project.coverAssetId) ?? covers?.[0];
  const coverText = (bind: "title" | "subtitle" | "tagline") => (cover?.data.elements.find((e) => e.type === "text" && e.bind === bind) as { text?: string } | undefined)?.text ?? "";
  const setCover = (bind: "title" | "subtitle" | "tagline") => async (v: string) => cover && mutateAssetData<"cover">(cover.id, (d) => ({ ...fillBoundText(d, { [bind]: v }), thumbnail: null }));
  const t: ApplyTarget[] = [];
  if (category === "subtitle") {
    if (main) t.push({ id: "doc-subtitle", label: `Subtitle of “${main.title}”`, current: main.data.subtitle, run: (v) => mutateAssetData<"document">(main.id, (d) => ({ ...d, subtitle: v })) });
    if (cover && coverText("subtitle") !== "") t.push({ id: "cover-subtitle", label: `Cover subtitle (${cover.title})`, current: coverText("subtitle"), run: setCover("subtitle") });
  } else if (category === "tagline") {
    if (kit) t.push({ id: "kit-tagline", label: `Brand kit tagline (${kit.name})`, current: kit.tagline, run: (v) => updateBrandKit(kit.id, { tagline: v }) });
    if (cover && coverText("tagline") !== "") t.push({ id: "cover-tagline", label: `Cover tagline (${cover.title})`, current: coverText("tagline"), run: setCover("tagline") });
  } else {
    t.push({ id: "project-name", label: "Project name", current: project.name, run: (v) => updateProject(project.id, { name: v }) });
    if (main) t.push({ id: "doc-title", label: `Main document title`, current: main.title, run: (v) => updateAsset(main.id, { title: v }) });
    if (cover) t.push({ id: "cover-title", label: `Cover title (${cover.title})`, current: coverText("title"), run: setCover("title") });
    for (const s of (sales ?? []).slice(0, 3)) t.push({ id: `sales-${s.id}`, label: `Sales page product name (${s.title})`, current: s.data.productName, run: (v) => mutateAssetData<"sales-page">(s.id, (d) => ({ ...d, productName: v })) });
  }
  return t;
}

function NameRow({ n, onChange, onDelete, targets, onApplied }: { n: NameIdea; onChange: (p: Partial<NameIdea>) => void; onDelete: () => void; targets: ApplyTarget[]; onApplied: (label: string) => void }) {
  const confirm = useConfirm();
  return (
    <li className={cn("flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2", n.favourite && "border-amber-300 bg-amber-50/40")} data-testid="name-idea">
      <button type="button" onClick={() => onChange({ favourite: !n.favourite })} aria-label={n.favourite ? "Remove from favourites" : "Add to favourites"} data-testid="name-favourite">
        <Star className={cn("size-4", n.favourite ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50 hover:text-amber-400")} />
      </button>
      <div className="min-w-0 flex-1">
        <Input value={n.name} onChange={(e) => onChange({ name: e.target.value })} className="h-8 border-transparent px-1 text-[14.5px] font-semibold hover:border-border" aria-label="Name" />
        <p className="truncate px-1 text-[11px] text-muted-foreground">
          {n.note}
          {n.appliedTo && (
            <span className="ml-2 inline-flex items-center gap-1 text-green-700">
              <CheckCircle2 className="size-3" /> Applied to {n.appliedTo}
            </span>
          )}
        </p>
      </div>
      {n.source === "ai" ? <Badge variant="ai">AI</Badge> : n.source === "template" ? <Badge variant="outline">Template</Badge> : <Badge variant="secondary">Yours</Badge>}
      <Tooltip content="Copy">
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(n.name);
            toast.success("Copied");
          }}
          aria-label="Copy name"
        >
          <ClipboardCopy />
        </Button>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="xs" variant="outline" disabled={!targets.length} data-testid="name-apply">
            Apply
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Use this name for…</DropdownMenuLabel>
          {targets.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onSelect={async () => {
                const ok = await confirm({ title: `Apply to ${t.label}?`, description: t.current ? `“${t.current}” will be replaced with “${n.name}”.` : `It will be set to “${n.name}”.`, confirmLabel: "Apply" });
                if (!ok) return;
                try {
                  await t.run(n.name);
                  onApplied(t.label);
                  toast.success(`Applied to ${t.label}`);
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              <span className="min-w-0">
                <span className="block truncate">{t.label}</span>
                {t.current && <span className="block truncate text-[11px] text-muted-foreground">Now: {t.current}</span>}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="icon-xs" variant="ghost" onClick={onDelete} aria-label="Delete name">
        <Trash2 />
      </Button>
    </li>
  );
}

function NamesEditor({ editor, project }: { editor: AssetEditor<"name-ideas">; project: Project }) {
  const d = editor.data!;
  const set = (p: Partial<NameIdeasData>) => editor.update((x) => ({ ...x, ...p }));
  const [category, setCategory] = React.useState<NameCategory>("product-title");
  const [favOnly, setFavOnly] = React.useState(false);
  const [style, setStyle] = React.useState("");
  const [manual, setManual] = React.useState("");
  const { configured } = useAIStatus();
  const ai = useAITask("marketing.names");
  const targets = useApplyTargets(project, category);
  const patch = (id: string, p: Partial<NameIdea>) => editor.update((x) => ({ ...x, ideas: x.ideas.map((i) => (i.id === id ? { ...i, ...p } : i)) }));

  React.useEffect(() => {
    if (!d.topic && !d.audience) set({ topic: project.niche, audience: project.audience, format: project.productType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fromTemplates = () => {
    if (!d.topic.trim()) return toast.error("Enter a topic first.");
    const list = templateNames(category, d, d.ideas.map((i) => i.name));
    set({ ideas: [...list, ...d.ideas] });
    toast.success(list.length ? `Added ${list.length} ${NAME_CATEGORY_LABELS[category].toLowerCase()}` : "All template ideas for this category are already listed");
  };
  const fromAI = async () => {
    if (d.topic.trim().length < 2) return toast.error("Enter a topic first.");
    const r = await ai.run({ category, topic: d.topic, audience: d.audience, outcome: d.outcome, format: d.format, style, count: 15, avoid: d.ideas.filter((i) => i.category === category).map((i) => i.name) }, project.id);
    if (!r) return;
    try {
      const arr = parseJsonLoose<{ name?: string; note?: string }[]>(r.text);
      const seen = new Set(d.ideas.map((i) => i.name.toLowerCase()));
      const list: NameIdea[] = (Array.isArray(arr) ? arr : [])
        .filter((x) => x?.name && !seen.has(String(x.name).toLowerCase()))
        .map((x) => ({ id: uid("nm"), category, name: String(x.name).trim(), note: String(x.note ?? ""), favourite: false, source: "ai", appliedTo: null, createdAt: nowIso() }));
      if (!list.length) throw new Error("No new names came back. Try changing the style or topic.");
      set({ ideas: [...list, ...d.ideas] });
      toast.success(`Added ${list.length} AI ideas`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const list = d.ideas.filter((i) => i.category === category && (!favOnly || i.favourite));
  const favourites = d.ideas.filter((i) => i.favourite);
  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1200px] gap-5 px-4 py-6 sm:px-6">
      <Card className="grid gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Topic" htmlFor="nm-topic">
            <Input id="nm-topic" value={d.topic} onChange={(e) => set({ topic: e.target.value })} placeholder="e.g. Remote work productivity" data-testid="name-topic" />
          </Field>
          <Field label="Audience" htmlFor="nm-aud" optional>
            <Input id="nm-aud" value={d.audience} onChange={(e) => set({ audience: e.target.value })} />
          </Field>
          <Field label="Outcome / promise" htmlFor="nm-out" optional hint="What the buyer gets, e.g. “finish work by five”">
            <Input id="nm-out" value={d.outcome} onChange={(e) => set({ outcome: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Format" htmlFor="nm-fmt" optional>
              <Input id="nm-fmt" value={d.format} onChange={(e) => set({ format: e.target.value })} placeholder="ebook" />
            </Field>
            <Field label="Style (AI)" htmlFor="nm-style" optional>
              <Input id="nm-style" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="calm, warm" />
            </Field>
          </div>
        </div>
      </Card>
      <Tabs value={category} onValueChange={(v) => setCategory(v as NameCategory)}>
        <TabsList className="flex-wrap">
          {NAME_CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>
              {NAME_CATEGORY_LABELS[c]} ({d.ideas.filter((i) => i.category === c).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={fromTemplates} data-testid="name-template">
          <LayoutTemplate /> Generate from templates
        </Button>
        <Tooltip content={configured ? "Ask Claude for more ideas" : "Configure AI in Settings to enable"}>
          <span>
            <Button variant="gradient" onClick={() => void fromAI()} disabled={!configured || ai.running} data-testid="name-ai">
              <Sparkles /> Generate with AI
            </Button>
          </span>
        </Tooltip>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!manual.trim()) return;
            set({ ideas: [{ id: uid("nm"), category, name: manual.trim(), note: "", favourite: false, source: "manual", appliedTo: null, createdAt: nowIso() }, ...d.ideas] });
            setManual("");
          }}
        >
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Add your own idea" className="h-9 w-56" />
          <Button type="submit" variant="ghost" size="icon" aria-label="Add name">
            <Plus />
          </Button>
        </form>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Checkbox checked={favOnly} onCheckedChange={(v) => setFavOnly(!!v)} /> Favourites only ({favourites.length})
        </label>
      </div>
      <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void ai.retry()} label="Brainstorming names…" />
      <AIUsageLine result={ai.result} />
      {list.length ? (
        <ul className="grid gap-2" data-testid="name-list">
          {list.map((n) => (
            <NameRow key={n.id} n={n} onChange={(p) => patch(n.id, p)} onDelete={() => set({ ideas: d.ideas.filter((i) => i.id !== n.id) })} targets={targets} onApplied={(label) => patch(n.id, { appliedTo: label })} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Wand2 />} title={favOnly ? "No favourites in this category" : `No ${NAME_CATEGORY_LABELS[category].toLowerCase()} yet`} description="Fill in the topic and generate ideas from templates or with AI, or add your own." />
      )}
    </div>
  );
}

export function NameGenerator({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="name-ideas"
      tool="Product Name Generator"
      eyebrow="Marketing Studio"
      icon={<Tags />}
      description="Brainstorm product titles, subtitles, taglines, offer, bundle, course and lead magnet names. Star your favourites and apply one to your project, document, cover or sales page in one click."
      createLabel="New name list"
      onCreate={async () => (await createAsset(project.id, "name-ideas", { title: "Name ideas", data: { topic: project.niche, audience: project.audience, format: project.productType } })).id}
      itemMeta={(a) => `${a.data.ideas.length} ideas · ${a.data.ideas.filter((i) => i.favourite).length} favourites`}
      renderEditor={(editor) => <NamesEditor editor={editor} project={project} />}
      versionText={(x) => ((x as NameIdeasData).ideas ?? []).map((i) => `${i.favourite ? "★ " : ""}${i.name} (${NAME_CATEGORY_LABELS[i.category]})`).join("\n")}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            {
              id: "txt",
              label: "All names (.txt)",
              run: () => textFile(namesText(editor.getData()!), safeFileName(editor.title, "txt")),
            },
            { id: "fav", label: "Favourites only (.txt)", run: () => textFile(editor.getData()!.ideas.filter((i) => i.favourite).map((i) => `${i.name} — ${NAME_CATEGORY_LABELS[i.category]}`).join("\n"), safeFileName(`${editor.title} favourites`, "txt")) },
          ]}
        />
      )}
    />
  );
}
