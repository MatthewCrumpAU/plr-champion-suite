"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCopy, Copy, LayoutTemplate, Link2, Megaphone, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { SocialCampaignData, SocialPlatform, SocialPost, SocialPostType, SocialSeries } from "@/lib/models/marketing";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/models/marketing";
import { SOCIAL_KINDS, SOCIAL_PLATFORMS } from "@/lib/ai/tasks";
import { autoSchedule, isoDay, monthGrid, socialCsv, socialMarkdown, templatePosts, type SocialContext } from "@/lib/marketing/social";
import { useAITask, useAIStatus, parseJsonLoose } from "@/lib/ai/client";
import { useAssets } from "@/lib/data/hooks";
import { assetHref, assetInfo } from "@/lib/data/asset-types";
import { createAsset } from "@/lib/services/assets";
import { safeFileName, textFile } from "@/lib/export/download";
import { Button } from "@/components/ui/button";
import { Badge, Card, Checkbox, EmptyState, Field, Input, NativeSelect, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from "@/components/ui/overlays";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import { AIRunStatus, AIUsageLine, useBrief } from "@/components/common/ai";
import { SourcePicker, chaptersToMarkdown, selectedChapters, type SourceSelection } from "@/components/common/source-picker";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, errorMessage, uid } from "@/lib/utils";

type Kind = (typeof SOCIAL_KINDS)[number];
const KIND_LABELS: Record<Kind, string> = { educational: "Educational posts", promotional: "Promotional posts", announcement: "Announcements", series: "Content series", mixed: "Mixed mix" };
const PLATFORM_COLOR: Record<SocialPlatform, string> = { facebook: "#1877f2", instagram: "#d6249f", linkedin: "#0a66c2", "video-script": "#111827" };
const LIMITS: Record<SocialPlatform, number> = { facebook: 63206, instagram: 2200, linkedin: 3000, "video-script": 1200 };
const STATUS_LABELS: Record<SocialPost["status"], string> = { idea: "Idea", draft: "Draft", scheduled: "Scheduled", posted: "Posted" };
const SERIES_COLORS = ["#5b4df5", "#0ea5e9", "#16a34a", "#f59e0b", "#e11d48", "#8b5cf6"];

