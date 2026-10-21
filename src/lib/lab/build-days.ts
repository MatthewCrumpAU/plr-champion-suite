import JSZip from "jszip";
import { deepClone, nowIso, slugify, uid } from "@/lib/utils";
import { getMembershipRepos, type MembershipRepositories } from "@/lib/membership/db";
import { deleteMemberFiles, storeMemberFile } from "@/lib/membership/files";
import { safeUrl } from "@/lib/membership/catalog";
import type { BrandId } from "@/lib/membership/types";
import { dayOfMonth, isMonth, monthLabel, monthOf } from "./dates";
import { buildIcs } from "./ics";
import {
  BUILD_FORMAT_LABELS,
  BUILD_PHASE_LABELS,
  BUILD_PHASES,
  SESSION_KIND_LABELS,
  type BuildAction,
  type BuildChecklistItem,
  type BuildDay,
  type BuildMaterial,
  type BuildSession,
  type LabProgress,
  type SessionKind,
  type SessionResource,
} from "./types";

/**
 * PLR Profit Build Day: a monthly hands-on workshop. The planner covers the agenda (with real
 * session times), resources per session, downloadable materials, an implementation checklist,
 * action items and attendee progress. Live sessions use an external meeting link — no streaming
 * is built in — and the community fields are stored ready for a later discussion feed.
 */

/* ---------------------------------------- Templates ---------------------------------------- */

export function newSession(kind: SessionKind = "teach", patch: Partial<BuildSession> = {}): BuildSession {
  return { id: uid("ses"), title: SESSION_KIND_LABELS[kind], kind, durationMin: kind === "break" ? 15 : 45, presenter: "", description: "", outcome: "", resources: [], prompts: [], ...patch };
}

export function defaultAgenda(): BuildSession[] {
  return [
    newSession("welcome", { title: "Welcome and today's outcome", durationMin: 15, description: "What we're building today and how the day works.", outcome: "Everyone knows what they'll leave with." }),
    newSession("teach", { title: "Teach: today's build topic", durationMin: 30, description: "A short, practical walkthrough of the method for today's build.", outcome: "A clear, step-by-step method to follow." }),
    newSession("build", { title: "Build sprint 1", durationMin: 60, description: "Cameras off, heads down. Work through the first half of the checklist.", outcome: "First half of today's build done.", prompts: ["What did you finish in sprint 1?", "Where did you get stuck?"] }),
    newSession("break", { title: "Break", durationMin: 15 }),
    newSession("hot-seat", { title: "Hot seats", durationMin: 45, description: "Members share their work for quick, specific feedback.", outcome: "Fixes for the most common sticking points.", prompts: ["Share one thing you'd like feedback on."] }),
    newSession("build", { title: "Build sprint 2", durationMin: 60, description: "Finish the build and apply the feedback.", outcome: "Today's build finished.", prompts: ["What did you finish in sprint 2?"] }),
    newSession("review", { title: "Share and commit", durationMin: 30, description: "Show what you built and commit to your next three actions.", outcome: "Three dated actions for the coming week.", prompts: ["Share your win from today.", "What are your next three actions?"] }),
  ];
}

export function defaultBuildChecklist(): BuildChecklistItem[] {
  const items: [BuildChecklistItem["phase"], string][] = [
    ["before", "Download the workbook and materials"],
    ["before", "Choose the product or project you'll work on"],
    ["before", "Add the Build Day to your calendar"],
    ["during", "Complete build sprint 1"],
    ["during", "Bring one question to the hot seats"],
    ["during", "Complete build sprint 2"],
    ["after", "Write down your three next actions"],
    ["after", "Share your win with the group"],
  ];
  return items.map(([phase, text]) => ({ id: uid("bc"), phase, text }));
}

export function defaultActions(): BuildAction[] {
  return [
    { id: uid("ba"), title: "Finish anything left from today's build", detail: "", dueDays: 2 },
    { id: uid("ba"), title: "Publish or schedule what you built", detail: "", dueDays: 5 },
    { id: uid("ba"), title: "Review your 90-Day Profit Path and update this week's tasks", detail: "", dueDays: 7 },
  ];
}

