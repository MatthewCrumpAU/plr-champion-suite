// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, dayOfMonth, daysBetween, isDay, monthOf, nextMonth, weekday } from "@/lib/lab/dates";
import { buildIcs, foldLine, icsEscape } from "@/lib/lab/ics";
import { defaultProfile, generatePlan, goalMath, isCounted, nextMonday, normalizeProfile, pathCsv, pathIcs, pathMarkdown, pathStats, planSegments, PLAN_DAYS, PLAN_WEEKS, type ProfitPlan } from "@/lib/lab/profit-path";
import { addCustomTask, createProfile, getProfile, getProgress, progressId, removeCustomTask, saveProfile, setDone, setNote, setTaskSkipped } from "@/lib/lab/store";
import { createMembershipRepositories, MembershipDatabase, setMembershipRepos, type MembershipRepositories } from "@/lib/membership/db";
import type { ProfitPathProfile } from "@/lib/lab/types";

const START = "2026-11-02"; // a Monday
const profile = (patch: Partial<ProfitPathProfile> = {}) => defaultProfile("plr-profit-lab", "acct_test", new Date(2026, 9, 28), { startDate: START, ...patch });

describe("local dates", () => {
  it("does calendar maths in local days", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(daysBetween("2026-11-02", "2027-01-31")).toBe(90);
    expect(weekday(START)).toBe(1);
    expect(nextMonday("2026-11-04")).toBe("2026-11-09");
    expect(nextMonday(START)).toBe(START);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-02-28")).toBe(true);
    expect(dayOfMonth("2026-02", 31)).toBe("2026-02-28");
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(monthOf(new Date(2026, 0, 31), 1)).toBe("2026-02");
  });
});