function PostEditor({ p, onChange, onDuplicate, onDelete, series, assets }: { p: SocialPost; onChange: (x: Partial<SocialPost>) => void; onDuplicate: () => void; onDelete: () => void; series: SocialSeries[]; assets: { id: string; title: string; type: string }[] }) {
  const over = p.text.length > LIMITS[p.platform];
  const linked = assets.find((a) => a.id === p.linkedAssetId);
  return (
    <Card className="grid gap-2.5 p-3.5" data-testid="social-post">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ background: PLATFORM_COLOR[p.platform] }} />
        <NativeSelect value={p.platform} onChange={(e) => onChange({ platform: e.target.value as SocialPlatform })} className="h-7 w-auto text-xs" aria-label="Platform">
          {SOCIAL_PLATFORMS.map((x) => (
            <option key={x} value={x}>
              {SOCIAL_PLATFORM_LABELS[x]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={p.type} onChange={(e) => onChange({ type: e.target.value as SocialPostType })} className="h-7 w-auto text-xs" aria-label="Post type">
          {(["educational", "promotional", "announcement", "engagement"] as const).map((x) => (
            <option key={x} value={x}>
              {x[0].toUpperCase() + x.slice(1)}
            </option>
          ))}
        </NativeSelect>
        {p.source === "ai" && <Badge variant="ai">AI</Badge>}
        <div className="ml-auto flex gap-0.5">
          <Tooltip content="Copy text">
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(`${p.text}${p.hashtags.length ? `\n\n${p.hashtags.map((h) => `#${h}`).join(" ")}` : ""}`);
                toast.success("Copied");
              }}
              aria-label="Copy post"
            >
              <ClipboardCopy />
            </Button>
          </Tooltip>
          <Button size="icon-xs" variant="ghost" onClick={onDuplicate} aria-label="Duplicate post">
            <Copy />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={onDelete} aria-label="Delete post">
            <Trash2 />
          </Button>
        </div>
      </div>
      <Textarea rows={7} value={p.text} onChange={(e) => onChange({ text: e.target.value })} className="text-[13px] leading-relaxed" aria-label="Post text" />
      <div className="flex items-center justify-between text-[11px]">
        <span className={cn(over ? "font-medium text-destructive" : "text-muted-foreground")}>
          {p.text.length.toLocaleString()} / {LIMITS[p.platform].toLocaleString()} characters
        </span>
        {(p.text.match(/\[[^\]]+\]/g)?.length ?? 0) > 0 && <span className="text-amber-700">Has [placeholders] to fill in</span>}
      </div>
      <Input value={p.hashtags.map((h) => `#${h}`).join(" ")} onChange={(e) => onChange({ hashtags: e.target.value.split(/[\s,]+/).map((h) => h.replace(/^#/, "")).filter(Boolean) })} placeholder="#hashtags" className="h-8 text-xs" aria-label="Hashtags" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={p.scheduledFor ?? ""} onChange={(e) => onChange({ scheduledFor: e.target.value || null, status: e.target.value && (p.status === "idea" || p.status === "draft") ? "scheduled" : p.status })} className="h-8 text-xs" aria-label="Scheduled date" />
        <NativeSelect value={p.status} onChange={(e) => onChange({ status: e.target.value as SocialPost["status"] })} className="h-8 text-xs" aria-label="Status">
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={p.seriesId ?? ""} onChange={(e) => onChange({ seriesId: e.target.value || null })} className="h-8 text-xs" aria-label="Series">
          <option value="">No series</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={p.linkedAssetId ?? ""} onChange={(e) => onChange({ linkedAssetId: e.target.value || null })} className="h-8 text-xs" aria-label="Linked asset">
          <option value="">Link a project asset…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {assetInfo(a.type as never).label}: {a.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      {linked && (
        <Link href={assetHref(linked as never)} className="flex items-center gap-1 text-[11px] font-medium text-primary">
          <Link2 className="size-3" /> {linked.title}
        </Link>
      )}
    </Card>
  );
}

function CalendarView({ d, set, onOpen }: { d: SocialCampaignData; set: (p: Partial<SocialCampaignData>) => void; onOpen: (id: string) => void }) {
  const today = isoDay(new Date());
  const firstScheduled = d.posts.map((p) => p.scheduledFor).filter(Boolean).sort()[0];
  const [month, setMonth] = React.useState((firstScheduled ?? today).slice(0, 7));
  const [start, setStart] = React.useState(today);
  const [every, setEvery] = React.useState(1);
  const grid = monthGrid(month);
  const byDay = React.useMemo(() => {
    const m = new Map<string, SocialPost[]>();
    for (const p of d.posts) if (p.scheduledFor) m.set(p.scheduledFor, [...(m.get(p.scheduledFor) ?? []), p]);
    return m;
  }, [d.posts]);
  const unscheduled = d.posts.filter((p) => !p.scheduledFor);
  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const dt = new Date(y, m - 1 + n, 1);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  };
  const drop = (day: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/post-id");
    if (!id) return;
    set({ posts: d.posts.map((p) => (p.id === id ? { ...p, scheduledFor: day, status: day ? (p.status === "idea" || p.status === "draft" ? "scheduled" : p.status) : p.status === "scheduled" ? "draft" : p.status } : p)) });
  };
  const chip = (p: SocialPost) => (
    <button
      key={p.id}
      type="button"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/post-id", p.id)}
      onClick={() => onOpen(p.id)}
      className={cn("flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10.5px] hover:bg-secondary", p.status === "posted" && "line-through opacity-60")}
      title={p.text.slice(0, 200)}
      data-testid="calendar-chip"
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: d.series.find((s) => s.id === p.seriesId)?.color ?? PLATFORM_COLOR[p.platform] }} />
      <span className="truncate">{p.text.split("\n")[0]}</span>
    </button>
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <Card className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <Button size="icon-sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <p className="min-w-40 text-center font-semibold">{new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
          <Button size="icon-sm" variant="ghost" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight />
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setMonth(today.slice(0, 7))}>
            Today
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-[11px]" data-testid="social-calendar">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <div key={w} className="bg-secondary px-2 py-1 font-medium text-muted-foreground">
              {w}
            </div>
          ))}
          {grid.map((c) => (
            <div key={c.day} onDragOver={(e) => e.preventDefault()} onDrop={drop(c.day)} className={cn("min-h-24 bg-card p-1", !c.inMonth && "bg-secondary/40 text-muted-foreground", c.day === today && "ring-2 ring-inset ring-primary/40")} data-day={c.day}>
              <p className="px-1 text-[11px] font-medium">{Number(c.day.slice(8))}</p>
              <div className="grid gap-0.5">{(byDay.get(c.day) ?? []).map(chip)}</div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid content-start gap-4">
        <Card className="grid gap-2 p-3" onDragOver={(e) => e.preventDefault()} onDrop={drop(null)}>
          <p className="text-sm font-semibold">Unscheduled ({unscheduled.length})</p>
          <p className="text-[11px] text-muted-foreground">Drag posts onto a day. Drag back here to unschedule.</p>
          <div className="plr-scroll grid max-h-72 gap-0.5 overflow-y-auto" data-testid="unscheduled">
            {unscheduled.map(chip)}
          </div>
        </Card>
        <Card className="grid gap-2 p-3">
          <p className="text-sm font-semibold">Auto-schedule</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field label="Every (days)">
              <Input type="number" min={1} max={14} value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))} className="h-8 text-xs" />
            </Field>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!unscheduled.length}
            onClick={() => {
              set({ posts: autoSchedule(d.posts, start, every) });
              setMonth(start.slice(0, 7));
              toast.success(`Scheduled ${unscheduled.length} posts`);
            }}
            data-testid="auto-schedule"
          >
            <CalendarDays /> Schedule {unscheduled.length} posts
          </Button>
        </Card>
      </div>
    </div>
  );
}

