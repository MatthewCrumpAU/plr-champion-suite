"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  FileArchive,
  FileCode,
  FolderInput,
  Gift,
  ListChecks,
  Magnet,
  Mails,
  Megaphone,
  Package,
  PanelsTopLeft,
  Pencil,
  Rocket,
  Share2,
  Target,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, EmptyState, PageContainer, PageHeader, Progress, SectionTitle } from "@/components/ui/primitives";
import { useToolHref } from "@/components/common/tool-links";
import { downloadBlob } from "@/lib/export/download";
import { setActiveProjectId } from "@/lib/data/hooks";
import { salesPageHtml } from "@/lib/marketing/sales";
import { SALES_SECTION_LABELS, SOCIAL_PLATFORM_LABELS } from "@/lib/models/marketing";
import { useMemberLive } from "@/lib/membership/hooks";
import { isLive } from "@/lib/membership/access";
import { calendarCsv, calendarIcs, campaignKit, campaignLaunchDate, campaignSalesPageData, campaignSections, campaignToProject, dayText, emailsCsv, entryDate, salesCopyMarkdown, socialCsv, type CampaignSectionKey } from "@/lib/lab/campaigns";
import { importCampaignDocument } from "@/lib/lab/campaign-studio";
import { dayLabel, monthLabel, monthOf } from "@/lib/lab/dates";
import { setDone } from "@/lib/lab/store";
import { CALENDAR_CHANNEL_LABELS, CAMPAIGN_PHASE_LABELS, CAMPAIGN_PHASES, type CampaignDrop, type CalendarChannel, type LabProgress } from "@/lib/lab/types";
import { cn, errorMessage, formatBytes, plural, slugify } from "@/lib/utils";
import { useMember } from "@/features/membership/member-context";
import { AccessBadge, LockNotice, Markdown, StatusBadge, StoredImage } from "@/features/membership/ui";
import { CopyButton, CountChip, downloadText, FileRow, Loading, ProgressRing, ToolButton, useLabMember, useLabProgress } from "./lab-ui";

export const SECTION_ICONS: Record<CampaignSectionKey, LucideIcon> = {
  featured: Package,
  rebrand: Wand2,
  positioning: Target,
  sales: PanelsTopLeft,
  emails: Mails,
  social: Share2,
  leadMagnet: Magnet,
  bonuses: Gift,
  checklist: ListChecks,
  calendar: CalendarDays,
};

export const checkKey = (id: string) => `check:${id}`;

export function campaignProgress(c: CampaignDrop, p: Pick<LabProgress, "done"> | null | undefined) {
  const done = c.checklist.filter((i) => p?.done[checkKey(i.id)]).length;
  return { done, total: c.checklist.length, percent: c.checklist.length ? Math.round((done / c.checklist.length) * 100) : 0 };
}

/** Campaigns the viewer can see, newest month first (live via IndexedDB). */
export function useCampaigns() {
  const m = useMember();
  const lm = useLabMember();
  return useMemberLive(
    async (r) => {
      const [campaigns, progress] = await Promise.all([r.campaigns.list(m.brandId), r.labProgress.listForMember(m.brandId, lm.memberId)]);
      return { campaigns: campaigns.sort((a, b) => b.month.localeCompare(a.month) || b.updatedAt.localeCompare(a.updatedAt)), progress: new Map(progress.filter((x) => x.kind === "campaign").map((x) => [x.refId, x])) };
    },
    [m.brandId, lm.memberId],
  );
}

const upcoming = (c: CampaignDrop) => (c.status === "scheduled" || c.status === "published") && !!c.publishAt && new Date(c.publishAt) > new Date();

/* ------------------------------------------------------------------------------------------ */
/* List                                                                                         */
/* ------------------------------------------------------------------------------------------ */

