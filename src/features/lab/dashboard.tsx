"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, GraduationCap, Megaphone, Rocket, Route, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageContainer, Progress, SectionTitle } from "@/components/ui/primitives";
import { useMemberLive } from "@/lib/membership/hooks";
import { isLive } from "@/lib/membership/access";
import { countdown, endsAt, phaseOf } from "@/lib/lab/build-days";
import { campaignLaunchDate } from "@/lib/lab/campaigns";
import { dayLabel, monthLabel, monthOf, todayDay } from "@/lib/lab/dates";
import { hoursText, PATH_STATUS_LABELS, type PathStats } from "@/lib/lab/profit-path";
import type { CampaignDrop, ProfitPathProfile } from "@/lib/lab/types";
import { cn, plural } from "@/lib/utils";
import { useMember } from "@/features/membership/member-context";
import { StoredImage } from "@/features/membership/ui";
import { campaignProgress, useCampaigns } from "./campaigns";
import { PhaseBadge, useBuildDays, useNow } from "./build-days";
import { Loading, ProgressRing, useLabMember } from "./lab-ui";
import { TaskList, usePathActions, usePathSummary } from "./profit-path";

/** PLR Profit Lab's home: today's Profit Path tasks, this month's Campaign Drop and the next Build Day. */
export function LabDashboard() {
  const m = useMember();
  const lm = useLabMember();
  const now = useNow();
  const path = usePathSummary();
  const { data: campaigns } = useCampaigns();
  const { data: days } = useBuildDays();
  const { data: courses } = useMemberLive((r) => r.courses.list(m.brandId), [m.brandId]);
  if (path.loading || !campaigns || !days) return <Loading />;

  const thisMonth = monthOf(now);
  const visibleCampaigns = campaigns.campaigns.filter((c) => m.canSee(c));
  const campaign: CampaignDrop | undefined = visibleCampaigns.find((c) => c.month === thisMonth) ?? visibleCampaigns.find((c) => isLive(c));
  const nextDay = days.days.filter((b) => m.canSee(b) && phaseOf(b, now) !== "past")[0];
  const firstCourse = (courses ?? []).filter((c) => m.canSee({ status: c.status, publishAt: null })).sort((a, b) => a.order - b.order)[0];
  const theme = m.brand.theme;

  return (
    <PageContainer width="wide">
      <section className="relative overflow-hidden rounded-2xl p-6 text-white shadow-sm sm:p-8" style={{ background: `linear-gradient(120deg, ${theme.sidebar} 0%, ${theme.sidebarAccent} 45%, ${theme.primary} 130%)` }}>
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-25 blur-2xl" style={{ background: theme.highlight }} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.highlight }}>
          {m.brand.tagline}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {lm.name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-[15px]">{m.brand.promise}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild className="bg-white text-foreground hover:bg-white/90">
            <Link href={m.href(path.profile ? "profit-path?tab=today" : "profit-path")} data-testid="hero-path">
              <Route /> {path.profile ? "Today's tasks" : "Build your 90-day plan"}
            </Link>
          </Button>
          {campaign && (
            <Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href={m.href(`campaigns/${campaign.id}`)}>
                <Megaphone /> {monthLabel(campaign.month)} campaign
              </Link>
            </Button>
          )}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="lab-modules">
        {/* Profit Path */}
        <Card className="flex flex-col gap-3 p-5" data-testid="module-path">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Route className="size-4" /> 90-Day Profit Path
          </div>
          {path.plan && path.stats ? (
            <>
              <div className="flex items-center gap-4">
                <ProgressRing value={path.stats.percent} />
                <div className="min-w-0">
                  <Badge>{PATH_STATUS_LABELS[path.stats.status]}</Badge>
                  <p className="mt-1 text-sm font-semibold">
                    {path.stats.dayOfPlan < 1 ? `Starts ${dayLabel(path.plan.startDate)}` : path.stats.dayOfPlan > 90 ? "Plan finished" : `Week ${path.stats.currentWeek} · day ${path.stats.dayOfPlan}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {path.stats.done} of {path.stats.total} tasks · {hoursText(path.stats.minutesDone)} done
                  </p>
                </div>
              </div>
              {path.stats.currentWeek >= 1 && path.stats.currentWeek <= 13 && <p className="text-sm text-muted-foreground">This week: {path.plan.weeks[path.stats.currentWeek - 1].milestone}</p>}
              <Button asChild variant="outline" size="sm" className="mt-auto self-start">
                <Link href={m.href("profit-path")}>
                  Open your plan <ArrowRight />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Answer five questions — your experience, hours, what you already have, your business model and launch goals — and get a 13-week plan with daily tasks and launch checklists.</p>
              <Button asChild size="sm" className="mt-auto self-start">
                <Link href={m.href("profit-path")}>Build my plan</Link>
              </Button>
            </>
          )}
        </Card>

        {/* Campaign Drop */}
        <Card className="flex flex-col gap-3 p-5" data-testid="module-campaign">
          {campaign ? (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Megaphone className="size-4" /> {monthLabel(campaign.month)} Campaign Drop
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex gap-3">
                  <StoredImage fileId={campaign.coverFileId} alt="" className="aspect-[3/4] w-14 shrink-0 self-start rounded shadow ring-1 ring-black/5" />
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{campaign.theme || campaign.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {campaign.featured.title} · launch {dayLabel(campaignLaunchDate(campaign), { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
                <CampaignBar c={campaign} progress={campaigns.progress.get(campaign.id)} />
                <Button asChild variant="outline" size="sm" className="mt-auto self-start">
                  <Link href={m.href(`campaigns/${campaign.id}`)}>
                    Open the campaign <ArrowRight />
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Megaphone className="size-4" /> Campaign Drop
              </div>
              <p className="text-sm text-muted-foreground">This month&apos;s campaign hasn&apos;t been released yet.</p>
              <Button asChild variant="outline" size="sm" className="mt-auto self-start">
                <Link href={m.href("campaigns")}>All campaigns</Link>
              </Button>
            </div>
          )}
        </Card>

        {/* Build Day */}
        <Card className="flex flex-col gap-3 p-5" data-testid="module-build-day">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <CalendarDays className="size-4" /> Next Build Day
          </div>
          {nextDay ? (
            <>
              <div className="flex items-center gap-2">
                <PhaseBadge phase={phaseOf(nextDay, now)} />
                {days.progress.get(nextDay.id)?.rsvp === "going" && <Badge variant="success">You&apos;re going</Badge>}
              </div>
              <p className="font-semibold leading-snug">{nextDay.title}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(nextDay.startsAt).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · {new Date(nextDay.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}–{endsAt(nextDay).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </p>
              {countdown(nextDay, now) && <p className="text-lg font-semibold text-primary">{countdown(nextDay, now)} to go</p>}
              <Button asChild variant="outline" size="sm" className="mt-auto self-start">
                <Link href={m.href(`build-days/${nextDay.id}`)}>
                  Open Build Day <ArrowRight />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">The next Build Day hasn&apos;t been announced yet.</p>
              <Button asChild variant="outline" size="sm" className="mt-auto self-start">
                <Link href={m.href("build-days")}>Past Build Days</Link>
              </Button>
            </>
          )}
        </Card>
      </div>

      {m.isAdmin && <AdminSnapshot campaigns={campaigns.campaigns} />}

      <div className={cn("mt-8 grid grid-cols-1 gap-6", path.plan && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
        {path.profile && path.plan && path.stats && (
          <section className="min-w-0">
            <TodayPreview profile={path.profile} stats={path.stats} done={path.progress?.done ?? {}} />
          </section>
        )}
        {firstCourse && (
          <section className={cn(!path.plan && "max-w-xl")}>
            <SectionTitle>Start here</SectionTitle>
            <Link href={m.href(`courses/${firstCourse.id}`)} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <GraduationCap className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{firstCourse.title}</span>
                <span className="block truncate text-sm text-muted-foreground">{firstCourse.summary}</span>
              </span>
            </Link>
          </section>
        )}
      </div>
    </PageContainer>
  );
}

function CampaignBar({ c, progress }: { c: CampaignDrop; progress: Parameters<typeof campaignProgress>[1] }) {
  const p = campaignProgress(c, progress);
  return (
    <div className="flex items-center gap-2">
      <Progress value={p.percent} className="flex-1" />
      <span className="text-xs tabular-nums text-muted-foreground">
        {p.done}/{p.total} steps
      </span>
    </div>
  );
}

function TodayPreview({ profile, stats, done }: { profile: ProfitPathProfile; stats: PathStats; done: Record<string, string> }) {
  const m = useMember();
  const actions = usePathActions(profile);
  const today = todayDay();
  const tasks = stats.today;
  const overdue = stats.overdue.length;
  return (
    <>
      <SectionTitle action={<Link href={m.href("profit-path?tab=today")} className="text-xs font-medium text-primary hover:underline">Open Today</Link>}>
        Today · {dayLabel(today, { weekday: "long", day: "numeric", month: "short" })}
      </SectionTitle>
      {tasks.length ? (
        <TaskList tasks={tasks.slice(0, 6)} done={done} actions={actions} testId="dashboard-tasks" />
      ) : (
        <Card className="p-5 text-sm text-muted-foreground" data-testid="dashboard-tasks">
          Nothing planned today.{stats.next ? ` Next up: “${stats.next.title}” on ${dayLabel(stats.next.date!)}.` : ""}
        </Card>
      )}
      {overdue > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          <Rocket className="mr-1 inline size-3.5" /> {plural(overdue, "earlier task")} to catch up on in your plan.
        </p>
      )}
    </>
  );
}

function AdminSnapshot({ campaigns }: { campaigns: CampaignDrop[] }) {
  const m = useMember();
  const { data } = useMemberLive(async (r) => ({ days: await r.buildDays.list(m.brandId), profiles: await r.labProfiles.list(m.brandId) }), [m.brandId]);
  const drafts = campaigns.filter((c) => c.status === "draft").length;
  const next = monthOf(new Date(), 1);
  const hasNext = campaigns.some((c) => c.month === next);
  return (
    <Card className="mt-6 flex flex-col gap-3 border-dashed p-4 sm:flex-row sm:items-center" data-testid="admin-snapshot">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Settings2 className="size-5" />
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Profit Lab admin</p>
        <p className="text-muted-foreground">
          {plural(campaigns.length, "campaign")} · {plural(drafts, "draft")} · {plural(data?.days.length ?? 0, "Build Day")} · {plural(data?.profiles.length ?? 0, "Profit Path profile")}
          {!hasNext && ` · nothing planned for ${monthLabel(next)} yet`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={m.adminHref("campaigns")}>Campaign Drop Creator</Link>
        </Button>
        <Button asChild size="sm">
          <Link href={m.adminHref()}>Open admin</Link>
        </Button>
      </div>
    </Card>
  );
}