/** Default start: the second Saturday of the month at 10:00 local time. */
export function defaultStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const firstSat = 1 + ((6 - first + 7) % 7);
  return new Date(y, m - 1, firstSat + 7, 10, 0, 0, 0).toISOString();
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function newBuildDay(brandId: BrandId, month: string, patch: Partial<BuildDay> = {}): BuildDay {
  const now = nowIso();
  return {
    id: uid("bd"),
    brandId,
    title: `${monthLabel(month)} Build Day`,
    month,
    theme: "",
    outcome: "",
    startsAt: defaultStart(month),
    timezone: localTimeZone(),
    format: "live-online",
    host: "",
    location: "",
    joinUrl: "",
    replayUrl: "",
    capacity: null,
    status: "draft",
    publishAt: null,
    access: "member",
    coverFileId: null,
    agenda: defaultAgenda(),
    materials: [],
    checklist: defaultBuildChecklist(),
    actions: defaultActions(),
    community: { enabled: false, prompt: "Share your win from today's Build Day." },
    isSample: false,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

/* ---------------------------------------- Schedule ---------------------------------------- */

export interface ScheduledSession extends BuildSession {
  start: Date;
  end: Date;
}

export function schedule(b: Pick<BuildDay, "startsAt" | "agenda">): ScheduledSession[] {
  let t = new Date(b.startsAt).getTime();
  return b.agenda.map((s) => {
    const start = new Date(t);
    t += Math.max(0, s.durationMin) * 60_000;
    return { ...s, start, end: new Date(t) };
  });
}

export function totalMinutes(b: Pick<BuildDay, "agenda">): number {
  return b.agenda.reduce((n, s) => n + Math.max(0, s.durationMin), 0);
}

export function endsAt(b: Pick<BuildDay, "startsAt" | "agenda">): Date {
  return new Date(new Date(b.startsAt).getTime() + totalMinutes(b) * 60_000);
}

export type BuildPhase = "upcoming" | "live" | "past";

export function phaseOf(b: Pick<BuildDay, "startsAt" | "agenda">, now: Date = new Date()): BuildPhase {
  const start = new Date(b.startsAt);
  if (now < start) return "upcoming";
  return now < endsAt(b) ? "live" : "past";
}

/** "2 days 4 hours" until the start, or null once it has begun. */
export function countdown(b: Pick<BuildDay, "startsAt">, now: Date = new Date()): string | null {
  const ms = new Date(b.startsAt).getTime() - now.getTime();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d} day${d === 1 ? "" : "s"}${h ? ` ${h} hour${h === 1 ? "" : "s"}` : ""}`;
  if (h > 0) return `${h} hour${h === 1 ? "" : "s"}${m ? ` ${m} min` : ""}`;
  return `${m} min`;
}

/** Time in the host's time zone, e.g. "10:00 am AEDT". */
export function timeIn(date: Date, timeZone: string, opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }): string {
  try {
    return date.toLocaleTimeString(undefined, { ...opts, timeZone, timeZoneName: "short" });
  } catch {
    return date.toLocaleTimeString(undefined, opts);
  }
}

/* ---------------------------------------- Progress ---------------------------------------- */

export const sessionKey = (id: string) => `session:${id}`;
export const checklistKey = (id: string) => `check:${id}`;
export const actionKey = (id: string) => `action:${id}`;

export interface BuildDayStats {
  done: number;
  total: number;
  percent: number;
  sessions: { done: number; total: number };
  checklist: { done: number; total: number };
  actions: { done: number; total: number };
}

/** Sessions completed (excluding breaks), checklist items, hosted actions and the member's own actions. */
export function buildDayStats(b: BuildDay, progress: Pick<LabProgress, "done" | "ownActions"> | null | undefined): BuildDayStats {
  const done = progress?.done ?? {};
  const sessions = b.agenda.filter((s) => s.kind !== "break");
  const sDone = sessions.filter((s) => done[sessionKey(s.id)]).length;
  const cDone = b.checklist.filter((c) => done[checklistKey(c.id)]).length;
  const own = progress?.ownActions ?? [];
  const aDone = b.actions.filter((a) => done[actionKey(a.id)]).length + own.filter((a) => a.done).length;
  const aTotal = b.actions.length + own.length;
  const total = sessions.length + b.checklist.length + aTotal;
  const d = sDone + cDone + aDone;
  return { done: d, total, percent: total ? Math.round((d / total) * 100) : 0, sessions: { done: sDone, total: sessions.length }, checklist: { done: cDone, total: b.checklist.length }, actions: { done: aDone, total: aTotal } };
}

/** Due date for an action item (days after the Build Day), local "YYYY-MM-DD". */
export function actionDue(b: Pick<BuildDay, "startsAt">, a: Pick<BuildAction, "dueDays">): string {
  const d = new Date(b.startsAt);
  d.setDate(d.getDate() + a.dueDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------------------------------------- Records ---------------------------------------- */

export function validateBuildDay(b: BuildDay): string | null {
  if (!b.title.trim()) return "Give the Build Day a title.";
  if (!isMonth(b.month)) return "Choose the Build Day's month.";
  if (Number.isNaN(new Date(b.startsAt).getTime())) return "Choose a start date and time.";
  if (b.agenda.some((s) => !s.title.trim())) return "Every session needs a title.";
  if (b.agenda.some((s) => !(s.durationMin > 0) || s.durationMin > 600)) return "Session lengths must be between 1 and 600 minutes.";
  if (b.status === "scheduled" && !b.publishAt) return "Choose when the scheduled Build Day is released to members.";
  if (b.capacity !== null && (!Number.isInteger(b.capacity) || b.capacity < 1)) return "Capacity must be a whole number, or empty for no limit.";
  return null;
}

export async function saveBuildDay(b: BuildDay, repos?: MembershipRepositories): Promise<BuildDay> {
  const problem = validateBuildDay(b);
  if (problem) throw new Error(problem);
  const r = repos ?? getMembershipRepos();
  const next: BuildDay = {
    ...b,
    title: b.title.trim(),
    joinUrl: b.joinUrl.trim() ? safeUrl(b.joinUrl) : "",
    replayUrl: b.replayUrl.trim() ? safeUrl(b.replayUrl) : "",
    agenda: b.agenda.map((s) => ({ ...s, resources: s.resources.map((res) => (res.kind === "link" ? { ...res, url: res.url.trim() ? safeUrl(res.url) : "" } : res)) })),
    updatedAt: nowIso(),
  };
  await r.buildDays.put(next);
  return next;
}

export function buildDayFileIds(b: BuildDay): string[] {
  return [b.coverFileId, ...b.materials.map((m) => m.fileId), ...b.agenda.flatMap((s) => s.resources.map((r) => r.fileId))].filter((x): x is string => !!x);
}

export async function deleteBuildDay(id: string, repos?: MembershipRepositories) {
  const r = repos ?? getMembershipRepos();
  const b = await r.buildDays.get(id);
  if (!b) return;
  await r.buildDays.delete(id);
  await deleteMemberFiles(buildDayFileIds(b), r);
}

export async function storeMaterial(blob: Blob, name: string, brandId: BrandId, title?: string, repos?: MembershipRepositories): Promise<BuildMaterial> {
  const f = await storeMemberFile(blob, name, brandId, repos ?? getMembershipRepos());
  return { id: uid("bm"), title: title?.trim() || name.replace(/\.[^.]+$/, ""), description: "", fileId: f.id, fileName: f.name, size: f.size, mime: f.mime };
}

export async function storeSessionFile(blob: Blob, name: string, brandId: BrandId, repos?: MembershipRepositories): Promise<SessionResource> {
  const f = await storeMemberFile(blob, name, brandId, repos ?? getMembershipRepos());
  return { id: uid("sr"), title: name.replace(/\.[^.]+$/, ""), kind: "file", fileId: f.id, fileName: f.name, size: f.size, url: "" };
}

/**
 * Plan next month from this one: same agenda, checklist and actions (new ids), materials and
 * session files copied, date moved to the same weekday pattern next month, links cleared.
 */
export async function duplicateBuildDay(id: string, month?: string, repos?: MembershipRepositories): Promise<BuildDay | null> {
  const r = repos ?? getMembershipRepos();
  const src = await r.buildDays.get(id);
  if (!src) return null;
  const target = month && isMonth(month) ? month : monthOf(new Date(`${src.month}-01T00:00:00`), 1);
  const copyFile = async (fileId: string | null, name: string) => {
    if (!fileId) return null;
    const stored = await r.files.get(fileId);
    return stored ? storeMemberFile(stored.blob, name, src.brandId, r) : null;
  };
  const start = new Date(src.startsAt);
  const nextStart = new Date(defaultStart(target));
  nextStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
  const now = nowIso();
  const materials: BuildMaterial[] = [];
  for (const m of src.materials) {
    const f = await copyFile(m.fileId, m.fileName);
    if (f) materials.push({ ...m, id: uid("bm"), fileId: f.id });
  }
  const agenda: BuildSession[] = [];
  for (const s of src.agenda) {
    const resources: SessionResource[] = [];
    for (const res of s.resources) {
      if (res.kind === "file") {
        const f = await copyFile(res.fileId, res.fileName ?? "file");
        if (f) resources.push({ ...res, id: uid("sr"), fileId: f.id });
      } else resources.push({ ...res, id: uid("sr") });
    }
    agenda.push({ ...deepClone(s), id: uid("ses"), resources });
  }
  const cover = await copyFile(src.coverFileId, "cover.svg");
  const b: BuildDay = {
    ...deepClone(src),
    id: uid("bd"),
    // A default "<Month> Build Day" title moves with the month; a named Build Day keeps its name to edit.
    title: src.title === `${monthLabel(src.month)} Build Day` ? `${monthLabel(target)} Build Day` : src.title,
    month: target,
    startsAt: nextStart.toISOString(),
    joinUrl: "",
    replayUrl: "",
    status: "draft",
    publishAt: null,
    isSample: false,
    coverFileId: cover?.id ?? null,
    agenda,
    materials,
    checklist: src.checklist.map((c) => ({ ...c, id: uid("bc") })),
    actions: src.actions.map((a) => ({ ...a, id: uid("ba") })),
    createdAt: now,
    updatedAt: now,
  };
  await r.buildDays.put(b);
  return b;
}

/* ---------------------------------------- Exports ---------------------------------------- */

export function buildDayIcs(b: BuildDay, now: Date = new Date()): string {
  const sessions = schedule(b);
  const agenda = sessions.map((s) => `${timeIn(s.start, b.timezone)} ${s.title}`).join("\n");
  const where = b.format === "in-person" ? b.location : b.joinUrl;
  return buildIcs(b.title, {
    timed: [
      {
        uid: b.id,
        start: new Date(b.startsAt),
        end: endsAt(b),
        summary: `${b.title}${b.theme ? ` — ${b.theme}` : ""}`,
        description: `${BUILD_FORMAT_LABELS[b.format]}${b.host ? ` with ${b.host}` : ""}\n\nAgenda:\n${agenda}${b.joinUrl ? `\n\nJoin: ${b.joinUrl}` : ""}`,
        location: where || undefined,
        url: b.joinUrl || undefined,
      },
    ],
  }, now);
}

/** Host's run sheet: times, presenters, outcomes, resources and prompts. */
export function runSheetMarkdown(b: BuildDay): string {
  const L = [`# ${b.title}`, "", b.theme ? `**${b.theme}**` : "", "", `${new Date(b.startsAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short", timeZone: b.timezone })} (${b.timezone}) · ${BUILD_FORMAT_LABELS[b.format]}${b.host ? ` · Host: ${b.host}` : ""}`, ""];
  if (b.joinUrl) L.push(`Join link: ${b.joinUrl}`, "");
  if (b.location) L.push(`Location: ${b.location}`, "");
  if (b.outcome) L.push("## Outcome", "", b.outcome, "");
  L.push("## Agenda", "");
  for (const s of schedule(b)) {
    L.push(`### ${timeIn(s.start, b.timezone)}–${timeIn(s.end, b.timezone)} · ${s.title} (${s.durationMin} min)`, "", `*${SESSION_KIND_LABELS[s.kind]}${s.presenter ? ` · ${s.presenter}` : ""}*`, "");
    if (s.description) L.push(s.description, "");
    if (s.outcome) L.push(`**Outcome:** ${s.outcome}`, "");
    if (s.resources.length) L.push("Resources:", ...s.resources.map((r) => `- ${r.title}${r.kind === "link" ? ` — ${r.url}` : r.fileName ? ` (${r.fileName})` : ""}`), "");
    if (s.prompts.length) L.push("Prompts:", ...s.prompts.map((p) => `- ${p}`), "");
  }
  L.push("## Implementation checklist", "");
  for (const ph of BUILD_PHASES) {
    const items = b.checklist.filter((c) => c.phase === ph);
    if (items.length) L.push(`### ${BUILD_PHASE_LABELS[ph]}`, "", ...items.map((c) => `- [ ] ${c.text}`), "");
  }
  if (b.actions.length) L.push("## Action items", "", ...b.actions.map((a) => `- [ ] ${a.title} (by ${actionDue(b, a)})${a.detail ? ` — ${a.detail}` : ""}`), "");
  if (b.materials.length) L.push("## Materials", "", ...b.materials.map((m) => `- ${m.title} (${m.fileName})`), "");
  return L.filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");
}

/** Everything a member downloads for the day: materials, session files, agenda and checklist. */
export async function buildDayPack(b: BuildDay, repos?: MembershipRepositories): Promise<{ blob: Blob; fileName: string; files: number }> {
  const r = repos ?? getMembershipRepos();
  const zip = new JSZip();
  const root = zip.folder(slugify(b.title, "build-day"))!;
  root.file("agenda-and-checklist.md", runSheetMarkdown(b));
  root.file("build-day.ics", buildDayIcs(b));
  let files = 0;
  const materials = root.folder("materials")!;
  for (const m of b.materials) {
    const f = await r.files.get(m.fileId);
    if (f) {
      materials.file(m.fileName, f.blob);
      files++;
    }
  }
  for (const s of b.agenda) {
    const fileRes = s.resources.filter((x) => x.kind === "file" && x.fileId);
    if (!fileRes.length) continue;
    const folder = root.folder(`sessions/${slugify(s.title, "session")}`)!;
    for (const res of fileRes) {
      const f = await r.files.get(res.fileId!);
      if (f) {
        folder.file(res.fileName ?? "file", f.blob);
        files++;
      }
    }
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { blob, fileName: `${slugify(b.title, "build-day")}-pack.zip`, files };
}

/** Local date of the Build Day ("YYYY-MM-DD"), for calendars and lists. */
export function buildDayDate(b: Pick<BuildDay, "startsAt">): string {
  const d = new Date(b.startsAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export { dayOfMonth };
