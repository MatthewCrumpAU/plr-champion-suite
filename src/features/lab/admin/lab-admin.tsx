"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CircleAlert, CircleCheck, Database, Eye, GraduationCap, Megaphone, Package, Plus, Route, Trash2, UserRoundCog, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, PageContainer, PageHeader, SectionTitle, Stat } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm";
import { useMemberLive } from "@/lib/membership/hooks";
import { isLive } from "@/lib/membership/access";
import { effectiveTier } from "@/lib/membership/entitlements";
import { ACCESS_TIER_LABELS } from "@/lib/membership/types";
import { phaseOf } from "@/lib/lab/build-days";
import { campaignSections } from "@/lib/lab/campaigns";
import { dayLabel, monthLabel, monthOf } from "@/lib/lab/dates";
import { generatePlan, PATH_STATUS_LABELS, pathStats, profileId } from "@/lib/lab/profit-path";
import { deleteProfile } from "@/lib/lab/store";
import { BUSINESS_MODEL_LABELS, EXPERIENCE_SHORT } from "@/lib/lab/types";
import { formatBytes, plural } from "@/lib/utils";
import { useMember } from "@/features/membership/member-context";
import { AdminGate } from "@/features/membership/admin/admin-gate";
import { Loading } from "../lab-ui";

/* ------------------------------------------------------------------------------------------ */
/* Admin overview                                                                               */
/* ------------------------------------------------------------------------------------------ */

export function LabAdminHome() {
  return (
    <AdminGate>
      <Overview />
    </AdminGate>
  );
}