export function CampaignsPage() {
  const m = useMember();
  const { data, loading } = useCampaigns();
  if (loading || !data) return <Loading />;
  const visible = data.campaigns.filter((c) => m.canSee(c));
  const teasers = m.isAdmin ? [] : data.campaigns.filter(upcoming);
  const thisMonth = monthOf(new Date());
  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow={m.brand.name}
        title="Monthly Profit Campaign Drops"
        description="Every month: one PLR product with everything you need to launch it — rebrand instructions, positioning, sales copy, emails, posts, a lead magnet, bonuses, a launch checklist and a promotional calendar."
        actions={
          m.isAdmin ? (
            <Button asChild variant="outline">
              <Link href={m.adminHref("campaigns")}>Campaign Drop Creator</Link>
            </Button>
          ) : undefined
        }
      />
      {teasers.map((c) => (
        <Card key={c.id} className="mb-4 flex items-center gap-4 border-dashed p-4" data-testid="upcoming-campaign">
          <CalendarClock className="size-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              Coming {dayLabel(c.publishAt!.slice(0, 10), { day: "numeric", month: "long" })}: {c.theme || c.title}
            </p>
            <p className="text-sm text-muted-foreground">Featuring {c.featured.title || "a new PLR product"}.</p>
          </div>
        </Card>
      ))}
      {visible.length === 0 ? (
        <EmptyState icon={<Megaphone />} title="No campaigns yet" description={m.isAdmin ? "Create the first one in the Campaign Drop Creator." : "The first Campaign Drop is on its way."} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visible.map((c) => {
            const prog = campaignProgress(c, data.progress.get(c.id));
            const lock = m.lockReason(c);
            const filled = campaignSections(c).filter((s) => s.filled).length;
            return (
              <Link key={c.id} href={m.href(`campaigns/${c.id}`)} className={cn("group flex gap-4 rounded-2xl border bg-card p-4 transition hover:shadow-md sm:gap-5", c.month === thisMonth && "border-primary/50")} data-testid="campaign-card">
                <StoredImage fileId={c.coverFileId} alt="" className="aspect-[3/4] w-20 shrink-0 self-start rounded-md shadow-md ring-1 ring-black/5 sm:w-28" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{monthLabel(c.month)}</Badge>
                    {c.month === thisMonth && <Badge variant="success">This month</Badge>}
                    <AccessBadge tier={c.access} />
                    {m.isAdmin && <StatusBadge status={c.status} publishAt={c.publishAt} />}
                    {lock && <span className="text-xs text-muted-foreground">{lock}</span>}
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">{c.theme || c.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    Featured product: <span className="font-medium text-foreground">{c.featured.title || "to be announced"}</span> · launch on {dayLabel(campaignLaunchDate(c), { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-muted-foreground">
                    <span>{filled} of 10 parts included</span>
                    <span className="flex min-w-40 flex-1 items-center gap-2">
                      <Progress value={prog.percent} className="max-w-48" />
                      <span className="tabular-nums">
                        {prog.done}/{prog.total} launch steps
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Campaign                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export function CampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const m = useMember();
  const { data: c, loading } = useMemberLive((r) => r.campaigns.get(campaignId), [campaignId]);
  if (loading) return <Loading />;
  if (!c || c.brandId !== m.brandId || !m.canSee(c)) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<Megaphone />} title="This campaign isn't available" description={c && c.brandId === m.brandId ? "It hasn't been released yet." : "The link may be wrong."} action={<Button asChild><Link href={m.href("campaigns")}>All campaigns</Link></Button>} />
      </PageContainer>
    );
  }
  return <CampaignView c={c} />;
}

function CampaignView({ c }: { c: CampaignDrop }) {
  const m = useMember();
  const lm = useLabMember();
  const router = useRouter();
  const remap = useToolHref();
  const { data: progress } = useLabProgress("campaign", c.id);
  const [busy, setBusy] = React.useState<string | null>(null);
  const usable = m.canUse(c);
  const lock = m.lockReason(c);
  const sections = campaignSections(c);
  const prog = campaignProgress(c, progress);
  const launch = campaignLaunchDate(c);

  const kit = async () => {
    setBusy("kit");
    try {
      const res = await campaignKit(c);
      downloadBlob(res.blob, res.fileName);
      toast.success(`Downloading ${res.fileName}`, { description: `${plural(res.files, "file")} · ${formatBytes(res.blob.size)}` });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const toStudio = async () => {
    setBusy("studio");
    try {
      const res = await campaignToProject(c, { importDocument: importCampaignDocument });
      setActiveProjectId(res.projectId);
      toast.success("Project created in your studio", {
        description: `${res.importedDocument ? "The product is open in the PLR Editor. " : ""}Sales page, emails, posts and a dated launch plan are ready to edit.`,
      });
      router.push(remap(res.importedDocument ? "/editor" : "/launch"));
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <PageContainer width="wide">
      <Link href={m.href("campaigns")} className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All campaigns
      </Link>
      <section className="grid grid-cols-1 gap-6 rounded-2xl border bg-card p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:p-6">
        <StoredImage fileId={c.coverFileId} alt={`${c.title} cover`} className="aspect-[3/4] w-36 self-start rounded-lg shadow-md ring-1 ring-black/5 sm:w-full" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{monthLabel(c.month)}</Badge>
            <AccessBadge tier={c.access} />
            {m.isAdmin && <StatusBadge status={c.status} publishAt={c.publishAt} />}
            {!isLive(c) && !m.isAdmin && <Badge variant="warning">Coming soon</Badge>}
            {c.isSample && <Badge variant="sample">Sample</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight" data-testid="campaign-title">
            {c.theme || c.title}
          </h1>
          {c.summary && <Markdown source={c.summary} className="mt-2 text-sm text-muted-foreground" />}
          <p className="mt-3 flex items-center gap-2 text-sm">
            <Rocket className="size-4 text-primary" /> Suggested launch: <strong>{dayLabel(launch, { weekday: "long", day: "numeric", month: "long" })}</strong>
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={kit} loading={busy === "kit"} disabled={!usable || !!busy} data-testid="download-kit">
              <FileArchive /> Download the campaign kit
            </Button>
            <Button variant="outline" onClick={toStudio} loading={busy === "studio"} disabled={!usable || !!busy} data-testid="start-in-studio">
              <FolderInput /> Start it in the studio
            </Button>
            {m.isAdmin && (
              <Button asChild variant="ghost">
                <Link href={m.adminHref(`campaigns/${c.id}`)}>
                  <Pencil /> Edit campaign
                </Link>
              </Button>
            )}
          </div>
          {!lm.isOwner && <p className="mt-2 text-xs text-muted-foreground">Ticks are saved for {lm.name}.</p>}
        </div>
      </section>

      {lock && <LockNotice reason={lock} className="mt-6" />}

      <SectionTitle className="mt-8">What&apos;s included</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="included-grid">
        {sections.map((s) => {
          const Icon = SECTION_ICONS[s.key];
          return (
            <a key={s.key} href={usable ? `#${s.key}` : undefined} className={cn("flex flex-col gap-1.5 rounded-xl border bg-card p-3.5 transition", usable && "hover:border-primary/40 hover:shadow-sm", !s.filled && "opacity-60")} data-testid={`included-${s.key}`}>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-4" />
              </span>
              <span className="text-[13px] font-semibold leading-tight">{s.label}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{s.summary}</span>
            </a>
          );
        })}
      </div>

      {usable && (
        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 grid-cols-1 content-start gap-6">
            <CampaignSections c={c} progress={progress ?? null} />
          </div>
          <div className="hidden xl:block">
            <Card className="sticky top-4 p-4">
              <div className="flex items-center gap-3">
                <ProgressRing value={prog.percent} size={56} />
                <div>
                  <p className="text-sm font-semibold">Your launch progress</p>
                  <p className="text-xs text-muted-foreground" data-testid="campaign-progress">
                    {prog.done} of {prog.total} steps done
                  </p>
                </div>
              </div>
              <nav className="mt-4 grid gap-0.5 text-sm" aria-label="Campaign sections">
                {sections.map((s, i) => (
                  <a key={s.key} href={`#${s.key}`} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    {i + 1}. {s.label}
                  </a>
                ))}
              </nav>
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function SectionCard({ id, n, title, description, actions, children }: { id: CampaignSectionKey; n: number; title: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  const Icon = SECTION_ICONS[id];
  return (
    <Card id={id} className="scroll-mt-4" data-testid={`section-${id}`}>
      <CardHeader className="flex flex-row flex-wrap items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>
            {n}. {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const CHANNEL_BADGE: Record<CalendarChannel, "default" | "secondary" | "success" | "warning" | "outline"> = { launch: "success", email: "default", social: "secondary", content: "warning", task: "outline" };

/** Every section of a campaign, read-only for members (the admin editor previews it the same way). */
export function CampaignSections({ c, progress, preview = false }: { c: CampaignDrop; progress: LabProgress | null; preview?: boolean }) {
  const m = useMember();
  const lm = useLabMember();
  const f = c.featured;
  const p = c.positioning;
  const base = slugify(c.featured.title || c.title, "campaign");
  const done = progress?.done ?? {};
  const sales = c.salesPage.sections.filter((s) => s.enabled);
  return (
    <>
      <SectionCard id="featured" n={1} title="Featured PLR product" description={f.subtitle}>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <p className="text-lg font-semibold">{f.title || "Not chosen yet"}</p>
            <p className="text-xs text-muted-foreground">{f.format}</p>
          </div>
          {f.description && <Markdown source={f.description} className="text-sm" />}
          {f.contents.length > 0 && (
            <div>
              <p className="mb-1.5 text-[13px] font-semibold">Contents</p>
              <ol className="grid list-decimal gap-1 pl-5 text-sm">
                {f.contents.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ol>
            </div>
          )}
          {f.files.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {f.files.map((x) => (
                <FileRow key={x.id} file={x} label={`${c.title}: ${f.title}`} locked={preview ? "Preview" : null} />
              ))}
            </ul>
          )}
          {f.licenceNotes && <p className="rounded-lg bg-secondary/70 p-3 text-[13px] leading-relaxed">{f.licenceNotes}</p>}
          {m.isAdmin && f.source.kind === "project" && <p className="text-xs text-muted-foreground">Built from the studio project “{f.source.projectName}”.</p>}
        </div>
      </SectionCard>

      <SectionCard id="rebrand" n={2} title="Rebranding instructions" actions={<ToolButton tool={{ label: "Rebrand Studio", href: "/rebrand" }} size="sm" />}>
        <Markdown source={c.rebrand.steps} className="text-sm" />
        {c.rebrand.rules.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Find</th>
                  <th className="px-3 py-2 font-medium">Replace with</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {c.rebrand.rules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-mono text-xs">{r.find}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.replace}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard id="positioning" n={3} title="Product positioning">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {(
            [
              ["Who it's for", p.audience],
              ["Their problem", p.problem],
              ["The promise", p.promise],
              ["Your angle", p.angle],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-1">{v || "—"}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested price</dt>
            <dd className="mt-1">{p.pricePoint ? `${p.currency} ${p.pricePoint}` : "Your choice"}</dd>
          </div>
          {p.offerStack.length > 0 && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offer stack</dt>
              <dd className="mt-1">
                <ul className="list-disc pl-5">
                  {p.offerStack.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
        {p.notes && <Markdown source={p.notes} className="mt-4 text-sm" />}
      </SectionCard>

      <SectionCard
        id="sales"
        n={4}
        title="Sales-page copy"
        description="Edit the [placeholders] with your own details before publishing."
        actions={
          <>
            <CopyButton text={salesCopyMarkdown(c)} label="Copy all" size="sm" />
            <Button size="sm" variant="outline" onClick={() => downloadText(salesPageHtml(campaignSalesPageData(c), { title: f.title || c.title }), `${base}-sales-page.html`, "text/html")}>
              <FileCode /> Page (.html)
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5">
          {sales.map((s) => (
            <div key={s.id} className="border-l-2 border-primary/30 pl-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{SALES_SECTION_LABELS[s.type]}</p>
              {s.heading && <p className={cn("mt-1 font-semibold", s.type === "headline" ? "text-xl" : "text-base")}>{s.heading}</p>}
              {s.subheading && <p className="mt-0.5 text-sm text-muted-foreground">{s.subheading}</p>}
              {s.body && <Markdown source={s.body} className="mt-1.5 text-sm" />}
              {s.bullets.filter((b) => b.trim()).length > 0 && (
                <ul className="mt-1.5 list-disc pl-5 text-sm">
                  {s.bullets.filter((b) => b.trim()).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {s.items.length > 0 && (
                <dl className="mt-1.5 grid gap-2 text-sm">
                  {s.items.map((it) => (
                    <div key={it.id}>
                      <dt className="font-medium">{it.title}</dt>
                      <dd className="text-muted-foreground">{it.text}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {s.buttonText && <span className="mt-2 inline-block rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">{s.buttonText}</span>}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard id="emails" n={5} title="Email marketing sequence" description={plural(c.emails.length, "email")} actions={<Button size="sm" variant="outline" onClick={() => downloadText(emailsCsv(c), `${base}-emails.csv`, "text/csv")}>Emails (.csv)</Button>}>
        <ul className="grid grid-cols-1 gap-2">
          {[...c.emails].sort((a, b) => a.day - b.day).map((e) => (
            <li key={e.id} className="rounded-lg border">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5">
                  <Badge variant="secondary" className="shrink-0">
                    {dayText(e.day)}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.subject}</span>
                    <span className="block truncate text-xs text-muted-foreground">{e.preview}</span>
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">{dayLabel(entryDate(c, e.day), { day: "numeric", month: "short" })}</span>
                </summary>
                <div className="border-t px-3 py-3">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{e.body}</pre>
                  {e.ctaText && <p className="mt-2 text-sm font-medium text-primary">{e.ctaText} →</p>}
                  <CopyButton text={`Subject: ${e.subject}\n\n${e.body}${e.ctaText ? `\n\n${e.ctaText}: ${e.ctaUrl || "[your link]"}` : ""}`} className="mt-3" label="Copy email" />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard id="social" n={6} title="Social media content" description={plural(c.social.length, "post")} actions={<Button size="sm" variant="outline" onClick={() => downloadText(socialCsv(c), `${base}-posts.csv`, "text/csv")}>Posts (.csv)</Button>}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[...c.social].sort((a, b) => a.day - b.day).map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{dayText(s.day)}</Badge>
                <Badge variant="outline">{SOCIAL_PLATFORM_LABELS[s.platform]}</Badge>
                <span className="text-xs capitalize text-muted-foreground">{s.type}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{s.text}</p>
              {s.hashtags.length > 0 && <p className="text-xs text-primary">{s.hashtags.map((h) => `#${h}`).join(" ")}</p>}
              <CopyButton text={`${s.text}${s.hashtags.length ? `\n\n${s.hashtags.map((h) => `#${h}`).join(" ")}` : ""}`} className="mt-auto self-start" />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard id="leadMagnet" n={7} title="Lead magnet" description={c.leadMagnet.format}>
        <p className="font-semibold">{c.leadMagnet.title || "No lead magnet this month"}</p>
        {c.leadMagnet.description && <p className="mt-1 text-sm text-muted-foreground">{c.leadMagnet.description}</p>}
        {c.leadMagnet.outline.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm">
            {c.leadMagnet.outline.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
        {c.leadMagnet.files.length > 0 && (
          <ul className="mt-3 divide-y rounded-lg border">
            {c.leadMagnet.files.map((x) => (
              <FileRow key={x.id} file={x} label={`${c.title}: lead magnet`} locked={preview ? "Preview" : null} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard id="bonuses" n={8} title="Bonus materials" description={plural(c.bonuses.length, "bonus", "bonuses")}>
        {c.bonuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bonuses this month.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {c.bonuses.map((b) => (
              <div key={b.id} className="rounded-lg border p-3">
                <p className="font-semibold">{b.title}</p>
                {b.description && <p className="mt-0.5 text-sm text-muted-foreground">{b.description}</p>}
                {b.files.length > 0 && (
                  <ul className="mt-2 divide-y rounded-md border">
                    {b.files.map((x) => (
                      <FileRow key={x.id} file={x} label={`${c.title}: ${b.title}`} locked={preview ? "Preview" : null} />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard id="checklist" n={9} title="Launch checklist" description={preview ? "Members tick these off as they go." : `Tick steps off as you go${lm.isOwner ? "" : ` (saved for ${lm.name})`}.`} actions={<CountChip done={c.checklist.filter((i) => done[checkKey(i.id)]).length} total={c.checklist.length} />}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {CAMPAIGN_PHASES.map((ph) => {
            const items = c.checklist.filter((i) => i.phase === ph);
            if (!items.length) return null;
            return (
              <div key={ph}>
                <p className="mb-2 text-[13px] font-semibold">{CAMPAIGN_PHASE_LABELS[ph]}</p>
                <ul className="grid grid-cols-1 gap-2" data-testid={`checklist-${ph}`}>
                  {items.map((i) => {
                    const id = `cc-${i.id}`;
                    const ticked = !!done[checkKey(i.id)];
                    return (
                      <li key={i.id} className="flex items-start gap-2.5">
                        <Checkbox id={id} checked={ticked} disabled={preview} onCheckedChange={(v) => void setDone(m.brandId, lm.memberId, "campaign", c.id, checkKey(i.id), !!v).catch((e) => toast.error(errorMessage(e)))} className="mt-0.5" />
                        <label htmlFor={id} className={cn("cursor-pointer text-sm leading-snug", ticked && "text-muted-foreground line-through")}>
                          {i.text}
                          {i.day !== null && <span className="ml-1.5 text-xs text-muted-foreground">· {dayLabel(entryDate(c, i.day), { day: "numeric", month: "short" })}</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        id="calendar"
        n={10}
        title="Promotional calendar"
        description={`Dates assume a launch on ${dayLabel(campaignLaunchDate(c), { day: "numeric", month: "long" })} — shift them to suit you.`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => downloadText(calendarIcs(c), `${base}-calendar.ics`, "text/calendar")} data-testid="calendar-ics">
              <CalendarPlus /> Calendar (.ics)
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadText(calendarCsv(c), `${base}-calendar.csv`, "text/csv")}>
              Calendar (.csv)
            </Button>
          </>
        }
      >
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" data-testid="promo-calendar">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">What</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {c.calendar.map((e) => (
                <tr key={e.id} className={cn(e.channel === "launch" && "bg-success-soft/40")}>
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    <span className="block font-medium">{dayLabel(entryDate(c, e.day), { weekday: "short", day: "numeric", month: "short" })}</span>
                    <span className="block text-xs text-muted-foreground">{dayText(e.day)}</span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge variant={CHANNEL_BADGE[e.channel]}>{CALENDAR_CHANNEL_LABELS[e.channel]}</Badge>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="block font-medium">{e.title}</span>
                    {e.detail && <span className="block text-xs text-muted-foreground">{e.detail}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
