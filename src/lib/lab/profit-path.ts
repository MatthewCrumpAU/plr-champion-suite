import Papa from "papaparse";
import type { BrandId } from "@/lib/membership/types";
import { nowIso } from "@/lib/utils";
import { addDays, daysBetween, formatDay, isDay, parseDay, todayDay, weekday } from "./dates";
import { buildIcs } from "./ics";
import { LAUNCH_CHECKLIST, PATH_CATEGORY_LABELS, STAGES, type PathCategory, type PathPriority, type StageId, type TaskTemplate, type ToolRef } from "./path-templates";
import { BUSINESS_MODEL_LABELS, EXPERIENCE_SHORT, type LabProgress, type ProfitPathProfile } from "./types";

/**
 * 90-Day Profit Path generator.
 *
 * Turns a member's answers into a 13-week plan: stages are laid out around the launch weeks, each
 * stage's tasks are spread over its weeks, every week is fitted to the hours available (core tasks
 * always; recommended and stretch tasks only while they fit — the rest are offered as optional
 * extras) and tasks are placed on the member's working days. Deterministic and pure: the same
 * answers always give the same plan, and task keys stay stable so progress survives re-planning.
 */

export const PLAN_DAYS = 90;
export const PLAN_WEEKS = 13;
export const MIN_FIRST_LAUNCH_WEEK = 3;
export const MAX_FIRST_LAUNCH_WEEK = 11;

/* ------------------------------------------------------------------------------------------ */
/* Profile                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export const profileId = (memberId: string) => `path:${memberId}`;

export function defaultProfile(brandId: BrandId, memberId: string, now: Date = new Date(), patch: Partial<ProfitPathProfile> = {}): ProfitPathProfile {
  const stamp = nowIso();
  return normalizeProfile({
    id: profileId(memberId),
    brandId,
    memberId,
    experience: "new",
    hoursPerWeek: 8,
    workDays: [1, 2, 3, 4, 5],
    startDate: nextMonday(todayDay(now)),
    niche: "",
    productIdea: "",
    plrProducts: 0,
    ownProducts: 0,
    hasEmailList: false,
    listSize: 0,
    hasWebsite: false,
    hasCheckout: false,
    hasSocialAudience: false,
    businessModel: "sell-products",
    launches: 1,
    firstLaunchWeek: 7,
    revenueGoal: 1000,
    pricePoint: 27,
    conversionPct: 2,
    listGoal: 250,
    currency: "USD",
    projectId: null,
    customTasks: [],
    skippedTaskKeys: [],
    isSample: false,
    createdAt: stamp,
    updatedAt: stamp,
    ...patch,
  });
}

/** Suggested first launch week for an experience level (members can change it). */
export function suggestedLaunchWeek(experience: ProfitPathProfile["experience"]): number {
  return experience === "new" ? 7 : experience === "some" ? 6 : 4;
}

