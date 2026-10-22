"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  Download,
  Flag,
  Flame,
  Lightbulb,
  ListChecks,
  Lock,
  MoreHorizontal,
  Plus,
  Printer,
  RotateCcw,
  Rocket,
  Route,
  Sparkles,
  Target,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, EmptyState, Field, Input, NativeSelect, PageContainer, PageHeader, Progress, SectionTitle, Slider, Switch, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { useProjects } from "@/lib/data/hooks";
import { useMemberLive } from "@/lib/membership/hooks";
import { tierAtLeast } from "@/lib/membership/access";
import { addDays, dayLabel, todayDay, WEEKDAY_SHORT } from "@/lib/lab/dates";
import {
  defaultProfile,
  generatePlan,
  hoursText,
  inPlan,
  isCounted,
  MAX_FIRST_LAUNCH_WEEK,
  MIN_FIRST_LAUNCH_WEEK,
  PATH_STATUS_LABELS,
  pathCsv,
  pathIcs,
  pathMarkdown,
  pathStats,
  PLAN_WEEKS,
  profileId,
  suggestedLaunchWeek,
  type PathStats,
  type PathStatus,
  type PlanTask,
  type ProfitPlan,
} from "@/lib/lab/profit-path";
import { PATH_CATEGORY_LABELS, PATH_PRIORITY_LABELS, STAGES } from "@/lib/lab/path-templates";
import { addCustomTask, deleteProfile, removeCustomTask, resetProgress, saveProfile, setDone, setNote, setTaskSkipped } from "@/lib/lab/store";
import { BUSINESS_MODEL_HINTS, BUSINESS_MODEL_LABELS, EXPERIENCE_LABELS, type BusinessModel, type Experience, type ProfitPathProfile } from "@/lib/lab/types";
import { cn, errorMessage, formatMoney, formatNumber, plural, slugify } from "@/lib/utils";
import { useMember } from "@/features/membership/member-context";
import { CountChip, downloadText, Loading, ProgressRing, ToolButton, useLabMember, useLabProgress } from "./lab-ui";

/* ------------------------------------------------------------------------------------------ */
/* Page                                                                                         */
/* ------------------------------------------------------------------------------------------ */

export function ProfitPathPage() {
  const m = useMember();
  const lm = useLabMember();
  const { data: stored, loading } = useMemberLive((r) => r.labProfiles.get(profileId(lm.memberId)), [lm.memberId]);
  if (!tierAtLeast(m.viewer.tier, "member")) {
    return (
      <PageContainer width="narrow">
        <EmptyState icon={<Lock />} title="The 90-Day Profit Path is for members" description={`Your plan, weekly milestones and launch checklists unlock with a ${m.brand.name} membership.`} />
      </PageContainer>
    );
  }
  if (loading) return <Loading />;
  const profile = stored && stored.brandId === m.brandId ? stored : null;
  return profile ? <PathView key={profile.id} profile={profile} /> : <PathSetup />;
}