function SocialEditor({ editor, project }: { editor: AssetEditor<"social-campaign">; project: Project }) {
  const d = editor.data!;
  const set = (p: Partial<SocialCampaignData>) => editor.update((x) => ({ ...x, ...p }));
  const patch = (id: string, p: Partial<SocialPost>) => editor.update((x) => ({ ...x, posts: x.posts.map((y) => (y.id === id ? { ...y, ...p } : y)) }));
  const { data: docs } = useAssets<"document">(project.id, "document");
  const { data: allAssets } = useAssets(project.id);
  const assets = (allAssets ?? []).filter((a) => a.id !== editor.asset?.id).map((a) => ({ id: a.id, title: a.title, type: a.type }));
  const [source, setSource] = React.useState<SourceSelection>({ documentId: null, chapterIds: [] });
  const [platforms, setPlatforms] = React.useState<SocialPlatform[]>(["facebook", "instagram", "linkedin"]);
  const [kind, setKind] = React.useState<Kind>("mixed");
  const [count, setCount] = React.useState(6);
  const [link, setLink] = React.useState("");
  const [extra, setExtra] = React.useState("");
  const [seriesName, setSeriesName] = React.useState("");
  const [platformFilter, setPlatformFilter] = React.useState<SocialPlatform | "">("");
  const [statusFilter, setStatusFilter] = React.useState<SocialPost["status"] | "">("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const { configured } = useAIStatus();
  const ai = useAITask("marketing.social");
  const brief = useBrief(project.id);
  const main = docs?.find((x) => x.id === project.mainDocumentId) ?? docs?.[0];
  const context: SocialContext = { productName: main?.title ?? project.name.replace(/^SAMPLE\s*[—-]\s*/i, ""), audience: project.audience, niche: project.niche, link };
  const chosen = selectedChapters(docs, source);

  const ensureSeries = (): string | null => {
    if (kind !== "series") return null;
    const name = seriesName.trim() || `${context.productName} series`;
    const existing = d.series.find((s) => s.name === name);
    if (existing) return existing.id;
    const s: SocialSeries = { id: uid("ser"), name, color: SERIES_COLORS[d.series.length % SERIES_COLORS.length] };
    editor.update((x) => ({ ...x, series: [...x.series, s] }));
    return s.id;
  };

  const fromTemplate = () => {
    if (!platforms.length) return toast.error("Choose at least one platform.");
    const seriesId = ensureSeries();
    const posts = templatePosts({ sources: chosen, platforms, kind, count, context, seriesId });
    editor.update((x) => ({ ...x, posts: [...x.posts, ...posts] }));
    toast.success(`Added ${posts.length} posts from templates`);
  };

  const fromAI = async () => {
    if (!platforms.length) return toast.error("Choose at least one platform.");
    const r = await ai.run({ platforms, kind, count, sourceText: chaptersToMarkdown(chosen, 25_000), extra: [link && `Link to use: ${link}`, extra].filter(Boolean).join("\n"), brief }, project.id);
    if (!r) return;
    try {
      const arr = parseJsonLoose<{ platform?: string; type?: string; text?: string; hashtags?: string[] }[]>(r.text);
      const seriesId = ensureSeries();
      const posts: SocialPost[] = (Array.isArray(arr) ? arr : [])
        .filter((x) => x?.text)
        .map((x) => ({
          id: uid("post"),
          platform: (SOCIAL_PLATFORMS as readonly string[]).includes(String(x.platform)) ? (x.platform as SocialPlatform) : platforms[0],
          type: (["educational", "promotional", "announcement", "engagement"] as string[]).includes(String(x.type)) ? (x.type as SocialPostType) : "educational",
          text: String(x.text),
          hashtags: Array.isArray(x.hashtags) ? x.hashtags.map((h) => String(h).replace(/^#/, "")).filter(Boolean).slice(0, 10) : [],
          scheduledFor: null,
          status: "draft",
          seriesId,
          linkedAssetId: null,
          source: "ai",
          notes: "",
        }));
      if (!posts.length) throw new Error("The AI response didn't contain any posts. Try again.");
      editor.update((x) => ({ ...x, posts: [...x.posts, ...posts] }));
      toast.success(`Added ${posts.length} AI posts as drafts`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const visible = d.posts.filter((p) => (!platformFilter || p.platform === platformFilter) && (!statusFilter || p.status === statusFilter));
  const open = d.posts.find((p) => p.id === openId) ?? null;
  const dup = (p: SocialPost) => editor.update((x) => ({ ...x, posts: [...x.posts, { ...p, id: uid("post"), scheduledFor: null, status: "draft" }] }));
  const del = (id: string) => editor.update((x) => ({ ...x, posts: x.posts.filter((p) => p.id !== id) }));

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] w-full max-w-[1400px] gap-5 px-4 py-6 sm:px-6">
      <Card className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_1fr]">
        <SourcePicker projectId={project.id} value={source} onChange={setSource} maxHeight={180} label="Repurpose these chapters" />
        <div className="grid content-start gap-3">
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium">Platforms</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {SOCIAL_PLATFORMS.map((pl) => (
                <label key={pl} className="flex items-center gap-1.5 text-[13px]">
                  <Checkbox checked={platforms.includes(pl)} onCheckedChange={(v) => setPlatforms((x) => (v ? [...x, pl] : x.filter((y) => y !== pl)))} /> {SOCIAL_PLATFORM_LABELS[pl]}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-2">
            <Field label="Kind of content">
              <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as Kind)} data-testid="social-kind">
                {SOCIAL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="How many">
              <Input type="number" min={1} max={30} value={count} onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
            </Field>
          </div>
          {kind === "series" && (
            <Field label="Series name">
              <Input value={seriesName} onChange={(e) => setSeriesName(e.target.value)} placeholder={`${context.productName} series`} className="h-8 text-sm" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Link to promote" optional>
              <Input value={link} onChange={(e) => setLink(e.target.value.trim())} placeholder="https://" className="h-8 text-sm" />
            </Field>
            <Field label="AI instructions" optional>
              <Input value={extra} onChange={(e) => setExtra(e.target.value)} className="h-8 text-sm" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fromTemplate} data-testid="social-template">
              <LayoutTemplate /> Create from templates
            </Button>
            <Tooltip content={configured ? "Repurpose the selected chapters with AI" : "Configure AI in Settings to enable"}>
              <span>
                <Button variant="gradient" onClick={() => void fromAI()} disabled={!configured || ai.running} data-testid="social-ai">
                  <Sparkles /> Generate with AI
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="ghost"
              onClick={() => {
                const p: SocialPost = { id: uid("post"), platform: platforms[0] ?? "facebook", type: "educational", text: "", hashtags: [], scheduledFor: null, status: "idea", seriesId: null, linkedAssetId: null, source: "manual", notes: "" };
                editor.update((x) => ({ ...x, posts: [p, ...x.posts] }));
              }}
            >
              <Plus /> Blank post
            </Button>
          </div>
          <AIRunStatus running={ai.running} error={ai.error} onCancel={ai.cancel} onRetry={() => void ai.retry()} label="Writing posts…" />
          <AIUsageLine result={ai.result} />
        </div>
      </Card>

      <Tabs defaultValue="posts">
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="posts">Posts ({d.posts.length})</TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar">
              Calendar
            </TabsTrigger>
          </TabsList>
          {d.series.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Series:</span>
              {d.series.map((s) => (
                <Badge key={s.id} variant="outline" className="gap-1">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  {s.name} ({d.posts.filter((p) => p.seriesId === s.id).length})
                </Badge>
              ))}
            </div>
          )}
        </div>
        <TabsContent value="posts" className="mt-4 grid gap-3">
          <div className="flex flex-wrap gap-2">
            <NativeSelect value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as SocialPlatform | "")} className="h-8 w-auto text-xs" aria-label="Platform filter">
              <option value="">All platforms</option>
              {SOCIAL_PLATFORMS.map((x) => (
                <option key={x} value={x}>
                  {SOCIAL_PLATFORM_LABELS[x]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as SocialPost["status"] | "")} className="h-8 w-auto text-xs" aria-label="Status filter">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </div>
          {visible.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="social-posts">
              {visible.map((p) => (
                <PostEditor key={p.id} p={p} onChange={(x) => patch(p.id, x)} onDuplicate={() => dup(p)} onDelete={() => del(p.id)} series={d.series} assets={assets} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Megaphone />} title="No posts yet" description="Pick some chapters and platforms above, then create posts from templates or with AI." />
          )}
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <CalendarView d={d} set={set} onOpen={setOpenId} />
        </TabsContent>
      </Tabs>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
          </DialogHeader>
          {open && (
            <PostEditor
              p={open}
              onChange={(x) => patch(open.id, x)}
              onDuplicate={() => dup(open)}
              onDelete={() => {
                del(open.id);
                setOpenId(null);
              }}
              series={d.series}
              assets={assets}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SocialContentCreator({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="social-campaign"
      tool="Social Content Creator"
      eyebrow="Marketing Studio"
      icon={<Megaphone />}
      description="Repurpose your PLR into Facebook posts, Instagram captions, LinkedIn posts, short video scripts, content series, announcements and educational posts — then plan them on an editable calendar."
      createLabel="New content plan"
      onCreate={async () => (await createAsset(project.id, "social-campaign", { title: "Social content plan" })).id}
      itemMeta={(a) => `${a.data.posts.length} posts · ${a.data.posts.filter((p) => p.scheduledFor).length} scheduled`}
      renderEditor={(editor) => <SocialEditor editor={editor} project={project} />}
      versionText={(x) => socialMarkdown(x as SocialCampaignData, "Version")}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "csv", label: "CSV (calendar)", run: () => textFile(socialCsv(editor.getData()!), safeFileName(editor.title, "csv"), "text/csv") },
            { id: "md", label: "Markdown", run: () => textFile(socialMarkdown(editor.getData()!, editor.title), safeFileName(editor.title, "md"), "text/markdown") },
          ]}
        />
      )}
    />
  );
}