function Overview() {
  const m = useMember();
  const { data, loading } = useMemberLive(
    async (r) => {
      const [campaigns, days, profiles, courses, resources, files] = await Promise.all([r.campaigns.list(m.brandId), r.buildDays.list(m.brandId), r.labProfiles.list(m.brandId), r.courses.list(m.brandId), r.resources.list(m.brandId), r.files.listMeta()]);
      return { campaigns, days, profiles, courses, resources, bytes: files.filter((f) => f.brandId === m.brandId).reduce((n, f) => n + f.size, 0) };
    },
    [m.brandId],
  );
  if (loading || !data) return <Loading />;
  const now = new Date();
  const thisMonth = monthOf(now);
  const next = monthOf(now, 1);
  const live = data.campaigns.filter((c) => isLive(c, now)).length;
  const upcomingDays = data.days.filter((b) => phaseOf(b, now) !== "past").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const attention: { text: string; href: string }[] = [];
  for (const month of [thisMonth, next]) {
    const c = data.campaigns.find((x) => x.month === month);
    if (!c) attention.push({ text: `No Campaign Drop for ${monthLabel(month)} yet`, href: m.adminHref("campaigns") });
    else {
      const missing = campaignSections(c).filter((s) => !s.filled);
      if (missing.length) attention.push({ text: `${c.title}: ${missing.map((s) => s.label.toLowerCase()).join(", ")} not ready`, href: m.adminHref(`campaigns/${c.id}`) });
      if (c.status === "draft") attention.push({ text: `${c.title} is still a draft`, href: m.adminHref(`campaigns/${c.id}`) });
    }
  }
  if (!data.days.some((b) => b.month === next)) attention.push({ text: `No Build Day planned for ${monthLabel(next)}`, href: m.adminHref("build-days") });
  const nextDay = upcomingDays[0];
  if (nextDay && !nextDay.joinUrl && nextDay.format === "live-online") attention.push({ text: `${nextDay.title} has no meeting link yet`, href: m.adminHref(`build-days/${nextDay.id}`) });
  if (nextDay && nextDay.status === "draft") attention.push({ text: `${nextDay.title} hasn't been announced`, href: m.adminHref(`build-days/${nextDay.id}`) });

  const sections = [
    { path: "campaigns", label: "Campaign Drop Creator", text: `${plural(data.campaigns.length, "campaign")} · ${live} live`, icon: Megaphone },
    { path: "build-days", label: "Build Day Planner", text: `${plural(data.days.length, "Build Day")} · ${upcomingDays.length} upcoming`, icon: CalendarDays },
    { path: "profit-paths", label: "Profit Path profiles", text: plural(data.profiles.length, "plan"), icon: UserRoundCog },
    { path: "courses", label: "Training", text: plural(data.courses.length, "course or tutorial", "courses and tutorials"), icon: GraduationCap },
    { path: "resources", label: "Resources", text: plural(data.resources.length, "resource"), icon: Package },
    { path: "access", label: "Members & access", text: "Test profiles, bundles and linked accounts", icon: Users },
    { path: "data", label: "Data & backup", text: `${formatBytes(data.bytes)} stored in this browser`, icon: Database },
  ];

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow={`${m.brand.name} · Membership Admin`}
        title="Admin overview"
        description="Plan each month's Campaign Drop and Build Day, and set up Profit Path answers for test profiles. Everything is stored in this browser until the move to a hosted database."
        actions={
          <Button asChild>
            <Link href={m.adminHref("campaigns")}>
              <Plus /> New campaign
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Live campaigns" value={live} hint={`${data.campaigns.filter((c) => c.status === "draft").length} drafts`} />
        <Stat label="Upcoming Build Days" value={upcomingDays.length} hint={nextDay ? `Next: ${new Date(nextDay.startsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : "None planned"} />
        <Stat label="Profit Path plans" value={data.profiles.length} />
        <Stat label="Storage used" value={formatBytes(data.bytes)} />
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <SectionTitle>Manage</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sections.map((s) => (
              <Link key={s.path} href={m.adminHref(s.path)} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <s.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{s.label}</span>
                  <span className="block text-sm text-muted-foreground">{s.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
        <section>
          <SectionTitle>Monthly rhythm</SectionTitle>
          {attention.length ? (
            <Card className="divide-y" data-testid="lab-attention">
              {attention.map((a) => (
                <Link key={a.text} href={a.href} className="flex items-center gap-3 p-3 text-sm hover:bg-secondary/40">
                  <CircleAlert className="size-4 shrink-0 text-warning" />
                  <span className="min-w-0 flex-1">{a.text}</span>
                </Link>
              ))}
            </Card>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              <CircleCheck className="size-4 text-success" /> This month and next are planned.
            </p>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Profit Path profiles                                                                         */
/* ------------------------------------------------------------------------------------------ */

export function ProfitPathsAdmin() {
  return (
    <AdminGate>
      <Profiles />
    </AdminGate>
  );
}

function Profiles() {
  const m = useMember();
  const router = useRouter();
  const confirm = useConfirm();
  const { data, loading } = useMemberLive(
    async (r) => {
      const [accounts, profiles, progress] = await Promise.all([r.accounts.list(), r.labProfiles.list(m.brandId), r.labProgress.list(m.brandId)]);
      return { accounts, profiles, progress };
    },
    [m.brandId],
  );
  if (loading || !data) return <Loading />;
  const members = data.accounts.filter((a) => a.role === "owner" || effectiveTier(a, m.brandId, data.accounts));
  const open = (accountId: string, owner: boolean) => {
    m.setPreviewTier(owner ? "owner" : `account:${accountId}`);
    router.push(m.href("profit-path"));
  };
  return (
    <PageContainer>
      <PageHeader eyebrow="Profit Lab Admin" title="Profit Path profiles" description="Each member's answers shape their 90-day plan. In private testing, open a test profile's plan to answer the questions for them, tick tasks and check what they'd see." />
      <Callout tone="info" className="mb-6" title="No public sign-up">
        Profiles here are you and the test profiles you create in Members &amp; access. Real members will answer the questions themselves once accounts are switched on.
      </Callout>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm" data-testid="profiles-table">
          <thead className="border-b bg-secondary/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Member</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Progress</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((a) => {
              const p = data.profiles.find((x) => x.id === profileId(a.id));
              const owner = a.role === "owner";
              const tier = owner ? null : effectiveTier(a, m.brandId, data.accounts);
              const stats = p ? pathStats(generatePlan(p), data.progress.find((x) => x.kind === "path" && x.memberId === a.id && x.refId === p.id)) : null;
              return (
                <tr key={a.id} data-testid="profile-row">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium">{a.displayName}</p>
                    <p className="text-xs text-muted-foreground">{owner ? "You (owner)" : `${a.email}${tier ? ` · ${ACCESS_TIER_LABELS[tier]}` : ""}`}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {p ? (
                      <>
                        <p>
                          {EXPERIENCE_SHORT[p.experience]} · {p.hoursPerWeek} h/week · {plural(p.launches, "launch", "launches")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {BUSINESS_MODEL_LABELS[p.businessModel]} · from {dayLabel(p.startDate, { day: "numeric", month: "short" })}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not set up</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {stats ? (
                      <>
                        <Badge variant={stats.status === "behind" ? "warning" : stats.status === "not-started" ? "secondary" : "success"}>{PATH_STATUS_LABELS[stats.status]}</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {stats.done}/{stats.total} tasks · {stats.percent}%
                        </p>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <div className="flex justify-end gap-1">
                      <Button size="xs" variant="outline" onClick={() => open(a.id, owner)} data-testid={`open-path-${a.email}`}>
                        <Eye /> {p ? "Open plan" : "Set up plan"}
                      </Button>
                      {p && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Delete ${a.displayName}'s plan`}
                          onClick={async () => {
                            if (!(await confirm({ title: `Delete ${a.displayName}'s plan?`, description: "Their answers, ticks and reflections are deleted.", confirmLabel: "Delete plan", destructive: true }))) return;
                            await deleteProfile(a.id);
                            toast.success("Plan deleted");
                          }}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Need another test member?{" "}
        <Link href={m.adminHref("access")} className="font-medium text-primary hover:underline">
          Create a test profile
        </Link>{" "}
        with Profit Lab access, then set up their plan here.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        <Route className="mr-1 inline size-3" /> Opening a test profile&apos;s plan switches &quot;View as&quot; to them — exit the preview from the yellow banner.
      </p>
    </PageContainer>
  );
}