/* ------------------------------------------------------------------------------------------ */
/* Questions                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const STEPS = [
  { id: "experience", title: "Experience", hint: "Where you're starting from" },
  { id: "time", title: "Working hours", hint: "The time you really have" },
  { id: "assets", title: "What you have", hint: "Products, list and tools" },
  { id: "model", title: "Business model", hint: "How you'll make money" },
  { id: "goals", title: "Launch goals", hint: "Launches and targets" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const CURRENCIES = ["USD", "AUD", "GBP", "EUR", "CAD", "NZD"];

type Patch = (patch: Partial<ProfitPathProfile>) => void;

function OptionCard({ selected, onSelect, title, hint, testId }: { selected: boolean; onSelect: () => void; title: string; hint?: string; testId?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid={testId}
      className={cn("flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition", selected ? "border-primary bg-primary-soft/60 ring-1 ring-primary" : "bg-card hover:border-primary/40")}
    >
      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-primary" : "border-muted-foreground/40")}>{selected && <span className="size-2 rounded-full bg-primary" />}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}

const numberValue = (v: string, fallback = 0) => (v.trim() === "" ? fallback : Number(v));

function ExperienceStep({ p, patch, autoLaunch }: { p: ProfitPathProfile; patch: Patch; autoLaunch: boolean }) {
  return (
    <div role="radiogroup" aria-label="Experience" className="grid grid-cols-1 gap-2">
      {(Object.keys(EXPERIENCE_LABELS) as Experience[]).map((e) => {
        const [title, hint] = EXPERIENCE_LABELS[e].split(" — ");
        return <OptionCard key={e} selected={p.experience === e} title={title} hint={hint} testId={`exp-${e}`} onSelect={() => patch({ experience: e, ...(autoLaunch ? { firstLaunchWeek: suggestedLaunchWeek(e) } : {}) })} />;
      })}
      <p className="text-xs text-muted-foreground">Beginners get more time per task and an extra week before the first launch. You can change this any time.</p>
    </div>
  );
}

function TimeStep({ p, patch }: { p: ProfitPathProfile; patch: Patch }) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <Field label={`Hours a week: ${p.hoursPerWeek}`} htmlFor="pp-hours" hint="Be honest — the plan fits its core tasks into this time and marks the rest as optional.">
        <div className="flex items-center gap-3">
          <Slider min={1} max={40} step={1} value={[Math.min(40, p.hoursPerWeek)]} onValueChange={([v]) => patch({ hoursPerWeek: v })} aria-label="Hours a week" className="flex-1" />
          <Input id="pp-hours" type="number" min={1} max={80} value={p.hoursPerWeek} onChange={(e) => patch({ hoursPerWeek: numberValue(e.target.value, 1) })} className="w-20" />
        </div>
      </Field>
      <Field label="Days you can work" hint="Tasks are only planned on these days.">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days you can work">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = p.workDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                data-testid={`workday-${d}`}
                onClick={() => patch({ workDays: on ? p.workDays.filter((x) => x !== d) : [...p.workDays, d] })}
                className={cn("h-9 min-w-12 rounded-lg border px-3 text-sm font-medium transition", on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40")}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Start date" htmlFor="pp-start" hint={`Day 1 of 90. The plan ends on ${dayLabel(addDays(p.startDate, 89), { day: "numeric", month: "long", year: "numeric" })}.`}>
        <Input id="pp-start" type="date" value={p.startDate} onChange={(e) => e.target.value && patch({ startDate: e.target.value })} className="w-48" />
      </Field>
    </div>
  );
}

function AssetsStep({ p, patch }: { p: ProfitPathProfile; patch: Patch }) {
  const { data: projects } = useProjects();
  const toggles: { key: "hasWebsite" | "hasCheckout" | "hasSocialAudience"; label: string; hint: string }[] = [
    { key: "hasWebsite", label: "A website or landing-page tool", hint: "Somewhere to publish a sales page" },
    { key: "hasCheckout", label: "A way to take payments", hint: "Gumroad, Payhip, Stripe, PayPal…" },
    { key: "hasSocialAudience", label: "A social media following", hint: "Any platform where people know you" },
  ];
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 items-start sm:grid-cols-2">
        <Field label="Niche or audience" htmlFor="pp-niche" optional>
          <Input id="pp-niche" value={p.niche} onChange={(e) => patch({ niche: e.target.value })} placeholder="e.g. Busy parents" />
        </Field>
        <Field label="First product idea" htmlFor="pp-idea" optional>
          <Input id="pp-idea" value={p.productIdea} onChange={(e) => patch({ productIdea: e.target.value })} placeholder="e.g. Calm Family Mornings" />
        </Field>
        <Field label="PLR products you already have" htmlFor="pp-plr">
          <Input id="pp-plr" type="number" min={0} value={p.plrProducts} onChange={(e) => patch({ plrProducts: numberValue(e.target.value) })} />
        </Field>
        <Field label="Products you already sell" htmlFor="pp-own">
          <Input id="pp-own" type="number" min={0} value={p.ownProducts} onChange={(e) => patch({ ownProducts: numberValue(e.target.value) })} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-2 rounded-xl border p-3">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">An email list</span>
            <span className="block text-xs text-muted-foreground">Subscribers you can email about a launch</span>
          </span>
          <Switch checked={p.hasEmailList} onCheckedChange={(v) => patch({ hasEmailList: v })} aria-label="I have an email list" data-testid="has-list" />
        </label>
        {p.hasEmailList && (
          <Field label="Subscribers today" htmlFor="pp-list" className="max-w-48">
            <Input id="pp-list" type="number" min={0} value={p.listSize} onChange={(e) => patch({ listSize: numberValue(e.target.value) })} />
          </Field>
        )}
        {toggles.map((t) => (
          <label key={t.key} className="flex items-center justify-between gap-3 border-t pt-2">
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.hint}</span>
            </span>
            <Switch checked={p[t.key]} onCheckedChange={(v) => patch({ [t.key]: v })} aria-label={t.label} />
          </label>
        ))}
      </div>
      <Field label="Build the plan around a studio project" htmlFor="pp-project" optional hint="Links your plan to a product you're already editing in the PLR Editor.">
        <NativeSelect id="pp-project" value={p.projectId ?? ""} onChange={(e) => patch({ projectId: e.target.value || null })}>
          <option value="">No project yet</option>
          {(projects ?? []).map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}

function ModelStep({ p, patch }: { p: ProfitPathProfile; patch: Patch }) {
  return (
    <div role="radiogroup" aria-label="Business model" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {(Object.keys(BUSINESS_MODEL_LABELS) as BusinessModel[]).map((b) => (
        <OptionCard key={b} selected={p.businessModel === b} title={BUSINESS_MODEL_LABELS[b]} hint={BUSINESS_MODEL_HINTS[b]} testId={`model-${b}`} onSelect={() => patch({ businessModel: b })} />
      ))}
    </div>
  );
}

function GoalsStep({ p, patch }: { p: ProfitPathProfile; patch: Patch }) {
  const suggested = suggestedLaunchWeek(p.experience);
  const weeks = Array.from({ length: MAX_FIRST_LAUNCH_WEEK - MIN_FIRST_LAUNCH_WEEK + 1 }, (_, i) => MIN_FIRST_LAUNCH_WEEK + i);
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 items-start sm:grid-cols-2">
        <Field label="Launches in the 90 days">
          <div className="flex gap-1.5" role="radiogroup" aria-label="Launches in the 90 days">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={p.launches === n} data-testid={`launches-${n}`} onClick={() => patch({ launches: n })} className={cn("h-9 flex-1 rounded-lg border text-sm font-medium transition", p.launches === n ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}>
                {n}
              </button>
            ))}
          </div>
        </Field>
        <Field label="First launch in week" htmlFor="pp-week" hint={`Suggested for your experience: week ${suggested}.`}>
          <NativeSelect id="pp-week" value={p.firstLaunchWeek} onChange={(e) => patch({ firstLaunchWeek: Number(e.target.value) })}>
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week {w}
                {w === suggested ? " (suggested)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Revenue goal for the 90 days" htmlFor="pp-goal">
          <div className="flex gap-2">
            <NativeSelect aria-label="Currency" value={p.currency} onChange={(e) => patch({ currency: e.target.value })} className="w-24">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
            <Input id="pp-goal" type="number" min={0} value={p.revenueGoal} onChange={(e) => patch({ revenueGoal: numberValue(e.target.value) })} />
          </div>
        </Field>
        <Field label="Main product price" htmlFor="pp-price">
          <Input id="pp-price" type="number" min={1} value={p.pricePoint} onChange={(e) => patch({ pricePoint: numberValue(e.target.value, 1) })} />
        </Field>
        <Field label="Email subscribers by day 90" htmlFor="pp-listgoal">
          <Input id="pp-listgoal" type="number" min={0} value={p.listGoal} onChange={(e) => patch({ listGoal: numberValue(e.target.value) })} />
        </Field>
        <Field label="What-if conversion rate (%)" htmlFor="pp-conv" hint="Used only for the example maths below.">
          <Input id="pp-conv" type="number" min={0.1} max={50} step={0.5} value={p.conversionPct} onChange={(e) => patch({ conversionPct: numberValue(e.target.value, 2) })} />
        </Field>
      </div>
      <GoalMathCard plan={generatePlan(p)} />
    </div>
  );
}

function GoalMathCard({ plan, className }: { plan: ProfitPlan; className?: string }) {
  const g = plan.goal;
  return (
    <div className={cn("rounded-xl border bg-secondary/40 p-4 text-sm", className)} data-testid="goal-math">
      <p className="flex items-center gap-2 font-semibold">
        <Target className="size-4 text-primary" /> The maths behind your goal
      </p>
      {g.revenueGoal > 0 ? (
        <p className="mt-1.5 text-muted-foreground">
          {formatMoney(g.revenueGoal, g.currency, 0)} at {formatMoney(g.pricePoint, g.currency, 0)} is about <strong className="text-foreground">{plural(g.salesNeeded, "sale")}</strong>
          {plan.launches.length > 1 ? ` (${formatMoney(g.perLaunch, g.currency, 0)} a launch)` : ""}. At a {g.conversionPct}% conversion rate that&apos;s roughly <strong className="text-foreground">{formatNumber(g.visitorsNeeded)} sales-page visitors</strong>.
        </p>
      ) : (
        <p className="mt-1.5 text-muted-foreground">No revenue goal set — the plan still works; it just won&apos;t show the maths.</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Example maths to plan with — not a forecast or a promise of results. Your numbers will differ.</p>
    </div>
  );
}

/** Live summary of the plan the answers produce. */
function PlanPreview({ profile }: { profile: ProfitPathProfile }) {
  const plan = React.useMemo(() => generatePlan(profile), [profile]);
  const counted = plan.tasks.filter(isCounted);
  const minutes = counted.reduce((n, t) => n + t.minutes, 0);
  return (
    <Card className="sticky top-4" data-testid="plan-preview">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> Your plan
        </CardTitle>
        <CardDescription>{plan.summary}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-secondary/60 p-2">
            <p className="text-lg font-semibold">{counted.length}</p>
            <p className="text-[11px] text-muted-foreground">tasks</p>
          </div>
          <div className="rounded-lg bg-secondary/60 p-2">
            <p className="text-lg font-semibold">{hoursText(minutes)}</p>
            <p className="text-[11px] text-muted-foreground">planned</p>
          </div>
          <div className="rounded-lg bg-secondary/60 p-2">
            <p className="text-lg font-semibold">{plan.launches.length}</p>
            <p className="text-[11px] text-muted-foreground">launch{plan.launches.length === 1 ? "" : "es"}</p>
          </div>
        </div>
        <WeekStrip plan={plan} />
        <ul className="grid grid-cols-1 gap-1 text-[13px]">
          {plan.launches.map((l) => (
            <li key={l.n} className="flex items-center gap-2">
              <Rocket className="size-3.5 text-primary" /> Launch {l.n}: week {l.week}, {dayLabel(l.date)}
            </li>
          ))}
        </ul>
        {plan.notes.length > 0 && (
          <Callout tone="warning" icon={<Lightbulb />}>
            <ul className="grid grid-cols-1 gap-1">
              {plan.notes.slice(0, 3).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Callout>
        )}
      </CardContent>
    </Card>
  );
}

const STAGE_COLOURS: Record<string, string> = {
  foundations: "bg-sky-400",
  create: "bg-violet-400",
  prepare: "bg-amber-400",
  launch: "bg-primary",
  review: "bg-teal-400",
  grow: "bg-lime-400",
  "next-product": "bg-fuchsia-400",
  final: "bg-slate-400",
};

function WeekStrip({ plan, current, onPick }: { plan: ProfitPlan; current?: number; onPick?: (n: number) => void }) {
  return (
    <div>
      <div className="flex gap-0.5" aria-hidden>
        {plan.weeks.map((w) => (
          <button key={w.n} type="button" tabIndex={-1} onClick={() => onPick?.(w.n)} title={`Week ${w.n}: ${w.title}`} className={cn("relative h-6 flex-1 rounded-sm", STAGE_COLOURS[w.launch ? "launch" : (w.stages[0] ?? "grow")], current === w.n && "ring-2 ring-foreground ring-offset-1", !onPick && "cursor-default")}>
            {w.launch && <Rocket className="absolute inset-0 m-auto size-3 text-white" />}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Week 1</span>
        <span>Week {PLAN_WEEKS}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Setup                                                                                        */
/* ------------------------------------------------------------------------------------------ */

function PathSetup() {
  const m = useMember();
  const lm = useLabMember();
  const [draft, setDraft] = React.useState<ProfitPathProfile>(() => defaultProfile(m.brandId, lm.memberId));
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [launchTouched, setLaunchTouched] = React.useState(false);
  const patch: Patch = (x) => {
    if ("firstLaunchWeek" in x && !("experience" in x)) setLaunchTouched(true);
    setDraft((d) => ({ ...d, ...x }));
  };
  const current: StepId = STEPS[step].id;
  const last = step === STEPS.length - 1;

  const build = async () => {
    setBusy(true);
    try {
      await saveProfile({ ...draft, memberId: lm.memberId, brandId: m.brandId });
      toast.success("Your 90-day plan is ready");
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader eyebrow="90-Day Profit Path" title="Build your 90-day plan" description="Five quick questions. Your answers shape every week: how much you do, when you launch and which tasks matter for your business model. Change them any time — ticked tasks are kept." />
      {!lm.isOwner && (
        <Callout tone="info" className="mb-5" title={`Setting up ${lm.name}'s plan`}>
          You&apos;re previewing a test profile, so this plan and its progress are saved for {lm.name}. Exit the preview to work on your own.
        </Callout>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader className="gap-3">
            <ol className="grid grid-cols-5 gap-1.5" aria-label="Steps">
              {STEPS.map((s, i) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined} className="group grid w-full gap-1.5 text-left">
                    <span className={cn("h-1.5 rounded-full transition", i <= step ? "bg-primary" : "bg-secondary")} />
                    <span className={cn("hidden truncate text-[11px] font-medium sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </p>
              <CardTitle className="mt-0.5 text-lg" data-testid="setup-step">
                {STEPS[step].title}
              </CardTitle>
              <CardDescription>{STEPS[step].hint}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {current === "experience" && <ExperienceStep p={draft} patch={patch} autoLaunch={!launchTouched} />}
            {current === "time" && <TimeStep p={draft} patch={patch} />}
            {current === "assets" && <AssetsStep p={draft} patch={patch} />}
            {current === "model" && <ModelStep p={draft} patch={patch} />}
            {current === "goals" && <GoalsStep p={draft} patch={patch} />}
            <div className="mt-6 flex items-center justify-between gap-2 border-t pt-4">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <ArrowLeft /> Back
              </Button>
              {last ? (
                <Button onClick={build} loading={busy} data-testid="build-plan">
                  <Route /> Build my 90-day plan
                </Button>
              ) : (
                <Button onClick={() => setStep((s) => s + 1)} data-testid="setup-next">
                  Next <ArrowRight />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="hidden lg:block">
          <PlanPreview profile={draft} />
        </div>
      </div>
    </PageContainer>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Plan view                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const STATUS_VARIANT: Record<PathStatus, "success" | "warning" | "secondary" | "default"> = { complete: "success", ahead: "success", "on-track": "default", behind: "warning", "not-started": "secondary" };
const TABS = ["today", "week", "weeks", "launches", "answers"] as const;
type Tab = (typeof TABS)[number];

function useTabParam(): [Tab, (t: Tab, extra?: Record<string, string>) => void, URLSearchParams] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "today";
  const set = React.useCallback(
    (t: Tab, extra: Record<string, string> = {}) => {
      const next = new URLSearchParams(params.toString());
      next.set("tab", t);
      for (const [k, v] of Object.entries(extra)) next.set(k, v);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );
  return [tab, set, params];
}

interface PathActions {
  toggle: (key: string, done: boolean) => void;
  skip: (task: PlanTask, skipped: boolean) => void;
  removeCustom: (task: PlanTask) => void;
}

export function usePathActions(profile: ProfitPathProfile): PathActions {
  const m = useMember();
  const lm = useLabMember();
  return {
    toggle: (key, value) => void setDone(m.brandId, lm.memberId, "path", profile.id, key, value).catch((e) => toast.error(errorMessage(e))),
    skip: (task, skipped) =>
      void setTaskSkipped(profile, task.key, skipped)
        .then(() => toast.success(skipped ? "Task skipped — the week re-plans around it" : "Task restored"))
        .catch((e) => toast.error(errorMessage(e))),
    removeCustom: (task) => void removeCustomTask(profile, task.key.slice("custom:".length)).catch((e) => toast.error(errorMessage(e))),
  };
}

function PathView({ profile }: { profile: ProfitPathProfile }) {
  const lm = useLabMember();
  const { data: progress } = useLabProgress("path", profile.id);
  const plan = React.useMemo(() => generatePlan(profile), [profile]);
  const today = todayDay();
  const stats = React.useMemo(() => pathStats(plan, progress, today), [plan, progress, today]);
  const [tab, setTab, params] = useTabParam();
  const weekParam = Number(params.get("week"));
  const defaultWeek = Math.min(PLAN_WEEKS, Math.max(1, stats.currentWeek));
  const week = Number.isInteger(weekParam) && weekParam >= 1 && weekParam <= PLAN_WEEKS ? weekParam : defaultWeek;
  const [adding, setAdding] = React.useState(false);
  const done = progress?.done ?? {};
  const fileBase = slugify(`${lm.isOwner ? "my" : lm.name} 90-day profit path`);

  const actions = usePathActions(profile);

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="90-Day Profit Path"
        title={lm.isOwner ? "Your 90-day plan" : `${lm.name}'s 90-day plan`}
        description={plan.summary}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setAdding(true)} data-testid="add-task">
              <Plus /> Add a task
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="path-export">
                  <Download /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem data-testid="export-path-md" onSelect={() => downloadText(pathMarkdown(plan, progress ?? null), `${fileBase}.md`, "text/markdown")}>
                  <ListChecks /> Plan with ticks (.md)
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="export-path-csv" onSelect={() => downloadText(pathCsv(plan, progress ?? null), `${fileBase}.csv`, "text/csv")}>
                  <Download /> Tasks spreadsheet (.csv)
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="export-path-ics" onSelect={() => downloadText(pathIcs(plan), `${fileBase}.ics`, "text/calendar")}>
                  <CalendarPlus /> Add to your calendar (.ics)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setTimeout(() => window.print(), 50)}>
                  <Printer /> Print this view
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <StatsBar plan={plan} stats={stats} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-6">
        <TabsList className="no-print flex w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="today" data-testid="tab-today">
            Today
          </TabsTrigger>
          <TabsTrigger value="week" data-testid="tab-week">
            This week
          </TabsTrigger>
          <TabsTrigger value="weeks" data-testid="tab-weeks">
            13 weeks
          </TabsTrigger>
          <TabsTrigger value="launches" data-testid="tab-launches">
            Launch checklists
          </TabsTrigger>
          <TabsTrigger value="answers" data-testid="tab-answers">
            Your answers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-5">
          <TodayView plan={plan} stats={stats} done={done} actions={actions} today={today} onWeek={(n) => setTab("week", { week: String(n) })} />
        </TabsContent>
        <TabsContent value="week" className="mt-5">
          <WeekView plan={plan} stats={stats} n={week} done={done} notes={progress?.notes ?? {}} actions={actions} today={today} onWeek={(n) => setTab("week", { week: String(n) })} />
        </TabsContent>
        <TabsContent value="weeks" className="mt-5">
          <WeeksView plan={plan} stats={stats} onWeek={(n) => setTab("week", { week: String(n) })} />
        </TabsContent>
        <TabsContent value="launches" className="mt-5">
          <LaunchesView plan={plan} done={done} actions={actions} />
        </TabsContent>
        <TabsContent value="answers" className="mt-5">
          <AnswersView profile={profile} />
        </TabsContent>
      </Tabs>
      <CustomTaskDialog open={adding} onOpenChange={setAdding} profile={profile} plan={plan} today={today} />
    </PageContainer>
  );
}

function StatsBar({ plan, stats }: { plan: ProfitPlan; stats: PathStats }) {
  const dayText = stats.dayOfPlan < 1 ? `Starts ${dayLabel(plan.startDate)}` : stats.dayOfPlan > 90 ? "Plan finished" : `Day ${stats.dayOfPlan} of 90 · week ${stats.currentWeek}`;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]" data-testid="path-stats">
      <Card className="col-span-2 flex items-center gap-4 p-4 md:col-span-1">
        <ProgressRing value={stats.percent} />
        <div className="min-w-0">
          <Badge variant={STATUS_VARIANT[stats.status]} data-testid="path-status">
            {PATH_STATUS_LABELS[stats.status]}
          </Badge>
          <p className="mt-1.5 text-sm font-semibold" data-testid="path-progress">
            {stats.done} of {stats.total} tasks
          </p>
          <p className="text-xs text-muted-foreground">{dayText}</p>
        </div>
      </Card>
      <Card className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Flame className="size-3.5 text-orange-500" /> Streak
        </p>
        <p className="mt-1 text-xl font-semibold">{plural(stats.streak, "day")}</p>
        <p className="text-xs text-muted-foreground">in a row with a task done</p>
      </Card>
      <Card className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Flag className="size-3.5 text-primary" /> Milestones
        </p>
        <p className="mt-1 text-xl font-semibold">
          {stats.milestonesReached} / {PLAN_WEEKS}
        </p>
        <p className="text-xs text-muted-foreground">{hoursText(stats.minutesDone)} of work done</p>
      </Card>
      <GoalMathCard plan={plan} className="col-span-2 bg-card md:col-span-1" />
    </div>
  );
}

const PRIORITY_BADGE: Record<PlanTask["priority"], "default" | "secondary" | "outline" | "estimate"> = { core: "default", recommended: "secondary", stretch: "outline", custom: "estimate" };

function TaskRow({ task, done, actions, showDate, overdue }: { task: PlanTask; done: boolean; actions: PathActions; showDate?: boolean; overdue?: boolean }) {
  const id = `task-${task.key.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <li className={cn("group flex items-start gap-3 px-3 py-3 sm:px-4", task.skipped && "opacity-60")} data-testid="path-task" data-key={task.key} data-done={done}>
      <Checkbox id={id} checked={done} onCheckedChange={(v) => actions.toggle(task.key, !!v)} className="mt-0.5" aria-label={`Mark “${task.title}” done`} disabled={task.skipped} />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className={cn("block cursor-pointer text-sm font-medium leading-snug", done && "text-muted-foreground line-through")}>
          {task.title}
        </label>
        {task.detail && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{task.detail}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
          {showDate && task.date && <span className={cn("font-medium", overdue && "text-warning")}>{dayLabel(task.date)}</span>}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {hoursText(task.minutes)}
          </span>
          <Badge variant={PRIORITY_BADGE[task.priority]}>{task.priority === "custom" ? "Your task" : PATH_PRIORITY_LABELS[task.priority]}</Badge>
          {task.stage !== "custom" && <span>{PATH_CATEGORY_LABELS[task.category]}</span>}
          {task.launch && <span className="inline-flex items-center gap-1"><Rocket className="size-3" /> Launch {task.launch}</span>}
        </div>
      </div>
      <div className="no-print flex shrink-0 items-center gap-1">
        {task.tool && !done && <span className="hidden sm:block"><ToolButton tool={task.tool} variant="ghost" /></span>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`More for “${task.title}”`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {task.priority === "custom" ? (
              <DropdownMenuItem destructive onSelect={() => actions.removeCustom(task)}>
                <Trash2 /> Remove task
              </DropdownMenuItem>
            ) : task.skipped ? (
              <DropdownMenuItem onSelect={() => actions.skip(task, false)}>
                <Undo2 /> Restore task
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => actions.skip(task, true)} data-testid="skip-task">
                <Undo2 className="-scale-x-100" /> Skip — not relevant to me
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function TaskList({ tasks, done, actions, showDate, today, testId }: { tasks: PlanTask[]; done: Record<string, string>; actions: PathActions; showDate?: boolean; today?: string; testId?: string }) {
  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y" data-testid={testId}>
        {tasks.map((t) => (
          <TaskRow key={t.key} task={t} done={!!done[t.key]} actions={actions} showDate={showDate} overdue={!!today && !!t.date && t.date < today && !done[t.key]} />
        ))}
      </ul>
    </Card>
  );
}

function TodayView({ plan, stats, done, actions, today, onWeek }: { plan: ProfitPlan; stats: PathStats; done: Record<string, string>; actions: PathActions; today: string; onWeek: (n: number) => void }) {
  const m = useMember();
  if (stats.dayOfPlan < 1) {
    const first = plan.weeks[0];
    return (
      <div className="grid grid-cols-1 gap-4">
        <Callout tone="info" icon={<CalendarDays />} title={`Your plan starts ${dayLabel(plan.startDate, { weekday: "long", day: "numeric", month: "long" })}`}>
          Here&apos;s week 1 so you can get ready. Ticking a task early counts — you&apos;ll start ahead.
        </Callout>
        <SectionTitle>Week 1 · {first.title}</SectionTitle>
        <TaskList tasks={first.tasks.filter(isCounted)} done={done} actions={actions} showDate testId="today-tasks" />
      </div>
    );
  }
  if (stats.dayOfPlan > 90) {
    return (
      <EmptyState
        icon={<CircleCheck />}
        title={`Your 90 days finished on ${dayLabel(plan.endDate)}`}
        description={`You completed ${stats.done} of ${stats.total} tasks (${stats.percent}%). Review your 13 weeks, then start a new plan from “Your answers” with a new start date.`}
        action={<Button variant="outline" onClick={() => onWeek(PLAN_WEEKS)}>Open week 13</Button>}
      />
    );
  }
  const todayTasks = stats.today;
  const thisWeek = plan.weeks[stats.currentWeek - 1];
  const launchToday = plan.launches.find((l) => l.date === today);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 grid-cols-1 content-start gap-6">
        {launchToday && (
          <Callout tone="success" icon={<Rocket />} title={`Launch day: ${launchToday.title}`}>
            Work through the launch-day list in Launch checklists. Reply to every buyer question today.
          </Callout>
        )}
        <section>
          <SectionTitle>
            {dayLabel(today, { weekday: "long", day: "numeric", month: "long" })} · {plural(todayTasks.length, "task")}
          </SectionTitle>
          {todayTasks.length ? (
            <TaskList tasks={todayTasks} done={done} actions={actions} testId="today-tasks" />
          ) : (
            <Card className="p-5 text-sm text-muted-foreground" data-testid="today-tasks">
              Nothing planned today{stats.next ? ` — next up on ${dayLabel(stats.next.date ?? today)}: “${stats.next.title}”.` : "."} Use the time to catch up, or rest.
            </Card>
          )}
        </section>
        {stats.overdue.length > 0 && (
          <section>
            <SectionTitle>Catch up · {plural(stats.overdue.length, "earlier task")}</SectionTitle>
            <TaskList tasks={stats.overdue.slice(0, 8)} done={done} actions={actions} showDate today={today} testId="overdue-tasks" />
            {stats.overdue.length > 8 && <p className="mt-2 text-xs text-muted-foreground">And {stats.overdue.length - 8} more in earlier weeks.</p>}
          </section>
        )}
      </div>
      <div className="grid grid-cols-1 content-start gap-4">
        {thisWeek && (
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Week {thisWeek.n}</p>
            <p className="mt-1 font-semibold">{thisWeek.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{thisWeek.focus}</p>
            <p className="mt-3 flex items-center gap-1.5 text-sm">
              <Flag className="size-3.5 text-primary" /> {thisWeek.milestone}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Progress value={stats.weeks[thisWeek.n - 1]?.percent ?? 0} className="flex-1" />
              <CountChip done={stats.weeks[thisWeek.n - 1]?.done ?? 0} total={stats.weeks[thisWeek.n - 1]?.total ?? 0} />
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => onWeek(thisWeek.n)}>
              Open this week
            </Button>
          </Card>
        )}
        <Card className="p-4 text-sm">
          <p className="font-semibold">Done-for-you help</p>
          <p className="mt-1 text-muted-foreground">This month&apos;s Campaign Drop has the sales copy, emails and posts; Build Day is where you get it finished.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="xs" variant="soft">
              <Link href={m.href("campaigns")}>Campaign Drops</Link>
            </Button>
            <Button asChild size="xs" variant="soft">
              <Link href={m.href("build-days")}>Build Days</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function WeekView({ plan, stats, n, done, notes, actions, today, onWeek }: { plan: ProfitPlan; stats: PathStats; n: number; done: Record<string, string>; notes: Record<string, string>; actions: PathActions; today: string; onWeek: (n: number) => void }) {
  const m = useMember();
  const lm = useLabMember();
  const w = plan.weeks[n - 1];
  const ws = stats.weeks[n - 1];
  const scheduled = w.tasks.filter((t) => t.scheduled && !t.skipped);
  const extras = w.tasks.filter((t) => !t.scheduled && !t.skipped);
  const skipped = w.tasks.filter((t) => t.skipped);
  const days = [...new Set(scheduled.map((t) => t.date!).filter(Boolean))].sort();
  const noteKey = `week:${n}`;
  const storedNote = notes[noteKey] ?? "";
  const [note, setNoteText] = React.useState(storedNote);
  React.useEffect(() => setNoteText(storedNote), [noteKey, storedNote]);
  const saveNote = () => {
    if ((notes[noteKey] ?? "") === note) return;
    setNote(m.brandId, lm.memberId, "path", plan.profile.id, noteKey, note)
      .then(() => toast.success("Reflection saved"))
      .catch((e) => toast.error(errorMessage(e)));
  };
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 grid-cols-1 content-start gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => onWeek(n - 1)} disabled={n <= 1} aria-label="Previous week">
            <ChevronLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight" data-testid="week-title">
              Week {n} · {w.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {dayLabel(w.start)} – {dayLabel(w.end)}
              {n === stats.currentWeek && " · this week"}
            </p>
          </div>
          <Button variant="outline" size="icon-sm" onClick={() => onWeek(n + 1)} disabled={n >= PLAN_WEEKS} aria-label="Next week">
            <ChevronRight />
          </Button>
        </div>
        {w.overByMinutes > 0 && (
          <Callout tone="warning" icon={<Clock />}>
            This week&apos;s core work needs about {hoursText(w.overByMinutes)} more than your {plan.profile.hoursPerWeek} hours. Skip what doesn&apos;t apply to you, or borrow time from a lighter week.
          </Callout>
        )}
        {days.map((d) => (
          <section key={d}>
            <SectionTitle>
              {dayLabel(d, { weekday: "long", day: "numeric", month: "short" })}
              {d === today && <Badge className="ml-2 normal-case tracking-normal">Today</Badge>}
            </SectionTitle>
            <TaskList tasks={scheduled.filter((t) => t.date === d)} done={done} actions={actions} today={today} testId="week-tasks" />
          </section>
        ))}
        {extras.length > 0 && (
          <section>
            <SectionTitle>If you have extra time</SectionTitle>
            <TaskList tasks={extras} done={done} actions={actions} testId="extra-tasks" />
          </section>
        )}
        {skipped.length > 0 && (
          <section>
            <SectionTitle>Skipped</SectionTitle>
            <TaskList tasks={skipped} done={done} actions={actions} testId="skipped-tasks" />
          </section>
        )}
      </div>
      <div className="grid grid-cols-1 content-start gap-4">
        <Card className="p-4">
          <p className="text-sm font-semibold">Focus</p>
          <p className="mt-1 text-sm text-muted-foreground">{w.focus}</p>
          <p className="mt-3 text-sm font-semibold">Milestone</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            {ws?.coreDone ? <CircleCheck className="size-4 text-success" /> : <Flag className="size-4 text-primary" />} {w.milestone}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Progress value={ws?.percent ?? 0} className="flex-1" />
            <CountChip done={ws?.done ?? 0} total={ws?.total ?? 0} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {hoursText(w.scheduledMinutes)} planned of your {plan.profile.hoursPerWeek} h
          </p>
        </Card>
        <Card className="p-4">
          <Field label="Weekly reflection" htmlFor="week-note" hint="What worked, what got in the way, what to change next week. Saved when you click away.">
            <Textarea id="week-note" rows={5} value={note} onChange={(e) => setNoteText(e.target.value)} onBlur={saveNote} data-testid="week-reflection" />
          </Field>
        </Card>
      </div>
    </div>
  );
}

function WeeksView({ plan, stats, onWeek }: { plan: ProfitPlan; stats: PathStats; onWeek: (n: number) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <WeekStrip plan={plan} current={stats.currentWeek} onPick={onWeek} />
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(["foundations", "create", "prepare", "launch", "review", "grow", "next-product", "final"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", STAGE_COLOURS[s])} /> {STAGES[s].title}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="weeks-grid">
        {plan.weeks.map((w) => {
          const ws = stats.weeks[w.n - 1];
          const current = w.n === stats.currentWeek;
          return (
            <button key={w.n} type="button" onClick={() => onWeek(w.n)} className={cn("flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm", current && "border-primary ring-1 ring-primary")} data-testid="week-card">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">Week {w.n}</span>
                {current && <Badge>Now</Badge>}
                {w.launch && (
                  <Badge variant="warning">
                    <Rocket /> Launch {w.launch}
                  </Badge>
                )}
                {ws.coreDone && <CircleCheck className="ml-auto size-4 text-success" aria-label="Milestone reached" />}
              </div>
              <p className="font-semibold leading-snug">{w.title}</p>
              <p className="text-xs text-muted-foreground">
                {dayLabel(w.start, { day: "numeric", month: "short" })} – {dayLabel(w.end, { day: "numeric", month: "short" })} · {hoursText(w.scheduledMinutes)}
              </p>
              <p className="flex items-center gap-1.5 text-[13px]">
                <Flag className="size-3.5 shrink-0 text-muted-foreground" /> {w.milestone}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-1">
                <Progress value={ws.percent} className="flex-1" />
                <CountChip done={ws.done} total={ws.total} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LaunchesView({ plan, done, actions }: { plan: ProfitPlan; done: Record<string, string>; actions: PathActions }) {
  const m = useMember();
  return (
    <div className="grid grid-cols-1 gap-6">
      {plan.launches.map((l) => {
        const items = l.groups.flatMap((g) => g.items);
        const n = items.filter((i) => done[i.key]).length;
        return (
          <Card key={l.n} data-testid="launch-checklist">
            <CardHeader className="flex flex-row flex-wrap items-center gap-4">
              <ProgressRing value={items.length ? (n / items.length) * 100 : 0} size={52} stroke={5} />
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="size-4 text-primary" /> {l.title}
                </CardTitle>
                <CardDescription>
                  Week {l.week} · {dayLabel(l.date, { weekday: "long", day: "numeric", month: "long" })} · {n} of {items.length} done
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={m.href("campaigns")}>Use a Campaign Drop</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {l.groups.map((g) => (
                <div key={g.id}>
                  <p className="mb-2 text-[13px] font-semibold">{g.title}</p>
                  <ul className="grid grid-cols-1 gap-2">
                    {g.items.map((i) => {
                      const id = `lc-${i.key.replace(/[^a-z0-9]/gi, "-")}`;
                      return (
                        <li key={i.key} className="flex items-start gap-2.5">
                          <Checkbox id={id} checked={!!done[i.key]} onCheckedChange={(v) => actions.toggle(i.key, !!v)} className="mt-0.5" />
                          <label htmlFor={id} className={cn("cursor-pointer text-sm leading-snug", done[i.key] && "text-muted-foreground line-through")}>
                            {i.text}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AnswersView({ profile }: { profile: ProfitPathProfile }) {
  const lm = useLabMember();
  const confirm = useConfirm();
  const [draft, setDraft] = React.useState(profile);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setDraft(profile), [profile]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const patch: Patch = (x) => setDraft((d) => ({ ...d, ...x }));
  const save = async () => {
    setBusy(true);
    try {
      await saveProfile(draft);
      toast.success("Plan updated", { description: "Ticked tasks are kept." });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const sections: { id: StepId; node: React.ReactNode }[] = [
    { id: "experience", node: <ExperienceStep p={draft} patch={patch} autoLaunch={false} /> },
    { id: "time", node: <TimeStep p={draft} patch={patch} /> },
    { id: "assets", node: <AssetsStep p={draft} patch={patch} /> },
    { id: "model", node: <ModelStep p={draft} patch={patch} /> },
    { id: "goals", node: <GoalsStep p={draft} patch={patch} /> },
  ];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 grid-cols-1 content-start gap-4">
        <Callout tone="neutral" icon={<Lightbulb />}>
          Change any answer and save — the plan re-builds instantly. Tasks you&apos;ve ticked stay ticked; tasks that no longer apply drop out of the plan.
        </Callout>
        {sections.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle>{STEPS.find((x) => x.id === s.id)!.title}</CardTitle>
            </CardHeader>
            <CardContent>{s.node}</CardContent>
          </Card>
        ))}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-destructive">Start over</CardTitle>
            <CardDescription>Clear ticks to restart the same plan, or delete it and answer the questions again.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!(await confirm({ title: "Clear every tick and reflection?", description: "The plan stays the same; progress goes back to zero.", confirmLabel: "Clear progress", destructive: true }))) return;
                await resetProgress(lm.memberId, "path", profile.id);
                toast.success("Progress cleared");
              }}
            >
              <RotateCcw /> Clear progress
            </Button>
            <Button
              variant="destructive"
              data-testid="delete-plan"
              onClick={async () => {
                if (!(await confirm({ title: "Delete this plan?", description: "Your answers, ticks and reflections are deleted.", confirmLabel: "Delete plan", destructive: true }))) return;
                await deleteProfile(lm.memberId);
                toast.success("Plan deleted");
              }}
            >
              <Trash2 /> Delete plan
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 content-start gap-3">
        <div className="sticky top-4 z-10 grid gap-3">
          <Card className="flex items-center justify-between gap-3 p-3">
            <span className="text-sm text-muted-foreground">{dirty ? "Unsaved changes" : "Saved"}</span>
            <div className="flex gap-2">
              {dirty && (
                <Button variant="ghost" size="sm" onClick={() => setDraft(profile)}>
                  Undo
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={!dirty} loading={busy} data-testid="save-answers">
                Save and re-plan
              </Button>
            </div>
          </Card>
          <PlanPreview profile={draft} />
        </div>
      </div>
    </div>
  );
}

function CustomTaskDialog({ open, onOpenChange, profile, plan, today }: { open: boolean; onOpenChange: (o: boolean) => void; profile: ProfitPathProfile; plan: ProfitPlan; today: string }) {
  const [title, setTitle] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [date, setDate] = React.useState(inPlan(plan, today) ? today : plan.startDate);
  const [minutes, setMinutes] = React.useState(30);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDetail("");
      setDate(inPlan(plan, today) ? today : plan.startDate);
      setMinutes(30);
    }
  }, [open, plan, today]);
  const valid = title.trim() && inPlan(plan, date);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add your own task</DialogTitle>
          <DialogDescription>For anything the plan doesn&apos;t cover — a client call, a guest post, a course you&apos;re taking.</DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-1 gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setBusy(true);
            try {
              await addCustomTask(profile, { title, detail, date, minutes });
              toast.success("Task added to your plan");
              onOpenChange(false);
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Task" htmlFor="ct-title">
            <Input id="ct-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus data-testid="custom-title" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="ct-date" error={date && !inPlan(plan, date) ? "Choose a day inside your 90 days." : undefined}>
              <Input id="ct-date" type="date" min={plan.startDate} max={plan.endDate} value={date} onChange={(e) => setDate(e.target.value)} data-testid="custom-date" />
            </Field>
            <Field label="Minutes" htmlFor="ct-min">
              <Input id="ct-min" type="number" min={5} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Notes" htmlFor="ct-detail" optional>
            <Textarea id="ct-detail" rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid} loading={busy} data-testid="save-custom-task">
              Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Compact summary used on the Profit Lab dashboard. */
export function usePathSummary() {
  const lm = useLabMember();
  const { data: profile, loading } = useMemberLive((r) => r.labProfiles.get(profileId(lm.memberId)), [lm.memberId]);
  const { data: progress } = useLabProgress("path", profile?.id);
  const plan = React.useMemo(() => (profile ? generatePlan(profile) : null), [profile]);
  const stats = React.useMemo(() => (plan ? pathStats(plan, progress) : null), [plan, progress]);
  return { loading, profile: profile ?? null, plan, stats, progress: progress ?? null };
}

export { TaskList, type PathActions };
