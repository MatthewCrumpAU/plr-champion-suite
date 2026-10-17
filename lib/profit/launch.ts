import Papa from "papaparse";
import { getRepos, type Repositories } from "@/lib/data";
import type { Asset } from "@/lib/data/types";
import type { LaunchChecklistItem, LaunchMilestone, LaunchPlanData, LaunchTask, LaunchTemplate } from "@/lib/models/profit";
import { LAUNCH_CATEGORY_LABELS } from "@/lib/models/profit";
import { nowIso, uid } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Dates                                                                */
/* ------------------------------------------------------------------ */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's date in the user's local time zone (YYYY-MM-DD). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The date a task is due: its own date, or launch date + offset. */
export function taskDue(t: { dueDate: string | null; offsetDays: number | null }, launchDate: string | null): string | null {
  if (t.dueDate) return t.dueDate;
  if (launchDate && t.offsetDays !== null) return addDays(launchDate, t.offsetDays);
  return null;
}

export function milestoneDate(m: LaunchMilestone, launchDate: string | null): string | null {
  if (m.date) return m.date;
  if (launchDate && m.offsetDays !== null) return addDays(launchDate, m.offsetDays);
  return null;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Progress                                                             */
/* ------------------------------------------------------------------ */
export interface LaunchProgress {
  total: number;
  done: number;
  overdue: number;
  blocked: number;
  criticalOpen: number;
  pct: number;
  readinessDone: number;
  marketingDone: number;
}

export function launchProgress(d: LaunchPlanData, autoDone: Set<string>, today = todayIso()): LaunchProgress {
  const total = d.tasks.length;
  const done = d.tasks.filter((t) => t.status === "done").length;
  const overdue = d.tasks.filter((t) => t.status !== "done" && (taskDue(t, d.launchDate) ?? "9999") < today).length;
  const isDone = (i: LaunchChecklistItem) => i.done || (!!i.autoKey && autoDone.has(i.autoKey));
  return {
    total,
    done,
    overdue,
    blocked: d.tasks.filter((t) => t.status === "blocked").length,
    criticalOpen: d.tasks.filter((t) => t.priority === "critical" && t.status !== "done").length,
    pct: total ? Math.round((done / total) * 100) : 0,
    readinessDone: d.readiness.filter(isDone).length,
    marketingDone: d.marketing.filter(isDone).length,
  };
}

/* ------------------------------------------------------------------ */
/* Checklists with automatic checks from project assets                 */
/* ------------------------------------------------------------------ */
export const AUTO_KEYS: Record<string, { label: string; test: (assets: Asset[]) => boolean }> = {
  "doc-approved": { label: "Main product document marked approved or ready", test: (a) => a.some((x) => x.type === "document" && (x.status === "approved" || x.status === "ready")) },
  "rights-reviewed": { label: "Licence review marked as reviewed", test: (a) => a.some((x) => x.type === "rights-review" && !!(x as Asset<"rights-review">).data.reviewedAt) },
  "has-cover": { label: "Cover designed", test: (a) => a.some((x) => x.type === "cover") },
  "has-mockup": { label: "Product mockup created", test: (a) => a.some((x) => x.type === "mockup") },
  "has-sales-page": { label: "Sales page written", test: (a) => a.some((x) => x.type === "sales-page") },
  "has-emails": { label: "Email sequence written", test: (a) => a.some((x) => x.type === "email-campaign" && (x as Asset<"email-campaign">).data.emails.length > 0) },
  "has-social": { label: "Social posts planned", test: (a) => a.some((x) => x.type === "social-campaign" && (x as Asset<"social-campaign">).data.posts.length > 0) },
  "has-lead-magnet": { label: "Lead magnet created", test: (a) => a.some((x) => x.type === "document" && (x as Asset<"document">).data.role === "lead-magnet") },
  "has-bonus": { label: "Bonus created", test: (a) => a.some((x) => x.type === "document" && (x as Asset<"document">).data.role === "bonus") },
  "has-funnel": { label: "Funnel planned", test: (a) => a.some((x) => x.type === "funnel" && (x as Asset<"funnel">).data.nodes.length > 0) },
  "has-profit": { label: "Pricing modelled in Profit Calculator", test: (a) => a.some((x) => x.type === "profit-scenario") },
};

export function autoDoneKeys(assets: Asset[]): Set<string> {
  const live = assets.filter((a) => !a.deletedAt);
  return new Set(Object.entries(AUTO_KEYS).filter(([, v]) => v.test(live)).map(([k]) => k));
}

const item = (label: string, autoKey: string | null = null): LaunchChecklistItem => ({ id: uid("lc"), label, done: false, autoKey });

export function defaultReadiness(): LaunchChecklistItem[] {
  return [
    item("Licence reviewed and the planned use is allowed", "rights-reviewed"),
    item("Product content edited, rebranded and approved", "doc-approved"),
    item("Product exported to the final delivery format (PDF/DOCX)"),
    item("Cover designed", "has-cover"),
    item("Bonuses created", "has-bonus"),
    item("Delivery set up and tested (download link or members area)"),
    item("Checkout tested with a real purchase and refund"),
    item("Support email and refund policy published"),
  ];
}

export function defaultMarketing(): LaunchChecklistItem[] {
  return [
    item("Sales page written", "has-sales-page"),
    item("Product mockup images", "has-mockup"),
    item("Lead magnet ready", "has-lead-magnet"),
    item("Launch email sequence", "has-emails"),
    item("Social posts scheduled", "has-social"),
    item("Funnel mapped", "has-funnel"),
    item("Price checked in the Profit Calculator", "has-profit"),
  ];
}

/* ------------------------------------------------------------------ */
/* Templates                                                            */
/* ------------------------------------------------------------------ */
type TT = LaunchTemplate["tasks"][number];
const t = (title: string, category: TT["category"], offsetDays: number, priority: TT["priority"] = "medium", notes = ""): TT => ({ title, category, offsetDays, priority, notes, milestoneId: null });

export const BUILT_IN_TEMPLATES: LaunchTemplate[] = [
  {
    id: "builtin-standard",
    name: "Standard 3-week product launch",
    description: "Prepare the product, build the sales assets, warm up your list, launch and follow up.",
    builtIn: true,
    milestones: [
      { title: "Product finished", offsetDays: -14 },
      { title: "Sales assets ready", offsetDays: -7 },
      { title: "Pre-launch emails start", offsetDays: -3 },
      { title: "Launch day", offsetDays: 0 },
      { title: "Launch review", offsetDays: 7 },
    ],
    tasks: [
      t("Review the PLR licence for the planned use", "admin", -21, "critical"),
      t("Rebrand and edit the product", "product", -18, "high"),
      t("Design the cover and mockups", "product", -15, "high"),
      t("Create bonuses", "product", -14),
      t("Write the sales page", "marketing", -10, "high"),
      t("Set up checkout and delivery", "tech", -9, "critical"),
      t("Write the launch email sequence", "marketing", -8, "high"),
      t("Create the lead magnet", "content", -12),
      t("Prepare social posts", "content", -6),
      t("Test purchase, download and refund", "tech", -4, "critical"),
      t("Send pre-launch emails", "marketing", -3, "high"),
      t("Open the cart and announce", "launch-day", 0, "critical"),
      t("Monitor sales and answer questions", "launch-day", 0, "high"),
      t("Send follow-up emails to buyers", "post-launch", 2),
      t("Record actual sales in the Profit Calculator", "post-launch", 7),
      t("Review results and plan the next offer", "post-launch", 7),
    ],
  },
  {
    id: "builtin-quick",
    name: "Quick 7-day launch",
    description: "A lean plan for a small product or bonus launched to an existing list.",
    builtIn: true,
    milestones: [
      { title: "Product ready", offsetDays: -4 },
      { title: "Launch day", offsetDays: 0 },
    ],
    tasks: [
      t("Check the licence", "admin", -7, "critical"),
      t("Edit and rebrand the product", "product", -6, "high"),
      t("Cover and one mockup", "product", -5),
      t("Short sales page", "marketing", -4, "high"),
      t("Checkout and delivery test", "tech", -2, "critical"),
      t("Three launch emails", "marketing", -2, "high"),
      t("Launch", "launch-day", 0, "critical"),
      t("Thank-you email and review", "post-launch", 3),
    ],
  },
  {
    id: "builtin-leadmagnet",
    name: "Lead magnet & list-building campaign",
    description: "Build a free opt-in offer, promote it for two weeks and nurture new subscribers.",
    builtIn: true,
    milestones: [
      { title: "Opt-in page live", offsetDays: 0 },
      { title: "Campaign review", offsetDays: 14 },
    ],
    tasks: [
      t("Confirm the licence allows free giveaways", "admin", -7, "critical"),
      t("Create the lead magnet", "product", -6, "high"),
      t("Design the lead magnet cover", "product", -5),
      t("Write the welcome email sequence", "marketing", -4, "high"),
      t("Build the opt-in page and connect the email tool", "tech", -2, "critical"),
      t("Test the opt-in and delivery", "tech", -1, "critical"),
      t("Publish the opt-in page", "launch-day", 0, "critical"),
      t("Share on social channels", "content", 1),
      t("Review opt-in rate", "post-launch", 14),
    ],
  },
];

export async function loadCustomTemplates(repos: Repositories = getRepos()): Promise<LaunchTemplate[]> {
  return ((await repos.settings.get<LaunchTemplate[]>("launchTemplates")) ?? []).filter((x) => x && Array.isArray(x.tasks));
}

export async function saveCustomTemplate(tpl: Omit<LaunchTemplate, "id" | "builtIn">, repos: Repositories = getRepos()): Promise<LaunchTemplate> {
  const list = await loadCustomTemplates(repos);
  const next: LaunchTemplate = { ...tpl, id: uid("ltpl"), builtIn: false };
  await repos.settings.set("launchTemplates", [...list, next]);
  return next;
}

export async function deleteCustomTemplate(id: string, repos: Repositories = getRepos()) {
  await repos.settings.set("launchTemplates", (await loadCustomTemplates(repos)).filter((x) => x.id !== id));
}

/** Turns a plan's tasks into a reusable template (dates become offsets from launch day). */
export function templateFromPlan(d: LaunchPlanData, name: string, description: string): Omit<LaunchTemplate, "id" | "builtIn"> {
  const offset = (due: string | null, off: number | null) => (off !== null ? off : due && d.launchDate ? daysBetween(d.launchDate, due) : null);
  return {
    name,
    description,
    tasks: d.tasks.map((x) => ({ title: x.title, category: x.category, priority: x.priority, offsetDays: offset(x.dueDate, x.offsetDays), notes: x.notes, milestoneId: null })),
    milestones: d.milestones.map((m) => ({ title: m.title, offsetDays: offset(m.date, m.offsetDays) })),
  };
}

export function applyTemplate(d: LaunchPlanData, tpl: LaunchTemplate, mode: "replace" | "append"): LaunchPlanData {
  const tasks: LaunchTask[] = tpl.tasks.map((x) => ({ ...x, id: uid("lt"), status: "todo", dueDate: null }));
  const milestones: LaunchMilestone[] = tpl.milestones.map((m) => ({ ...m, id: uid("lm"), done: false, date: null }));
  return {
    ...d,
    templateName: tpl.name,
    tasks: mode === "replace" ? tasks : [...d.tasks, ...tasks],
    milestones: mode === "replace" ? milestones : [...d.milestones, ...milestones],
    readiness: d.readiness.length ? d.readiness : defaultReadiness(),
    marketing: d.marketing.length ? d.marketing : defaultMarketing(),
  };
}

/* ------------------------------------------------------------------ */
/* Exports                                                              */
/* ------------------------------------------------------------------ */
const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsDate = (iso: string) => iso.replace(/-/g, "");

/** iCalendar (.ics) file with an all-day event for every dated task and milestone. */
export function launchIcs(d: LaunchPlanData, title: string): string {
  const stamp = nowIso().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PLR Champion//Launch Planner//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsEscape(title)}`];
  const ev = (id: string, date: string, summary: string, desc: string) => {
    lines.push("BEGIN:VEVENT", `UID:${id}@plr-champion`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(date, 1))}`, `SUMMARY:${icsEscape(summary)}`);
    if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    lines.push("END:VEVENT");
  };
  for (const m of d.milestones) {
    const date = milestoneDate(m, d.launchDate);
    if (date) ev(m.id, date, `◆ ${m.title}`, "Milestone");
  }
  for (const x of d.tasks) {
    const date = taskDue(x, d.launchDate);
    if (date) ev(x.id, date, `${x.status === "done" ? "✓ " : ""}${x.title}`, `${LAUNCH_CATEGORY_LABELS[x.category]} · ${x.priority} priority${x.notes ? `\n${x.notes}` : ""}`);
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function launchCsv(d: LaunchPlanData): string {
  return Papa.unparse(
    [...d.tasks]
      .sort((a, b) => (taskDue(a, d.launchDate) ?? "9999").localeCompare(taskDue(b, d.launchDate) ?? "9999"))
      .map((x) => ({ due: taskDue(x, d.launchDate) ?? "", task: x.title, category: LAUNCH_CATEGORY_LABELS[x.category], priority: x.priority, status: x.status, milestone: d.milestones.find((m) => m.id === x.milestoneId)?.title ?? "", notes: x.notes })),
  );
}

export function launchMarkdown(d: LaunchPlanData, title: string) {
  const lines = [`# ${title}`, "", `**Launch date:** ${d.launchDate ?? "not set"}`, ""];
  if (d.milestones.length) {
    lines.push("## Milestones", "");
    for (const m of d.milestones) lines.push(`- [${m.done ? "x" : " "}] ${milestoneDate(m, d.launchDate) ?? "—"} · ${m.title}`);
    lines.push("");
  }
  lines.push("## Tasks", "");
  for (const t of [...d.tasks].sort((a, b) => (taskDue(a, d.launchDate) ?? "9999").localeCompare(taskDue(b, d.launchDate) ?? "9999"))) lines.push(`- [${t.status === "done" ? "x" : " "}] ${taskDue(t, d.launchDate) ?? "—"} · ${t.title} (${LAUNCH_CATEGORY_LABELS[t.category]}, ${t.priority})`);
  lines.push("", "## Product readiness", "", ...d.readiness.map((i) => `- [${i.done ? "x" : " "}] ${i.label}`), "", "## Marketing assets", "", ...d.marketing.map((i) => `- [${i.done ? "x" : " "}] ${i.label}`));
  if (d.notes) lines.push("", "## Notes", "", d.notes);
  return lines.join("\n");
}

