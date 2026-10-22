"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, CircleDashed, CopyPlus, Download, Eye, FileArchive, FolderInput, Megaphone, Pencil, Plug, Plus, RefreshCcw, Rocket, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Field, Input, NativeSelect, PageContainer, PageHeader, Switch, Textarea } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm";
import { FileDrop } from "@/components/common/file-drop";
import { SaveStatus } from "@/components/common/save-status";
import { useProjects } from "@/lib/data/hooks";
import { downloadBlob } from "@/lib/export/download";
import { useMemberLive } from "@/lib/membership/hooks";
import { deleteMemberFiles, MAX_IMAGE_BYTES, MAX_PRODUCT_FILE_BYTES, storeMemberFile } from "@/lib/membership/files";
import { ACCESS_TIER_LABELS, ACCESS_TIERS, type AccessTier } from "@/lib/membership/types";
import { SALES_SECTION_LABELS, SOCIAL_PLATFORM_LABELS, type SocialPlatform, type SocialPostType } from "@/lib/models/marketing";
import { BYLDITY_APPS, campaignHandoffs, getConnector } from "@/lib/integrations/byldity";
import { buildCalendar, campaignFromProject, campaignKit, campaignLaunchDate, campaignSections, CAMPAIGN_SECTIONS, dayText, deleteCampaign, duplicateCampaign, entryDate, newCampaign, regenerateSection, saveCampaign, sortCalendar, storeCampaignFile, type CampaignSectionKey } from "@/lib/lab/campaigns";
import { dayLabel, monthLabel, monthOf, nextMonth } from "@/lib/lab/dates";
import { CALENDAR_CHANNEL_LABELS, CAMPAIGN_PHASE_LABELS, CAMPAIGN_PHASES, type CalendarChannel, type CampaignDrop, type CampaignFile, type CampaignChecklistPhase } from "@/lib/lab/types";
import { cn, errorMessage, formatBytes, plural, uid } from "@/lib/utils";
import { useMember } from "@/features/membership/member-context";
import { AdminGate } from "@/features/membership/admin/admin-gate";
import { fromLocalInput, toLocalInput } from "@/features/membership/admin/product-editor";
import { useDraft } from "@/features/membership/admin/use-draft";
import { StatusBadge, StoredImage } from "@/features/membership/ui";
import { downloadText, Loading } from "../lab-ui";
import { SECTION_ICONS } from "../campaigns";
import { EditorRow, LinesField, move, RowControls } from "./fields";

/* ------------------------------------------------------------------------------------------ */
/* List                                                                                         */
/* ------------------------------------------------------------------------------------------ */

export function CampaignsAdmin() {
  return (
    <AdminGate>
      <CampaignList />
    </AdminGate>
  );
}