export function nextMonday(day: string): string {
  const wd = weekday(day);
  return wd === 1 ? day : addDays(day, (8 - wd) % 7);
}

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Clamp every answer into a range the generator can plan with. */
export function normalizeProfile(p: ProfitPathProfile): ProfitPathProfile {
  const workDays = [...new Set((Array.isArray(p.workDays) ? p.workDays : []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  return {
    ...p,
    hoursPerWeek: Math.round(num(p.hoursPerWeek, 8, 1, 80)),
    workDays: workDays.length ? workDays : [1, 2, 3, 4, 5],
    startDate: isDay(p.startDate) ? p.startDate : nextMonday(todayDay()),
    plrProducts: Math.round(num(p.plrProducts, 0, 0, 10_000)),
    ownProducts: Math.round(num(p.ownProducts, 0, 0, 10_000)),
    listSize: Math.round(num(p.listSize, 0, 0, 100_000_000)),
    launches: Math.round(num(p.launches, 1, 1, 3)),
    firstLaunchWeek: Math.round(num(p.firstLaunchWeek, suggestedLaunchWeek(p.experience), MIN_FIRST_LAUNCH_WEEK, MAX_FIRST_LAUNCH_WEEK)),
    revenueGoal: Math.round(num(p.revenueGoal, 1000, 0, 100_000_000)),
    pricePoint: num(p.pricePoint, 27, 1, 1_000_000),
    conversionPct: num(p.conversionPct, 2, 0.1, 100),
    listGoal: Math.round(num(p.listGoal, 0, 0, 100_000_000)),
    currency: (p.currency || "USD").toUpperCase().slice(0, 3),
    niche: (p.niche ?? "").slice(0, 120),
    productIdea: (p.productIdea ?? "").slice(0, 160),
    customTasks: Array.isArray(p.customTasks) ? p.customTasks.filter((t) => isDay(t.date) && t.title.trim()) : [],
    skippedTaskKeys: Array.isArray(p.skippedTaskKeys) ? p.skippedTaskKeys : [],
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Plan                                                                                         */
/* ------------------------------------------------------------------------------------------ */

export interface PlanTask {
  key: string;
  title: string;
  detail: string;
  minutes: number;
  priority: PathPriority | "custom";
  category: PathCategory;
  stage: StageId | "custom";
  tool: ToolRef | null;
  week: number;
  /** Planned day, or null for optional extras that didn't fit the week. */
  date: string | null;
  scheduled: boolean;
  skipped: boolean;
  /** Launch number for launch/review/next-product tasks. */
  launch: number | null;
}

export interface PlanWeek {
  n: number;
  start: string;
  end: string;
  stages: StageId[];
  title: string;
  focus: string;
  milestone: string;
  /** Launch number if a launch happens this week. */
  launch: number | null;
  tasks: PlanTask[];
  scheduledMinutes: number;
  capacityMinutes: number;
  /** Core work beyond the hours available (0 when it fits). */
  overByMinutes: number;
}

export interface ChecklistItem {
  key: string;
  text: string;
}

export interface PlanLaunch {
  n: number;
  week: number;
  date: string;
  title: string;
  groups: { id: string; title: string; items: ChecklistItem[] }[];
}

export interface GoalMath {
  revenueGoal: number;
  perLaunch: number;
  salesNeeded: number;
  visitorsNeeded: number;
  conversionPct: number;
  pricePoint: number;
  listGoal: number;
  currency: string;
}

export interface ProfitPlan {
  profile: ProfitPathProfile;
  startDate: string;
  endDate: string;
  weeks: PlanWeek[];
  launches: PlanLaunch[];
  tasks: PlanTask[];
  goal: GoalMath;
  /** Plain-language notes about adjustments the generator made. */
  notes: string[];
  summary: string;
}

interface Segment {
  stage: StageId;
  weeks: number[];
  launch: number | null;
}

/** Where each stage sits in the 13 weeks. */
export function planSegments(p: ProfitPathProfile): { segments: Segment[]; launchWeeks: number[]; notes: string[] } {
  const notes: string[] = [];
  const L1 = Math.min(MAX_FIRST_LAUNCH_WEEK, Math.max(MIN_FIRST_LAUNCH_WEEK, p.firstLaunchWeek));
  const segments: Segment[] = [];
  const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

  // Weeks before the first launch: foundations → create → prepare.
  const pre = L1 - 1;
  if (pre >= 3) {
    const F = Math.max(1, Math.round(pre * 0.25));
    const P = Math.max(1, Math.round(pre * 0.35));
    const C = Math.max(1, pre - F - P);
    segments.push({ stage: "foundations", weeks: range(1, F), launch: null });
    segments.push({ stage: "create", weeks: range(F + 1, F + C), launch: null });
    segments.push({ stage: "prepare", weeks: range(F + C + 1, pre), launch: null });
  } else {
    segments.push({ stage: "foundations", weeks: [1], launch: null });
    segments.push({ stage: "create", weeks: [2], launch: null });
    segments.push({ stage: "prepare", weeks: [2], launch: null });
    notes.push("Launching in week 3 leaves two weeks to prepare, so creating and preparing share week 2.");
  }

  // Later launches need at least three weeks each (review, next product, launch) and must finish by week 12.
  const available = 12 - L1;
  const wantedExtra = p.launches - 1;
  const extra = Math.min(wantedExtra, Math.floor(available / 3));
  if (extra < wantedExtra) notes.push(`Only ${extra + 1} launch${extra ? "es fit" : " fits"} after a week-${L1} first launch — move it earlier to fit ${p.launches}.`);
  const gap = extra > 0 ? Math.max(3, Math.floor((available + 1) / (extra + 1))) : 0;
  const launchWeeks = [L1, ...Array.from({ length: extra }, (_, k) => L1 + gap * (k + 1))].filter((w) => w <= 12);

  launchWeeks.forEach((lw, i) => {
    const n = i + 1;
    segments.push({ stage: "launch", weeks: [lw], launch: n });
    const next = launchWeeks[i + 1];
    const reviewWeek = lw + 1;
    if (next) {
      segments.push({ stage: "review", weeks: [reviewWeek], launch: n });
      const growWeeks = range(reviewWeek + 1, next - 2);
      for (const w of growWeeks) segments.push({ stage: "grow", weeks: [w], launch: null });
      segments.push({ stage: "next-product", weeks: [next - 1 > reviewWeek ? next - 1 : reviewWeek], launch: n + 1 });
    } else {
      segments.push({ stage: "review", weeks: [Math.min(reviewWeek, PLAN_WEEKS)], launch: n });
      for (const w of range(reviewWeek + 1, 12)) segments.push({ stage: "grow", weeks: [w], launch: null });
    }
  });
  segments.push({ stage: "final", weeks: [PLAN_WEEKS], launch: null });
  return { segments, launchWeeks, notes };
}

const text = (t: TaskTemplate["title"], p: ProfitPathProfile) => (typeof t === "function" ? t(p) : t);
const prio = (t: TaskTemplate, p: ProfitPathProfile): PathPriority => (typeof t.priority === "function" ? t.priority(p) : t.priority);
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Beginners get more time per task; experienced members less. */
export function experienceFactor(e: ProfitPathProfile["experience"]): number {
  return e === "new" ? 1.25 : e === "experienced" ? 0.8 : 1;
}

/** Working days that fall inside a plan week (days after day 90 excluded). Falls back to any day in the week. */
export function workDaysOfWeek(p: ProfitPathProfile, week: number): string[] {
  const start = addDays(p.startDate, (week - 1) * 7);
  const all = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => daysBetween(p.startDate, d) < PLAN_DAYS);
  const work = all.filter((d) => p.workDays.includes(weekday(d)));
  return work.length ? work : all.slice(-1);
}

export function generatePlan(input: ProfitPathProfile): ProfitPlan {
  const p = normalizeProfile(input);
  const { segments, launchWeeks, notes } = planSegments(p);
  const factor = experienceFactor(p.experience);
  const capacity = p.hoursPerWeek * 60;
  const skipped = new Set(p.skippedTaskKeys);

  // 1. Instantiate each segment's tasks and spread them over its weeks.
  const byWeek = new Map<number, PlanTask[]>();
  const anchors = new Map<string, number>();
  const push = (w: number, t: PlanTask) => byWeek.set(w, [...(byWeek.get(w) ?? []), t]);
  for (const seg of segments) {
    const stage = STAGES[seg.stage];
    const suffix = seg.stage === "grow" || seg.stage === "final" ? `@w${seg.weeks[0]}` : seg.launch ? `@L${seg.launch}` : "";
    const tasks: PlanTask[] = stage.tasks
      .filter((t) => !t.when || t.when(p))
      .map((t) => ({
        key: `${seg.stage}:${t.key}${suffix}`,
        title: text(t.title, p),
        detail: text(t.detail, p),
        minutes: round5(t.minutes * factor),
        priority: prio(t, p),
        category: t.category,
        stage: seg.stage,
        tool: t.tool ?? null,
        week: seg.weeks[0],
        date: null,
        scheduled: false,
        skipped: false,
        launch: seg.launch,
      }));
    stage.tasks.filter((t) => t.anchor !== undefined).forEach((t) => anchors.set(`${seg.stage}:${t.key}${suffix}`, t.anchor!));
    const total = tasks.reduce((n, t) => n + t.minutes, 0);
    const target = total / seg.weeks.length;
    let wi = 0;
    let used = 0;
    for (const t of tasks) {
      if (used >= target && wi < seg.weeks.length - 1) {
        wi++;
        used = 0;
      }
      t.week = seg.weeks[wi];
      used += t.minutes;
      push(t.week, t);
    }
  }

  // 2. Fit each week to the time available, then place tasks on working days.
  const weeks: PlanWeek[] = [];
  for (let n = 1; n <= PLAN_WEEKS; n++) {
    const tasks = byWeek.get(n) ?? [];
    for (const t of tasks) t.skipped = skipped.has(t.key);
    const active = tasks.filter((t) => !t.skipped);
    const coreMinutes = active.filter((t) => t.priority === "core").reduce((s, t) => s + t.minutes, 0);
    let planned = coreMinutes;
    for (const t of active) if (t.priority === "core") t.scheduled = true;
    for (const level of ["recommended", "stretch"] as const) {
      for (const t of active) {
        if (t.priority !== level) continue;
        if (planned + t.minutes <= capacity) {
          t.scheduled = true;
          planned += t.minutes;
        }
      }
    }
    const days = workDaysOfWeek(p, n);
    const launchN = launchWeeks.indexOf(n) + 1 || null;
    const launchIdx = Math.floor((days.length - 1) / 2);
    const dailyCap = capacity / days.length;
    let di = 0;
    let used = 0;
    for (const t of active.filter((x) => x.scheduled)) {
      const anchor = anchors.get(t.key);
      if (launchN && anchor !== undefined) {
        t.date = days[Math.min(days.length - 1, Math.max(0, launchIdx + anchor))];
        continue;
      }
      if (used > 0 && used + t.minutes > dailyCap && di < days.length - 1) {
        di++;
        used = 0;
      }
      t.date = days[di];
      used += t.minutes;
    }
    const stageIds = [...new Set(segments.filter((s) => s.weeks.includes(n)).map((s) => s.stage))];
    const main = STAGES[stageIds.find((s) => s === "launch") ?? stageIds[0] ?? "grow"];
    const start = addDays(p.startDate, (n - 1) * 7);
    const end = addDays(p.startDate, Math.min(n * 7, PLAN_DAYS) - 1);
    weeks.push({
      n,
      start,
      end,
      stages: stageIds,
      title: launchN ? `Launch ${launchN}` : stageIds.map((s) => STAGES[s].title).join(" + "),
      focus: main.focus,
      milestone: launchN ? `Launch ${launchN} is live` : main.milestone,
      launch: launchN,
      tasks,
      scheduledMinutes: planned,
      capacityMinutes: capacity,
      overByMinutes: Math.max(0, coreMinutes - capacity),
    });
    if (coreMinutes > capacity) notes.push(`Week ${n} needs about ${hoursText(coreMinutes - capacity)} more than your ${p.hoursPerWeek} hours. Its core tasks are kept; extras are marked optional.`);
  }

  // 3. Custom tasks the member added.
  for (const c of p.customTasks) {
    const offset = daysBetween(p.startDate, c.date);
    if (offset < 0 || offset >= PLAN_DAYS) continue;
    const n = Math.floor(offset / 7) + 1;
    const key = `custom:${c.id}`;
    const t: PlanTask = { key, title: c.title, detail: c.detail, minutes: c.minutes, priority: "custom", category: "plan", stage: "custom", tool: null, week: n, date: c.date, scheduled: true, skipped: skipped.has(key), launch: null };
    const w = weeks[n - 1];
    w.tasks.push(t);
    if (!t.skipped) w.scheduledMinutes += t.minutes;
  }
  for (const w of weeks) w.tasks.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  // 4. Launch checklists.
  const launches: PlanLaunch[] = launchWeeks.map((week, i) => {
    const n = i + 1;
    const days = workDaysOfWeek(p, week);
    return {
      n,
      week,
      date: days[Math.floor((days.length - 1) / 2)],
      title: n === 1 ? `Launch 1: ${p.productIdea.trim() || "your first product"}` : `Launch ${n}: your next product`,
      groups: LAUNCH_CHECKLIST.map((g) => ({ id: g.id, title: g.title, items: g.items.filter((it) => !it.when || it.when(p)).map((it) => ({ key: `L${n}:${g.id}:${it.key}`, text: it.text })) })),
    };
  });

  const tasks = weeks.flatMap((w) => w.tasks);
  const goal = goalMath(p, launches.length);
  return {
    profile: p,
    startDate: p.startDate,
    endDate: addDays(p.startDate, PLAN_DAYS - 1),
    weeks,
    launches,
    tasks,
    goal,
    notes,
    summary: `${EXPERIENCE_SHORT[p.experience]} · ${p.hoursPerWeek} h/week · ${BUSINESS_MODEL_LABELS[p.businessModel]} · ${launches.length} launch${launches.length === 1 ? "" : "es"} (first in week ${launchWeeks[0]})`,
  };
}

export function goalMath(p: ProfitPathProfile, launchCount: number): GoalMath {
  const salesNeeded = p.revenueGoal > 0 ? Math.ceil(p.revenueGoal / p.pricePoint) : 0;
  return {
    revenueGoal: p.revenueGoal,
    perLaunch: launchCount ? Math.round(p.revenueGoal / launchCount) : p.revenueGoal,
    salesNeeded,
    visitorsNeeded: Math.ceil(salesNeeded / (p.conversionPct / 100)),
    conversionPct: p.conversionPct,
    pricePoint: p.pricePoint,
    listGoal: p.listGoal,
    currency: p.currency,
  };
}

export function hoursText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

/* ------------------------------------------------------------------------------------------ */
/* Progress                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export type PathStatus = "not-started" | "ahead" | "on-track" | "behind" | "complete";
export const PATH_STATUS_LABELS: Record<PathStatus, string> = { "not-started": "Starts soon", ahead: "Ahead of plan", "on-track": "On track", behind: "Behind plan", complete: "Complete" };

export interface WeekStats {
  n: number;
  done: number;
  total: number;
  percent: number;
  coreDone: boolean;
}

export interface PathStats {
  done: number;
  total: number;
  percent: number;
  minutesDone: number;
  minutesTotal: number;
  /** Plan week containing today: 0 before the start, 14 after the end. */
  currentWeek: number;
  dayOfPlan: number;
  today: PlanTask[];
  overdue: PlanTask[];
  next: PlanTask | null;
  expected: number;
  status: PathStatus;
  /** Consecutive days (up to today) with at least one completed task. */
  streak: number;
  weeks: WeekStats[];
  milestonesReached: number;
  launches: { n: number; done: number; total: number }[];
  /** Optional extras ticked off on top of the plan. */
  extrasDone: number;
}

export const isCounted = (t: PlanTask) => t.scheduled && !t.skipped;

export function pathStats(plan: ProfitPlan, progress: Pick<LabProgress, "done"> | null | undefined, today: string = todayDay()): PathStats {
  const done = progress?.done ?? {};
  const counted = plan.tasks.filter(isCounted);
  const isDone = (t: PlanTask) => !!done[t.key];
  const doneTasks = counted.filter(isDone);
  const dayOfPlan = daysBetween(plan.startDate, today) + 1;
  const currentWeek = dayOfPlan < 1 ? 0 : dayOfPlan > PLAN_DAYS ? PLAN_WEEKS + 1 : Math.floor((dayOfPlan - 1) / 7) + 1;
  const todayTasks = counted.filter((t) => t.date === today);
  const overdue = counted.filter((t) => t.date && t.date < today && !isDone(t));
  const next = counted.filter((t) => !isDone(t) && t.date && t.date >= today).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))[0] ?? null;
  const expected = counted.filter((t) => t.date && t.date < today).length;
  const percent = counted.length ? Math.round((doneTasks.length / counted.length) * 100) : 0;

  let status: PathStatus;
  if (counted.length && doneTasks.length === counted.length) status = "complete";
  else if (dayOfPlan < 1) status = doneTasks.length ? "ahead" : "not-started";
  else {
    const diff = doneTasks.length - expected;
    const tolerance = Math.max(2, Math.round(expected * 0.15));
    status = diff >= 3 ? "ahead" : diff < -tolerance ? "behind" : "on-track";
  }

  // Streak of days with a completion, counting back from today (or yesterday if nothing yet today).
  const completedDays = new Set(Object.values(done).map((iso) => formatDay(new Date(iso))));
  let streak = 0;
  let cursor = completedDays.has(today) ? today : addDays(today, -1);
  while (completedDays.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const weeks: WeekStats[] = plan.weeks.map((w) => {
    const ts = w.tasks.filter(isCounted);
    const d = ts.filter(isDone).length;
    const core = ts.filter((t) => t.priority === "core" || t.priority === "custom");
    return { n: w.n, done: d, total: ts.length, percent: ts.length ? Math.round((d / ts.length) * 100) : 0, coreDone: core.length > 0 && core.every(isDone) };
  });

  const launches = plan.launches.map((l) => {
    const items = l.groups.flatMap((g) => g.items);
    return { n: l.n, done: items.filter((i) => done[i.key]).length, total: items.length };
  });

  return {
    done: doneTasks.length,
    total: counted.length,
    percent,
    minutesDone: doneTasks.reduce((n, t) => n + t.minutes, 0),
    minutesTotal: counted.reduce((n, t) => n + t.minutes, 0),
    currentWeek,
    dayOfPlan,
    today: todayTasks,
    overdue,
    next,
    expected,
    status,
    streak,
    weeks,
    milestonesReached: weeks.filter((w) => w.coreDone).length,
    launches,
    extrasDone: plan.tasks.filter((t) => !t.scheduled && !t.skipped && isDone(t)).length,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Exports                                                                                      */
/* ------------------------------------------------------------------------------------------ */

const tick = (done: Record<string, string>, key: string) => (done[key] ? "x" : " ");

export function pathMarkdown(plan: ProfitPlan, progress: Pick<LabProgress, "done" | "notes"> | null, title = "90-Day Profit Path"): string {
  const done = progress?.done ?? {};
  const p = plan.profile;
  const g = plan.goal;
  const lines = [
    `# ${title}`,
    "",
    `${plan.summary}`,
    "",
    `**Dates:** ${plan.startDate} to ${plan.endDate}`,
    `**Goal:** ${p.currency} ${g.revenueGoal.toLocaleString()} revenue · ${g.listGoal.toLocaleString()} subscribers`,
    `**What-if maths:** about ${g.salesNeeded.toLocaleString()} sales at ${p.currency} ${g.pricePoint} — roughly ${g.visitorsNeeded.toLocaleString()} sales-page visitors at a ${g.conversionPct}% conversion rate. Your real numbers will differ.`,
    "",
  ];
  if (plan.notes.length) lines.push("## Notes", "", ...plan.notes.map((n) => `- ${n}`), "");
  for (const w of plan.weeks) {
    lines.push(`## Week ${w.n} · ${w.title} (${w.start} to ${w.end})`, "", `*${w.focus}* Milestone: **${w.milestone}**`, "");
    for (const t of w.tasks.filter((x) => x.scheduled && !x.skipped)) lines.push(`- [${tick(done, t.key)}] ${t.date} · ${t.title} (${hoursText(t.minutes)}${t.tool ? ` · ${t.tool.label}` : ""})`);
    const extras = w.tasks.filter((x) => !x.scheduled && !x.skipped);
    if (extras.length) lines.push("", "If you have extra time:", ...extras.map((t) => `- [${tick(done, t.key)}] ${t.title} (${hoursText(t.minutes)})`));
    const note = progress?.notes?.[`week:${w.n}`];
    if (note) lines.push("", `> ${note.replace(/\n/g, "\n> ")}`);
    lines.push("");
  }
  for (const l of plan.launches) {
    lines.push(`## ${l.title} — launch checklist (${l.date})`, "");
    for (const grp of l.groups) lines.push(`### ${grp.title}`, "", ...grp.items.map((i) => `- [${tick(done, i.key)}] ${i.text}`), "");
  }
  return lines.join("\n");
}

export function pathCsv(plan: ProfitPlan, progress: Pick<LabProgress, "done"> | null): string {
  const done = progress?.done ?? {};
  return Papa.unparse(
    plan.tasks
      .filter((t) => !t.skipped)
      .map((t) => ({
        week: t.week,
        date: t.date ?? "",
        task: t.title,
        category: t.stage === "custom" ? "Your task" : PATH_CATEGORY_LABELS[t.category],
        priority: t.priority,
        minutes: t.minutes,
        scheduled: t.scheduled ? "yes" : "optional",
        tool: t.tool?.label ?? "",
        done: done[t.key] ? done[t.key].slice(0, 10) : "",
      })),
  );
}

/** One all-day event per working day listing that day's tasks, plus each launch day. */
export function pathIcs(plan: ProfitPlan, name = "90-Day Profit Path", now: Date = new Date()): string {
  const byDay = new Map<string, PlanTask[]>();
  for (const t of plan.tasks) if (isCounted(t) && t.date) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);
  const allDay = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, ts]) => ({
      uid: `path-${plan.profile.memberId}-${day}`,
      day,
      summary: `Profit Path: ${ts.length} task${ts.length === 1 ? "" : "s"} (${hoursText(ts.reduce((n, t) => n + t.minutes, 0))})`,
      description: ts.map((t) => `• ${t.title} (${hoursText(t.minutes)})`).join("\n"),
    }));
  for (const l of plan.launches) allDay.push({ uid: `path-${plan.profile.memberId}-launch-${l.n}`, day: l.date, summary: `🚀 ${l.title}`, description: "Launch day — see the launch checklist in your Profit Path." });
  return buildIcs(name, { allDay }, now);
}

/** Tasks for one day across the plan (used by the Today view and calendar strip). */
export function tasksOn(plan: ProfitPlan, day: string): PlanTask[] {
  return plan.tasks.filter((t) => isCounted(t) && t.date === day);
}

/** Is a day inside the plan? */
export function inPlan(plan: ProfitPlan, day: string): boolean {
  const d = daysBetween(plan.startDate, day);
  return d >= 0 && d < PLAN_DAYS;
}

export { parseDay };