describe("iCalendar writer", () => {
  it("escapes text and folds long lines at 75 octets", () => {
    expect(icsEscape("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const long = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldLine(long);
    expect(folded.length).toBeGreaterThan(2);
    expect(folded.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(folded.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(long);
    const ics = buildIcs("Test", { allDay: [{ uid: "a", day: "2026-11-02", summary: "Hello, world" }] }, new Date("2026-11-01T00:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20261102\r\nDTEND;VALUE=DATE:20261103");
    expect(ics).toContain("SUMMARY:Hello\\, world");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("profile normalisation", () => {
  it("clamps answers into a range the planner can use", () => {
    const p = normalizeProfile({ ...profile(), hoursPerWeek: 0, workDays: [9, -1], launches: 7, firstLaunchWeek: 1, conversionPct: 0, startDate: "nonsense" });
    expect(p.hoursPerWeek).toBe(1);
    expect(p.workDays).toEqual([1, 2, 3, 4, 5]);
    expect(p.launches).toBe(3);
    expect(p.firstLaunchWeek).toBe(3);
    expect(p.conversionPct).toBe(0.1);
    expect(isDay(p.startDate)).toBe(true);
  });
});

describe("plan layout", () => {
  it("places foundations, create and prepare before the first launch", () => {
    const { segments, launchWeeks } = planSegments(profile({ firstLaunchWeek: 7, launches: 1 }));
    expect(launchWeeks).toEqual([7]);
    const weeksOf = (s: string) => segments.filter((x) => x.stage === s).flatMap((x) => x.weeks);
    expect(Math.max(...weeksOf("foundations"))).toBeLessThan(Math.min(...weeksOf("create")));
    expect(Math.max(...weeksOf("create"))).toBeLessThan(Math.min(...weeksOf("prepare")));
    expect(Math.max(...weeksOf("prepare"))).toBe(6);
    expect(weeksOf("review")).toEqual([8]);
    expect(weeksOf("grow")).toEqual([9, 10, 11, 12]);
    expect(weeksOf("final")).toEqual([13]);
  });

  it("spaces later launches at least three weeks apart, finishing by week 12", () => {
    expect(planSegments(profile({ firstLaunchWeek: 4, launches: 3 })).launchWeeks).toEqual([4, 7, 10]);
    expect(planSegments(profile({ firstLaunchWeek: 6, launches: 2 })).launchWeeks).toEqual([6, 9]);
    const late = planSegments(profile({ firstLaunchWeek: 10, launches: 3 }));
    expect(late.launchWeeks).toEqual([10]);
    expect(late.notes[0]).toMatch(/Only 1 launch fits/);
    const tight = planSegments(profile({ firstLaunchWeek: 3, launches: 1 }));
    expect(tight.notes.some((n) => /share week 2/.test(n))).toBe(true);
  });
});

describe("plan generation", () => {
  let plan: ProfitPlan;
  beforeEach(() => {
    plan = generatePlan(profile({ hoursPerWeek: 8, firstLaunchWeek: 7 }));
  });

  it("covers 13 weeks and 90 days, with every task on a working day inside the plan", () => {
    expect(plan.weeks).toHaveLength(PLAN_WEEKS);
    expect(plan.endDate).toBe(addDays(START, PLAN_DAYS - 1));
    for (const t of plan.tasks.filter((x) => x.date)) {
      expect([1, 2, 3, 4, 5]).toContain(weekday(t.date!));
      expect(daysBetween(START, t.date!)).toBeGreaterThanOrEqual(0);
      expect(daysBetween(START, t.date!)).toBeLessThan(PLAN_DAYS);
      const w = plan.weeks[t.week - 1];
      expect(t.date! >= w.start && t.date! <= w.end).toBe(true);
    }
    expect(plan.weeks[12].end).toBe(plan.endDate);
  });

  it("keeps task keys unique and stable when answers change", () => {
    const keys = plan.tasks.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const replanned = generatePlan({ ...plan.profile, hoursPerWeek: 20 });
    const again = new Set(replanned.tasks.map((t) => t.key));
    expect(keys.filter((k) => !again.has(k))).toEqual([]);
  });

  it("puts the launch on the middle working day with emails around it", () => {
    const launch = plan.launches[0];
    expect(launch.week).toBe(7);
    expect(weekday(launch.date)).toBe(3); // Wednesday for Mon–Fri
    const open = plan.tasks.find((t) => t.key === "launch:open@L1")!;
    const pre = plan.tasks.find((t) => t.key === "launch:pre-email@L1")!;
    const faq = plan.tasks.find((t) => t.key === "launch:followup-faq@L1")!;
    expect(open.date).toBe(launch.date);
    expect(daysBetween(pre.date!, open.date!)).toBe(1);
    expect(daysBetween(open.date!, faq.date!)).toBe(1);
    expect(plan.weeks[6].milestone).toBe("Launch 1 is live");
  });

  it("always schedules core tasks and only adds extras that fit the hours", () => {
    const low = generatePlan(profile({ hoursPerWeek: 2 }));
    const high = generatePlan(profile({ hoursPerWeek: 30 }));
    for (const t of low.tasks.filter((x) => x.priority === "core")) expect(t.scheduled).toBe(true);
    const lowExtras = low.tasks.filter((t) => !t.scheduled).length;
    const highExtras = high.tasks.filter((t) => !t.scheduled).length;
    expect(lowExtras).toBeGreaterThan(highExtras);
    for (const w of high.weeks) expect(w.scheduledMinutes).toBeLessThanOrEqual(Math.max(w.capacityMinutes, w.tasks.filter((t) => t.priority === "core").reduce((n, t) => n + t.minutes, 0)));
    expect(low.notes.some((n) => /more than your 2 hours/.test(n))).toBe(true);
    expect(low.weeks.some((w) => w.overByMinutes > 0)).toBe(true);
  });

  it("personalises tasks from the member's situation", () => {
    const has = (p: ProfitPlan, key: string) => p.tasks.some((t) => t.key.startsWith(key));
    const beginner = generatePlan(profile({ experience: "new", hasEmailList: false, hasCheckout: false }));
    const pro = generatePlan(profile({ experience: "experienced", hasEmailList: true, listSize: 5000, hasCheckout: true, hasWebsite: true, ownProducts: 3 }));
    expect(has(beginner, "foundations:quick-start")).toBe(true);
    expect(has(pro, "foundations:quick-start")).toBe(false);
    expect(has(beginner, "foundations:email-tool")).toBe(true);
    expect(has(pro, "foundations:email-tool")).toBe(false);
    expect(has(pro, "foundations:last-numbers")).toBe(true);
    expect(pro.tasks.find((t) => t.key.startsWith("prepare:warm-list"))!.title).toMatch(/5,000/);
    // Beginners get more time per task.
    const m = (p: ProfitPlan) => p.tasks.find((t) => t.key === "create:intro")!.minutes;
    expect(m(beginner)).toBeGreaterThan(m(pro));
    expect(has(generatePlan(profile({ businessModel: "membership" })), "foundations:membership-plan")).toBe(true);
    expect(has(generatePlan(profile({ businessModel: "plr-reseller" })), "foundations:sellplr-check")).toBe(true);
    expect(has(generatePlan(profile({ businessModel: "bundles" })), "create:bundle-edit")).toBe(true);
    const lm = generatePlan(profile({ businessModel: "lead-magnet-funnel" }));
    expect(has(lm, "create:lead-magnet-build")).toBe(true);
    expect(has(lm, "prepare:lead-magnet")).toBe(false);
    expect(lm.launches[0].groups[0].items.some((i) => /end to end/.test(i.text))).toBe(true);
  });

  it("plans review, next-product and launch weeks for multiple launches", () => {
    const p = generatePlan(profile({ launches: 3, firstLaunchWeek: 4, hoursPerWeek: 15 }));
    expect(p.launches.map((l) => l.week)).toEqual([4, 7, 10]);
    expect(p.tasks.some((t) => t.key === "next-product:edit@L2")).toBe(true);
    expect(p.tasks.some((t) => t.key === "next-product:edit@L3")).toBe(true);
    expect(p.tasks.some((t) => t.key === "review:numbers@L3")).toBe(true);
    expect(p.launches[2].groups.flatMap((g) => g.items).every((i) => i.key.startsWith("L3:"))).toBe(true);
  });

  it("respects the member's working days", () => {
    const p = generatePlan(profile({ workDays: [6] }));
    expect(p.tasks.filter((t) => t.date).every((t) => weekday(t.date!) === 6)).toBe(true);
  });

  it("adds custom tasks and leaves skipped tasks out of the counts", () => {
    const p = generatePlan(profile({ customTasks: [{ id: "x", title: "Call my accountant", detail: "", date: addDays(START, 10), minutes: 30 }], skippedTaskKeys: ["foundations:brand-kit"] }));
    const custom = p.tasks.find((t) => t.key === "custom:x")!;
    expect(custom.week).toBe(2);
    expect(custom.scheduled).toBe(true);
    const skipped = p.tasks.find((t) => t.key === "foundations:brand-kit")!;
    expect(skipped.skipped).toBe(true);
    expect(isCounted(skipped)).toBe(false);
  });

  it("does the goal maths", () => {
    expect(goalMath(profile({ revenueGoal: 1000, pricePoint: 25, conversionPct: 2 }), 2)).toMatchObject({ salesNeeded: 40, visitorsNeeded: 2000, perLaunch: 500 });
  });
});

describe("progress", () => {
  it("tracks done, today, overdue, status and streaks", () => {
    const plan = generatePlan(profile());
    const counted = plan.tasks.filter(isCounted).sort((a, b) => a.date!.localeCompare(b.date!));
    const today = addDays(START, 9); // second Wednesday
    const before = counted.filter((t) => t.date! < today);
    // Nothing done yet: behind.
    expect(pathStats(plan, null, today).status).toBe("behind");
    expect(pathStats(plan, null, today).overdue.length).toBe(before.length);
    expect(pathStats(plan, null, addDays(START, -3)).status).toBe("not-started");
    // Everything due done, ticked over the last three days: on track with a streak.
    const done: Record<string, string> = {};
    before.forEach((t, i) => (done[t.key] = new Date(2026, 10, 9 + (i % 3), 12).toISOString()));
    const s = pathStats(plan, { done }, today);
    expect(s.status).toBe("on-track");
    expect(s.overdue).toEqual([]);
    expect(s.currentWeek).toBe(2);
    expect(s.dayOfPlan).toBe(10);
    expect(s.streak).toBe(3);
    expect(s.today.every((t) => t.date === today)).toBe(true);
    expect(s.weeks[0].percent).toBe(100);
    expect(s.milestonesReached).toBeGreaterThanOrEqual(1);
    // All done: complete.
    const all = Object.fromEntries(counted.map((t) => [t.key, new Date().toISOString()]));
    expect(pathStats(plan, { done: all }, today).status).toBe("complete");
  });

  it("exports Markdown, CSV and a calendar", () => {
    const plan = generatePlan(profile({ productIdea: "Sleep Reset" }));
    const first = plan.tasks.find(isCounted)!;
    const md = pathMarkdown(plan, { done: { [first.key]: "2026-11-02T10:00:00.000Z" }, notes: { "week:1": "Good start" } });
    expect(md).toContain("## Week 1");
    expect(md).toContain(`- [x] ${first.date} · ${first.title}`);
    expect(md).toContain("> Good start");
    expect(md).toContain("Launch 1: Sleep Reset");
    const csv = pathCsv(plan, null);
    expect(csv.split(/\r?\n/)[0]).toBe("week,date,task,category,priority,minutes,scheduled,tool,done");
    const ics = pathIcs(plan, "Plan", new Date("2026-11-01T00:00:00Z"));
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBe(new Set(plan.tasks.filter((t) => isCounted(t) && t.date).map((t) => t.date)).size + plan.launches.length);
    expect(ics).toContain("Launch 1: Sleep Reset");
  });
});

describe("profile and progress storage", () => {
  let repos: MembershipRepositories;
  let n = 0;
  beforeEach(async () => {
    const db = new MembershipDatabase(`lab-path-${Date.now()}-${n++}`);
    await db.open();
    repos = createMembershipRepositories(db);
    setMembershipRepos(repos, db);
  });

  it("saves profiles per member and keeps them brand-scoped", async () => {
    const p = await createProfile("plr-profit-lab", "acct_a", { niche: "Gardening", hoursPerWeek: 12 });
    expect((await getProfile("plr-profit-lab", "acct_a"))!.niche).toBe("Gardening");
    expect(await getProfile("plr-champion", "acct_a")).toBeNull();
    const withTask = await addCustomTask(p, { title: "  Record intro video ", detail: "", date: addDays(p.startDate, 3), minutes: 0 });
    expect(withTask.customTasks[0]).toMatchObject({ title: "Record intro video", minutes: 30 });
    await expect(addCustomTask(p, { title: " ", detail: "", date: p.startDate, minutes: 10 })).rejects.toThrow(/name/);
    const skipped = await setTaskSkipped(withTask, "foundations:brand-kit", true);
    expect(skipped.skippedTaskKeys).toEqual(["foundations:brand-kit"]);
    const removed = await removeCustomTask(skipped, withTask.customTasks[0].id);
    expect(removed.customTasks).toEqual([]);
    const saved = await saveProfile({ ...removed, hoursPerWeek: 999 });
    expect(saved.hoursPerWeek).toBe(80);
  });

  it("ticks and unticks items without losing concurrent changes", async () => {
    const ref = "path:acct_a";
    await Promise.all([setDone("plr-profit-lab", "acct_a", "path", ref, "a", true), setDone("plr-profit-lab", "acct_a", "path", ref, "b", true), setNote("plr-profit-lab", "acct_a", "path", ref, "week:1", "Notes")]);
    let p = await getProgress("plr-profit-lab", "acct_a", "path", ref);
    expect(Object.keys(p.done).sort()).toEqual(["a", "b"]);
    expect(p.notes["week:1"]).toBe("Notes");
    expect(p.id).toBe(progressId("acct_a", "path", ref));
    await setDone("plr-profit-lab", "acct_a", "path", ref, "a", false);
    p = await getProgress("plr-profit-lab", "acct_a", "path", ref);
    expect(Object.keys(p.done)).toEqual(["b"]);
  });
});