function CampaignList() {
  const m = useMember();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: campaigns, loading } = useMemberLive(async (r) => (await r.campaigns.list(m.brandId)).sort((a, b) => b.month.localeCompare(a.month) || b.updatedAt.localeCompare(a.updatedAt)), [m.brandId]);
  const { data: projects } = useProjects();
  const [month, setMonth] = React.useState(monthOf(new Date(), 1));
  const [projectId, setProjectId] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  if (loading || !campaigns) return <Loading />;

  const create = async (fromProject: boolean) => {
    if (!/^\d{4}-\d{2}$/.test(month)) return toast.error("Choose a month.");
    setBusy(fromProject ? "project" : "blank");
    try {
      const c = fromProject ? await campaignFromProject(projectId, { brandId: m.brandId, month }) : await saveCampaign(newCampaign(m.brandId, month));
      toast.success(fromProject ? "Campaign built from your project" : "Campaign created");
      router.push(m.adminHref(`campaigns/${c.id}`));
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader eyebrow="Profit Lab Admin" title="Campaign Drop Creator" description="Each month's campaign: a featured PLR product and everything members need to launch it. Start from a PLR Editor project to bring its document, sales page, emails, posts, lead magnet, bonuses and launch plan across." />
      <Card className="mb-6 grid gap-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Campaign month" htmlFor="cmp-month" className="w-48">
            <Input id="cmp-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="new-campaign-month" />
          </Field>
          <Button variant="outline" onClick={() => create(false)} loading={busy === "blank"} disabled={!!busy} data-testid="new-campaign">
            <Plus /> Start from a template
          </Button>
          {campaigns.some((c) => c.month === month) && <p className="text-xs text-warning">There is already a campaign for {monthLabel(month)}.</p>}
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t pt-4">
          <Field label="Or create it from a PLR Editor project" htmlFor="cmp-project" className="min-w-64 flex-1">
            <NativeSelect id="cmp-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="from-project-select">
              <option value="">Choose a project…</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button onClick={() => create(true)} loading={busy === "project"} disabled={!projectId || !!busy} data-testid="from-project">
            <FolderInput /> Create from project
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">The project&apos;s main document becomes the featured product as a DOCX. Anything the project doesn&apos;t have yet is filled with editable template copy.</p>
      </Card>

      {campaigns.length === 0 ? (
        <EmptyState icon={<Megaphone />} title="No campaigns yet" />
      ) : (
        <div className="grid grid-cols-1 gap-3" data-testid="admin-campaigns">
          {campaigns.map((c) => {
            const filled = campaignSections(c).filter((s) => s.filled).length;
            return (
              <Card key={c.id} className="flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap">
                <StoredImage fileId={c.coverFileId} alt="" className="aspect-[3/4] w-14 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{c.title}</p>
                    <StatusBadge status={c.status} publishAt={c.publishAt} />
                    {c.isSample && <Badge variant="sample">Sample</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {monthLabel(c.month)} · {c.featured.title || "No product yet"} · {filled}/10 parts ready
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button asChild size="xs" variant="ghost">
                    <Link href={m.href(`campaigns/${c.id}`)}>
                      <Eye /> View
                    </Link>
                  </Button>
                  <Button asChild size="xs" variant="outline">
                    <Link href={m.adminHref(`campaigns/${c.id}`)}>
                      <Pencil /> Edit
                    </Link>
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={async () => {
                      const copy = await duplicateCampaign(c.id, nextMonth(c.month));
                      if (copy) {
                        toast.success(`Copied to ${monthLabel(copy.month)}`);
                        router.push(m.adminHref(`campaigns/${copy.id}`));
                      }
                    }}
                  >
                    <CopyPlus /> Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${c.title}`}
                    onClick={async () => {
                      if (!(await confirm({ title: `Delete “${c.title}”?`, description: "The campaign and its files are deleted. Members' ticks for it are kept until you erase the brand's data.", confirmLabel: "Delete campaign", destructive: true }))) return;
                      await deleteCampaign(c.id);
                      toast.success("Campaign deleted");
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Editor                                                                                       */
/* ------------------------------------------------------------------------------------------ */

export function CampaignEditor() {
  return (
    <AdminGate>
      <EditorLoader />
    </AdminGate>
  );
}

function EditorLoader() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const m = useMember();
  const { data: stored, loading } = useMemberLive((r) => r.campaigns.get(campaignId), [campaignId]);
  if (loading) return <Loading />;
  if (!stored || stored.brandId !== m.brandId) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<Megaphone />} title="Campaign not found" action={<Button asChild><Link href={m.adminHref("campaigns")}>All campaigns</Link></Button>} />
      </PageContainer>
    );
  }
  return <CampaignForm key={stored.id} stored={stored} />;
}

type EditorSection = "details" | CampaignSectionKey;
type Update = (patch: Partial<CampaignDrop> | ((d: CampaignDrop) => CampaignDrop)) => void;
type RegenKey = Parameters<typeof regenerateSection>[1];

const POST_TYPES: SocialPostType[] = ["educational", "promotional", "announcement", "engagement"];
const CHANNELS = Object.keys(CALENDAR_CHANNEL_LABELS) as CalendarChannel[];

function CampaignForm({ stored }: { stored: CampaignDrop }) {
  const m = useMember();
  const confirm = useConfirm();
  const { draft, update, flush, adopt, state, lastSavedAt } = useDraft<CampaignDrop>(stored, (c) => saveCampaign(c));
  const [section, setSection] = React.useState<EditorSection>("details");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [when, setWhen] = React.useState(toLocalInput(stored.publishAt ?? new Date(`${stored.month}-01T00:00:00`).toISOString()));
  if (!draft) return null;
  const c = draft;
  const sections = campaignSections(c);

  /** Save pending edits, then run an operation on the stored record. */
  const run = async (label: string, fn: (latest: CampaignDrop) => Promise<CampaignDrop>, done?: string) => {
    setBusy(label);
    try {
      const latest = (await flush()) ?? c;
      adopt(await fn(latest));
      if (done) toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const regen = async (key: RegenKey, label: string) => {
    if (!(await confirm({ title: `Replace the ${label.toLowerCase()} with template copy?`, description: "The template is written from the featured product and positioning. Your edits in this section are replaced.", confirmLabel: "Replace" }))) return;
    update((d) => {
      const next = regenerateSection(d, key);
      return key === "emails" || key === "social" || key === "checklist" ? { ...next, calendar: buildCalendar(next) } : next;
    });
    toast.success(`${label} regenerated`);
  };

  const upload = async (files: File[], target: "featured" | "leadMagnet" | { bonus: string }) => {
    const ok = files.filter((f) => f.size <= MAX_PRODUCT_FILE_BYTES);
    if (ok.length < files.length) toast.error(`Files must be under ${formatBytes(MAX_PRODUCT_FILE_BYTES)}.`);
    if (!ok.length) return;
    await run("upload", async (latest) => {
      const stored: CampaignFile[] = [];
      for (const f of ok) stored.push(await storeCampaignFile(f, f.name, m.brandId));
      const next: CampaignDrop =
        target === "featured"
          ? { ...latest, featured: { ...latest.featured, files: [...latest.featured.files, ...stored] } }
          : target === "leadMagnet"
            ? { ...latest, leadMagnet: { ...latest.leadMagnet, files: [...latest.leadMagnet.files, ...stored] } }
            : { ...latest, bonuses: latest.bonuses.map((b) => (b.id === target.bonus ? { ...b, files: [...b.files, ...stored] } : b)) };
      return saveCampaign(next);
    }, `Uploaded ${plural(ok.length, "file")}`);
  };

  const removeFile = (fileId: string) =>
    run("remove-file", async (latest) => {
      const strip = (list: CampaignFile[]) => list.filter((f) => f.fileId !== fileId);
      const saved = await saveCampaign({ ...latest, featured: { ...latest.featured, files: strip(latest.featured.files) }, leadMagnet: { ...latest.leadMagnet, files: strip(latest.leadMagnet.files) }, bonuses: latest.bonuses.map((b) => ({ ...b, files: strip(b.files) })) });
      await deleteMemberFiles([fileId]);
      return saved;
    });

  const whenIso = fromLocalInput(when);
  const future = whenIso ? new Date(whenIso) > new Date() : false;
  const missing = sections.filter((s) => !s.filled);

  const nav: { key: EditorSection; label: string }[] = [{ key: "details", label: "Details & cover" }, ...CAMPAIGN_SECTIONS.map((s) => ({ key: s.key as EditorSection, label: s.label }))];

  return (
    <PageContainer width="wide">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={m.adminHref("campaigns")}>
            <ArrowLeft /> Campaigns
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight" data-testid="campaign-editor-title">
          {c.title}
        </h1>
        <StatusBadge status={c.status} publishAt={c.publishAt} />
        <SaveStatus state={state} lastSavedAt={lastSavedAt} onRetry={() => void flush()} />
        <Button asChild variant="outline" size="sm">
          <Link href={m.href(`campaigns/${c.id}`)} onClick={() => void flush()} data-testid="member-preview">
            <Eye /> Member preview
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <nav className="lg:sticky lg:top-4 lg:self-start" aria-label="Campaign sections">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
            {nav.map((n) => {
              const st = sections.find((s) => s.key === n.key);
              const Icon = n.key === "details" ? Pencil : SECTION_ICONS[n.key];
              return (
                <li key={n.key} className="shrink-0">
                  <button type="button" onClick={() => setSection(n.key)} aria-current={section === n.key ? "true" : undefined} data-testid={`edit-${n.key}`} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition", section === n.key ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{n.label}</span>
                    {st && (st.filled ? <CircleCheck className="size-3.5 text-success" aria-label="Ready" /> : <CircleDashed className="size-3.5 opacity-50" aria-label="Not ready" />)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="grid min-w-0 grid-cols-1 content-start gap-4">
          {section === "details" && <DetailsSection c={c} update={update} busy={busy} run={run} />}
          {section === "featured" && <FeaturedSection c={c} update={update} onUpload={(f) => upload(f, "featured")} onRemoveFile={removeFile} busy={!!busy} />}
          {section === "rebrand" && <RebrandSection c={c} update={update} onRegen={() => regen("rebrand", "Rebranding instructions")} />}
          {section === "positioning" && <PositioningSection c={c} update={update} onRegen={() => regen("positioning", "Positioning")} />}
          {section === "sales" && <SalesSection c={c} update={update} onRegen={() => regen("sales", "Sales-page copy")} />}
          {section === "emails" && <EmailsSection c={c} update={update} onRegen={() => regen("emails", "Emails")} />}
          {section === "social" && <SocialSection c={c} update={update} onRegen={() => regen("social", "Social posts")} />}
          {section === "leadMagnet" && <LeadMagnetSection c={c} update={update} onRegen={() => regen("leadMagnet", "Lead magnet")} onUpload={(f) => upload(f, "leadMagnet")} onRemoveFile={removeFile} busy={!!busy} />}
          {section === "bonuses" && <BonusesSection c={c} update={update} onUpload={(f, bonus) => upload(f, { bonus })} onRemoveFile={removeFile} busy={!!busy} />}
          {section === "checklist" && <ChecklistSection c={c} update={update} onRegen={() => regen("checklist", "Launch checklist")} />}
          {section === "calendar" && <CalendarSection c={c} update={update} />}
        </div>

        <div className="grid grid-cols-1 content-start gap-4 lg:col-span-2 xl:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Release to members</CardTitle>
              <CardDescription>Members see the campaign from this moment.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3">
              <Field label="Release date and time" htmlFor="cmp-when">
                <Input id="cmp-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </Field>
              <Button onClick={() => whenIso && run("publish", (latest) => saveCampaign({ ...latest, status: future ? "scheduled" : "published", publishAt: whenIso }), future ? `Scheduled for ${new Date(whenIso).toLocaleString()}` : "Released to members")} loading={busy === "publish"} disabled={!whenIso} data-testid="publish-campaign">
                <Rocket /> {future ? "Schedule campaign" : "Release now"}
              </Button>
              {c.status !== "draft" && (
                <Button variant="ghost" size="sm" onClick={() => update({ status: "draft" })}>
                  <Undo2 /> Back to draft
                </Button>
              )}
              {missing.length > 0 && (
                <p className="text-xs text-warning">
                  Not ready yet: {missing.map((s) => s.label.toLowerCase()).join(", ")}.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Downloads</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={busy === "kit"}
                onClick={() =>
                  run("kit", async (latest) => {
                    const res = await campaignKit(latest);
                    downloadBlob(res.blob, res.fileName);
                    return latest;
                  })
                }
                data-testid="admin-kit"
              >
                <FileArchive /> Campaign kit (.zip)
              </Button>
            </CardContent>
          </Card>
          <ByldityPanel c={c} />
        </div>
      </div>
    </PageContainer>
  );
}

function SectionShell({ title, description, onRegen, children, actions }: { title: string; description?: React.ReactNode; onRegen?: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions}
        {onRegen && (
          <Button variant="outline" size="sm" onClick={onRegen} data-testid="regenerate">
            <RefreshCcw /> Regenerate from template
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">{children}</CardContent>
    </Card>
  );
}

function FileList({ files, onRemove, busy }: { files: CampaignFile[]; onRemove: (fileId: string) => void; busy: boolean }) {
  if (!files.length) return null;
  return (
    <ul className="divide-y rounded-lg border" data-testid="campaign-files">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
          <Button variant="ghost" size="icon-xs" onClick={() => onRemove(f.fileId)} disabled={busy} aria-label={`Remove ${f.name}`}>
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function DetailsSection({ c, update, busy, run }: { c: CampaignDrop; update: Update; busy: string | null; run: (label: string, fn: (latest: CampaignDrop) => Promise<CampaignDrop>, done?: string) => Promise<void> }) {
  const m = useMember();
  return (
    <SectionShell title="Details & cover" description={`Suggested launch: ${dayLabel(campaignLaunchDate(c), { weekday: "long", day: "numeric", month: "long" })}. Every date in the calendar is relative to this day.`}>
      <div className="grid grid-cols-1 gap-4 items-start sm:grid-cols-2">
        <Field label="Title" htmlFor="cd-title">
          <Input id="cd-title" value={c.title} onChange={(e) => update({ title: e.target.value })} data-testid="cd-title" />
        </Field>
        <Field label="Theme" htmlFor="cd-theme" hint="The headline members see, e.g. “The Sleep Better Launch”.">
          <Input id="cd-theme" value={c.theme} onChange={(e) => update({ theme: e.target.value })} data-testid="cd-theme" />
        </Field>
        <Field label="Month" htmlFor="cd-month">
          <Input id="cd-month" type="month" value={c.month} onChange={(e) => e.target.value && update({ month: e.target.value })} />
        </Field>
        <Field label="Launch day of the month" htmlFor="cd-day" hint="1st to 28th.">
          <Input id="cd-day" type="number" min={1} max={28} value={c.launchDay} onChange={(e) => update({ launchDay: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} />
        </Field>
        <Field label="Who can open it" htmlFor="cd-access">
          <NativeSelect id="cd-access" value={c.access} onChange={(e) => update({ access: e.target.value as AccessTier })}>
            {ACCESS_TIERS.map((t) => (
              <option key={t} value={t}>
                {ACCESS_TIER_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Summary" htmlFor="cd-summary" hint="Markdown. What this month's campaign helps members launch." optional>
        <Textarea id="cd-summary" rows={4} value={c.summary} onChange={(e) => update({ summary: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-start">
        <StoredImage fileId={c.coverFileId} alt="" className="aspect-[3/4] w-28 rounded-md shadow" />
        <FileDrop
          accept="image/*"
          compact
          title={c.coverFileId ? "Replace cover" : "Upload cover"}
          disabled={!!busy}
          onFiles={([f]) => {
            if (!f.type.startsWith("image/")) return toast.error("Choose an image.");
            if (f.size > MAX_IMAGE_BYTES) return toast.error(`Images must be under ${formatBytes(MAX_IMAGE_BYTES)}.`);
            void run("cover", async (latest) => {
              const file = await storeMemberFile(f, f.name, m.brandId);
              const saved = await saveCampaign({ ...latest, coverFileId: file.id });
              if (latest.coverFileId) await deleteMemberFiles([latest.coverFileId]);
              return saved;
            });
          }}
        />
      </div>
    </SectionShell>
  );
}

function FeaturedSection({ c, update, onUpload, onRemoveFile, busy }: { c: CampaignDrop; update: Update; onUpload: (f: File[]) => void; onRemoveFile: (id: string) => void; busy: boolean }) {
  const f = c.featured;
  const set = (patch: Partial<CampaignDrop["featured"]>) => update((d) => ({ ...d, featured: { ...d.featured, ...patch } }));
  return (
    <SectionShell title="Featured PLR product" description={f.source.kind === "project" ? `Built from the studio project “${f.source.projectName}” on ${f.source.importedAt?.slice(0, 10)}.` : "The product members rebrand and launch this month."}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Product title" htmlFor="fp-title">
          <Input id="fp-title" value={f.title} onChange={(e) => set({ title: e.target.value })} data-testid="fp-title" />
        </Field>
        <Field label="Format" htmlFor="fp-format">
          <Input id="fp-format" value={f.format} onChange={(e) => set({ format: e.target.value })} placeholder="ebook, mini-course, workbook…" />
        </Field>
      </div>
      <Field label="Subtitle" htmlFor="fp-sub">
        <Input id="fp-sub" value={f.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
      </Field>
      <Field label="Description" htmlFor="fp-desc" hint="Markdown." optional>
        <Textarea id="fp-desc" rows={4} value={f.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label="Contents" htmlFor="fp-contents" hint="One chapter or module per line.">
        <LinesField id="fp-contents" value={f.contents} onChange={(contents) => set({ contents })} rows={6} />
      </Field>
      <Field label="Licence notes" htmlFor="fp-licence" hint="What members may and may not do with it, in plain words.">
        <Textarea id="fp-licence" rows={3} value={f.licenceNotes} onChange={(e) => set({ licenceNotes: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 gap-2">
        <p className="text-[13px] font-medium">Product files</p>
        <FileList files={f.files} onRemove={onRemoveFile} busy={busy} />
        <FileDrop accept="*/*" multiple compact title="Add product files (DOCX, PDF, ZIP…)" disabled={busy} onFiles={onUpload} testId="featured-upload" />
      </div>
    </SectionShell>
  );
}

function RebrandSection({ c, update, onRegen }: { c: CampaignDrop; update: Update; onRegen: () => void }) {
  const rules = c.rebrand.rules;
  const setRules = (next: typeof rules) => update((d) => ({ ...d, rebrand: { ...d.rebrand, rules: next } }));
  return (
    <SectionShell title="Rebranding instructions" description="Steps members follow, plus find-and-replace rules for the Rebrand Assistant." onRegen={onRegen}>
      <Field label="Steps" htmlFor="rb-steps" hint="Markdown — a numbered list works best.">
        <Textarea id="rb-steps" rows={9} value={c.rebrand.steps} onChange={(e) => update((d) => ({ ...d, rebrand: { ...d.rebrand, steps: e.target.value } }))} />
      </Field>
      <div className="grid grid-cols-1 gap-2">
        <p className="text-[13px] font-medium">Find and replace</p>
        {rules.map((r, i) => (
          <div key={r.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_1.3fr_auto]">
            <Input aria-label="Find" value={r.find} onChange={(e) => setRules(rules.map((x) => (x.id === r.id ? { ...x, find: e.target.value } : x)))} placeholder="Find" />
            <Input aria-label="Replace with" value={r.replace} onChange={(e) => setRules(rules.map((x) => (x.id === r.id ? { ...x, replace: e.target.value } : x)))} placeholder="Replace with" />
            <Input aria-label="Note" value={r.note} onChange={(e) => setRules(rules.map((x) => (x.id === r.id ? { ...x, note: e.target.value } : x)))} placeholder="Note" />
            <RowControls index={i} count={rules.length} onMove={(a, b) => setRules(move(rules, a, b))} onRemove={() => setRules(rules.filter((x) => x.id !== r.id))} label="rule" />
          </div>
        ))}
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setRules([...rules, { id: uid("rr"), find: "", replace: "", note: "" }])}>
          <Plus /> Add rule
        </Button>
      </div>
    </SectionShell>
  );
}

function PositioningSection({ c, update, onRegen }: { c: CampaignDrop; update: Update; onRegen: () => void }) {
  const p = c.positioning;
  const set = (patch: Partial<CampaignDrop["positioning"]>) => update((d) => ({ ...d, positioning: { ...d.positioning, ...patch } }));
  return (
    <SectionShell title="Product positioning" description="Who it's for, the problem, the promise and the angle. The sales copy, emails and posts are written from this." onRegen={onRegen}>
      <Field label="Who it's for" htmlFor="po-aud">
        <Input id="po-aud" value={p.audience} onChange={(e) => set({ audience: e.target.value })} data-testid="po-audience" />
      </Field>
      <Field label="Their problem" htmlFor="po-prob">
        <Textarea id="po-prob" rows={2} value={p.problem} onChange={(e) => set({ problem: e.target.value })} />
      </Field>
      <Field label="The promise" htmlFor="po-prom">
        <Textarea id="po-prom" rows={2} value={p.promise} onChange={(e) => set({ promise: e.target.value })} data-testid="po-promise" />
      </Field>
      <Field label="Your angle" htmlFor="po-angle">
        <Textarea id="po-angle" rows={2} value={p.angle} onChange={(e) => set({ angle: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <Field label="Suggested price" htmlFor="po-price">
          <Input id="po-price" type="number" min={0} value={p.pricePoint ?? ""} onChange={(e) => set({ pricePoint: e.target.value === "" ? null : Number(e.target.value) })} />
        </Field>
        <Field label="Currency" htmlFor="po-cur">
          <Input id="po-cur" value={p.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase().slice(0, 3) })} />
        </Field>
      </div>
      <Field label="Offer stack" htmlFor="po-stack" hint="One item per line.">
        <LinesField id="po-stack" value={p.offerStack} onChange={(offerStack) => set({ offerStack })} />
      </Field>
      <Field label="Notes" htmlFor="po-notes" optional>
        <Textarea id="po-notes" rows={3} value={p.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </SectionShell>
  );
}

function SalesSection({ c, update, onRegen }: { c: CampaignDrop; update: Update; onRegen: () => void }) {
  const list = c.salesPage.sections;
  const setList = (sections: typeof list) => update((d) => ({ ...d, salesPage: { sections } }));
  const set = (id: string, patch: Partial<(typeof list)[number]>) => setList(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <SectionShell title="Sales-page copy" description="Keep [placeholders] for anything only the member knows. No invented testimonials, results or income claims." onRegen={onRegen}>
      {list.map((s, i) => (
        <EditorRow key={s.id} className={cn(!s.enabled && "opacity-60")}>
          <div className="flex items-center gap-2">
            <Switch checked={s.enabled} onCheckedChange={(v) => set(s.id, { enabled: v })} aria-label={`Show ${SALES_SECTION_LABELS[s.type]}`} />
            <p className="flex-1 text-[13px] font-semibold">{SALES_SECTION_LABELS[s.type]}</p>
            <RowControls index={i} count={list.length} onMove={(a, b) => setList(move(list, a, b))} onRemove={() => setList(list.filter((x) => x.id !== s.id))} label={SALES_SECTION_LABELS[s.type]} />
          </div>
          <Input aria-label="Heading" value={s.heading} onChange={(e) => set(s.id, { heading: e.target.value })} placeholder="Heading" />
          {(s.subheading || s.type === "headline") && <Input aria-label="Subheading" value={s.subheading} onChange={(e) => set(s.id, { subheading: e.target.value })} placeholder="Subheading" />}
          <Textarea aria-label="Body" rows={3} value={s.body} onChange={(e) => set(s.id, { body: e.target.value })} placeholder="Body (Markdown)" />
          {(s.bullets.length > 0 || ["benefits", "features", "included", "problem"].includes(s.type)) && <LinesField value={s.bullets} onChange={(bullets) => set(s.id, { bullets })} rows={3} placeholder="Bullet points, one per line" />}
          {s.items.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              {s.items.map((it) => (
                <div key={it.id} className="grid grid-cols-1 gap-1.5 rounded-lg bg-secondary/40 p-2 sm:grid-cols-[1fr_2fr_auto]">
                  <Input aria-label="Item title" value={it.title} onChange={(e) => set(s.id, { items: s.items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)) })} />
                  <Input aria-label="Item text" value={it.text} onChange={(e) => set(s.id, { items: s.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)) })} />
                  <Button variant="ghost" size="icon-xs" aria-label="Remove item" onClick={() => set(s.id, { items: s.items.filter((x) => x.id !== it.id) })}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="xs" className="justify-self-start" onClick={() => set(s.id, { items: [...s.items, { id: uid("si"), title: "", text: "" }] })}>
                <Plus /> Add item
              </Button>
            </div>
          )}
          {(s.buttonText || s.type === "cta" || s.type === "pricing") && <Input aria-label="Button text" value={s.buttonText} onChange={(e) => set(s.id, { buttonText: e.target.value })} placeholder="Button text" />}
        </EditorRow>
      ))}
    </SectionShell>
  );
}

function EmailsSection({ c, update, onRegen }: { c: CampaignDrop; update: Update; onRegen: () => void }) {
  const list = c.emails;
  const setList = (emails: typeof list) => update((d) => ({ ...d, emails }));
  const set = (id: string, patch: Partial<(typeof list)[number]>) => setList(list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  return (
    <SectionShell
      title="Email marketing sequence"
      description="Days are relative to launch day (0). Rebuild the calendar after changing days."
      onRegen={onRegen}
      actions={
        <Button variant="outline" size="sm" onClick={() => setList([...list, { id: uid("em"), day: (list.at(-1)?.day ?? 0) + 1, subject: "", altSubjects: [], preview: "", body: "", ctaText: "Get it here", ctaUrl: "", notes: "" }])}>
          <Plus /> Add email
        </Button>
      }
    >
      {list.map((e, i) => (
        <EditorRow key={e.id} testId="email-row">
          <div className="flex items-center gap-2">
            <Field label="Day" htmlFor={`em-day-${e.id}`} className="w-20">
              <Input id={`em-day-${e.id}`} type="number" value={e.day} onChange={(ev) => set(e.id, { day: Number(ev.target.value) || 0 })} />
            </Field>
            <p className="mt-5 flex-1 text-xs text-muted-foreground">{dayText(e.day)} · {dayLabel(entryDate(c, e.day), { day: "numeric", month: "short" })}</p>
            <RowControls index={i} count={list.length} onMove={(a, b) => setList(move(list, a, b))} onRemove={() => setList(list.filter((x) => x.id !== e.id))} label="email" />
          </div>
          <Input aria-label="Subject" value={e.subject} onChange={(ev) => set(e.id, { subject: ev.target.value })} placeholder="Subject" />
          <Input aria-label="Preview text" value={e.preview} onChange={(ev) => set(e.id, { preview: ev.target.value })} placeholder="Preview text" />
          <Textarea aria-label="Body" rows={6} value={e.body} onChange={(ev) => set(e.id, { body: ev.target.value })} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input aria-label="Button text" value={e.ctaText} onChange={(ev) => set(e.id, { ctaText: ev.target.value })} placeholder="Button text" />
            <Input aria-label="Button link" value={e.ctaUrl} onChange={(ev) => set(e.id, { ctaUrl: ev.target.value })} placeholder="[link]" />
          </div>
        </EditorRow>
      ))}
    </SectionShell>
  );
}

function SocialSection({ c, update, onRegen }: { c: CampaignDrop; update: Update; onRegen: () => void }) {
  const list = c.social;
  const setList = (social: typeof list) => update((d) => ({ ...d, social }));
  const set = (id: string, patch: Partial<(typeof list)[number]>) => setList(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  return (
    <SectionShell
      title="Social media content"
      description="Posts around launch day. Members copy them or download them as a CSV."
      onRegen={onRegen}
      actions={
        <Button variant="outline" size="sm" onClick={() => setList([...list, { id: uid("cp"), platform: "facebook", type: "educational", day: 0, text: "", hashtags: [] }])}>
          <Plus /> Add post
        </Button>
      }
    >
      {list.map((p, i) => (
        <EditorRow key={p.id}>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Day" htmlFor={`sp-day-${p.id}`} className="w-20">
              <Input id={`sp-day-${p.id}`} type="number" value={p.day} onChange={(e) => set(p.id, { day: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Platform" htmlFor={`sp-pl-${p.id}`} className="w-40">
              <NativeSelect id={`sp-pl-${p.id}`} value={p.platform} onChange={(e) => set(p.id, { platform: e.target.value as SocialPlatform })}>
                {(Object.keys(SOCIAL_PLATFORM_LABELS) as SocialPlatform[]).map((x) => (
                  <option key={x} value={x}>
                    {SOCIAL_PLATFORM_LABELS[x]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Type" htmlFor={`sp-ty-${p.id}`} className="w-36">
              <NativeSelect id={`sp-ty-${p.id}`} value={p.type} onChange={(e) => set(p.id, { type: e.target.value as SocialPostType })}>
                {POST_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="ml-auto">
              <RowControls index={i} count={list.length} onMove={(a, b) => setList(move(list, a, b))} onRemove={() => setList(list.filter((x) => x.id !== p.id))} label="post" />
            </div>
          </div>
          <Textarea aria-label="Post text" rows={4} value={p.text} onChange={(e) => set(p.id, { text: e.target.value })} />
          <Input aria-label="Hashtags" value={p.hashtags.join(" ")} onChange={(e) => set(p.id, { hashtags: e.target.value.split(/[\s,]+/).map((h) => h.replace(/^#/, "")).filter(Boolean) })} placeholder="Hashtags, separated by spaces" />
        </EditorRow>
      ))}
    </SectionShell>
  );
}

function LeadMagnetSection({ c, update, onRegen, onUpload, onRemoveFile, busy }: { c: CampaignDrop; update: Update; onRegen: () => void; onUpload: (f: File[]) => void; onRemoveFile: (id: string) => void; busy: boolean }) {
  const l = c.leadMagnet;
  const set = (patch: Partial<CampaignDrop["leadMagnet"]>) => update((d) => ({ ...d, leadMagnet: { ...d.leadMagnet, ...patch } }));
  return (
    <SectionShell title="Lead magnet" description="A free gift that leads into the product." onRegen={onRegen}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="lm-title">
          <Input id="lm-title" value={l.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Format" htmlFor="lm-format">
          <Input id="lm-format" value={l.format} onChange={(e) => set({ format: e.target.value })} />
        </Field>
      </div>
      <Field label="Description" htmlFor="lm-desc">
        <Textarea id="lm-desc" rows={2} value={l.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label="Outline" htmlFor="lm-outline" hint="One point per line.">
        <LinesField id="lm-outline" value={l.outline} onChange={(outline) => set({ outline })} rows={5} />
      </Field>
      <FileList files={l.files} onRemove={onRemoveFile} busy={busy} />
      <FileDrop accept="*/*" multiple compact title="Add the lead magnet file" disabled={busy} onFiles={onUpload} />
    </SectionShell>
  );
}

function BonusesSection({ c, update, onUpload, onRemoveFile, busy }: { c: CampaignDrop; update: Update; onUpload: (f: File[], bonusId: string) => void; onRemoveFile: (id: string) => void; busy: boolean }) {
  const list = c.bonuses;
  const setList = (bonuses: typeof list) => update((d) => ({ ...d, bonuses }));
  const set = (id: string, patch: Partial<(typeof list)[number]>) => setList(list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  return (
    <SectionShell
      title="Bonus materials"
      description="Extras members can add to their offer."
      actions={
        <Button variant="outline" size="sm" onClick={() => setList([...list, { id: uid("cb"), title: "", description: "", files: [] }])} data-testid="add-bonus">
          <Plus /> Add bonus
        </Button>
      }
    >
      {list.length === 0 && <p className="text-sm text-muted-foreground">No bonuses yet.</p>}
      {list.map((b, i) => (
        <EditorRow key={b.id}>
          <div className="flex items-center gap-2">
            <Input aria-label="Bonus title" value={b.title} onChange={(e) => set(b.id, { title: e.target.value })} placeholder="Bonus title" className="flex-1" />
            <RowControls
              index={i}
              count={list.length}
              onMove={(a, z) => setList(move(list, a, z))}
              onRemove={() => {
                setList(list.filter((x) => x.id !== b.id));
                if (b.files.length) void deleteMemberFiles(b.files.map((f) => f.fileId));
              }}
              label="bonus"
            />
          </div>
          <Textarea aria-label="Bonus description" rows={2} value={b.description} onChange={(e) => set(b.id, { description: e.target.value })} placeholder="What it is and why it helps" />
          <FileList files={b.files} onRemove={onRemoveFile} busy={busy} />
          <FileDrop accept="*/*" multiple compact title="Add files for this bonus" disabled={busy} onFiles={(f) => onUpload(f, b.id)} />
        </EditorRow>
      ))}
    </SectionShell>
  );
}

function ChecklistSection({ c, update, onRegen }: { c: CampaignDrop; update: Update; onRegen: () => void }) {
  const list = c.checklist;
  const setList = (checklist: typeof list) => update((d) => ({ ...d, checklist }));
  const set = (id: string, patch: Partial<(typeof list)[number]>) => setList(list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <SectionShell
      title="Launch checklist"
      description="Members tick these off. Items with a day also appear on the promotional calendar."
      onRegen={onRegen}
      actions={
        <Button variant="outline" size="sm" onClick={() => setList([...list, { id: uid("cl"), phase: "prepare", text: "", day: null }])}>
          <Plus /> Add step
        </Button>
      }
    >
      {list.map((x, i) => (
        <div key={x.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[130px_minmax(0,1fr)_90px_auto]">
          <NativeSelect aria-label="Phase" value={x.phase} onChange={(e) => set(x.id, { phase: e.target.value as CampaignChecklistPhase })}>
            {CAMPAIGN_PHASES.map((p) => (
              <option key={p} value={p}>
                {CAMPAIGN_PHASE_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
          <Input aria-label="Step" value={x.text} onChange={(e) => set(x.id, { text: e.target.value })} />
          <Input aria-label="Day relative to launch" type="number" value={x.day ?? ""} placeholder="Day" onChange={(e) => set(x.id, { day: e.target.value === "" ? null : Number(e.target.value) })} />
          <RowControls index={i} count={list.length} onMove={(a, b) => setList(move(list, a, b))} onRemove={() => setList(list.filter((y) => y.id !== x.id))} label="step" />
        </div>
      ))}
    </SectionShell>
  );
}

function CalendarSection({ c, update }: { c: CampaignDrop; update: Update }) {
  const list = c.calendar;
  const setList = (calendar: typeof list) => update((d) => ({ ...d, calendar }));
  const set = (id: string, patch: Partial<(typeof list)[number]>) => setList(list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <SectionShell
      title="Promotional calendar"
      description={`Built from the emails, posts and dated checklist steps. Your own entries are kept when you rebuild. Launch day: ${dayLabel(campaignLaunchDate(c))}.`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => update((d) => ({ ...d, calendar: buildCalendar(d) }))} data-testid="rebuild-calendar">
            <RefreshCcw /> Rebuild
          </Button>
          <Button variant="outline" size="sm" onClick={() => setList(sortCalendar([...list, { id: uid("cal"), day: 0, channel: "content", title: "New entry", detail: "", refId: null, source: "manual" }]))} data-testid="add-calendar-entry">
            <Plus /> Add entry
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-2" data-testid="calendar-editor">
        {list.map((x) => (
          <div key={x.id} className={cn("grid grid-cols-1 items-center gap-2 rounded-lg p-1.5 sm:grid-cols-[110px_80px_110px_minmax(0,1fr)_auto]", x.source === "manual" && "bg-primary-soft/40")}>
            <span className="text-xs text-muted-foreground">
              {dayLabel(entryDate(c, x.day), { weekday: "short", day: "numeric", month: "short" })}
            </span>
            {x.source === "manual" ? (
              <>
                <Input aria-label="Day relative to launch" type="number" value={x.day} onChange={(e) => set(x.id, { day: Number(e.target.value) || 0 })} />
                <NativeSelect aria-label="Channel" value={x.channel} onChange={(e) => set(x.id, { channel: e.target.value as CalendarChannel })}>
                  {CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {CALENDAR_CHANNEL_LABELS[ch]}
                    </option>
                  ))}
                </NativeSelect>
                <Input aria-label="Entry" value={x.title} onChange={(e) => set(x.id, { title: e.target.value })} />
                <Button variant="ghost" size="icon-xs" aria-label="Remove entry" onClick={() => setList(list.filter((y) => y.id !== x.id))}>
                  <Trash2 />
                </Button>
              </>
            ) : (
              <>
                <span className="text-xs tabular-nums text-muted-foreground">{dayText(x.day)}</span>
                <Badge variant="secondary" className="justify-self-start">
                  {CALENDAR_CHANNEL_LABELS[x.channel]}
                </Badge>
                <span className="truncate text-sm">{x.title}</span>
                <span className="text-[11px] text-muted-foreground">auto</span>
              </>
            )}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/** What the campaign would hand to each BYLDITY app. Prepared only — nothing is sent anywhere. */
function ByldityPanel({ c }: { c: CampaignDrop }) {
  const handoffs = campaignHandoffs(c);
  return (
    <Card data-testid="byldity-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-4" /> BYLDITY handoff
        </CardTitle>
        <CardDescription>Ready for ByldSend, ByldPages, Byld Countdown and ByldFlow. No app is connected yet, so nothing leaves this browser.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2">
        {handoffs.map((h) => {
          const app = BYLDITY_APPS.find((a) => a.id === h.app)!;
          return (
            <div key={h.app} className="flex items-center gap-2 rounded-lg border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{app.name}</p>
                <p className="truncate text-xs text-muted-foreground">{h.label}</p>
              </div>
              <Button variant="ghost" size="icon-xs" aria-label={`Download the ${app.name} payload`} onClick={() => downloadText(JSON.stringify(h.payload, null, 2), `${h.app}-${c.month}.json`, "application/json")}>
                <Download />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Send to ${app.name}`}
                onClick={async () => {
                  const res = await getConnector(h.app).push(h.payload);
                  (res.ok ? toast.success : toast.info)(res.message);
                }}
              >
                <Send />
              </Button>
            </div>
          );
        })}
        <Callout tone="neutral" className="mt-1 text-xs">
          Connecting an app will need your explicit set-up and its API key kept on the server.
        </Callout>
      </CardContent>
    </Card>
  );
}
