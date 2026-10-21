// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createDexieRepositories, PLRDatabase } from "@/lib/data/dexie";
import { setRepos, type Repositories } from "@/lib/data";
import { createProject } from "@/lib/services/projects";
import { createAsset } from "@/lib/services/assets";
import { B } from "@/lib/doc/build";
import type { DocumentData } from "@/lib/models/document";
import { createMembershipRepositories, MembershipDatabase, setMembershipRepos, type MembershipRepositories } from "@/lib/membership/db";
import { ensureSampleLibrary, removeSampleContent, type DocRenderer } from "@/lib/membership/seed";
import { createMembershipBackup, parseMembershipBackup, restoreMembershipBackup } from "@/lib/membership/backup";
import { effectiveTier, getBundle } from "@/lib/membership/entitlements";
import type { MemberAccount } from "@/lib/membership/types";
import {
  buildCalendar,
  calendarIcs,
  campaignFromProject,
  campaignKit,
  campaignLaunchDate,
  campaignMarkdown,
  campaignSections,
  campaignToProject,
  deleteCampaign,
  duplicateCampaign,
  entryDate,
  newCampaign,
  regenerateSection,
  saveCampaign,
  storeCampaignFile,
  validateCampaign,
  type CampaignDocRenderer,
} from "@/lib/lab/campaigns";
import { actionDue, buildDayIcs, buildDayPack, buildDayStats, countdown, defaultStart, deleteBuildDay, duplicateBuildDay, endsAt, newBuildDay, phaseOf, runSheetMarkdown, saveBuildDay, schedule, storeMaterial, validateBuildDay } from "@/lib/lab/build-days";
import { campaignHandoffs, getConnector } from "@/lib/integrations/byldity";
import { generatePlan } from "@/lib/lab/profit-path";
import { getProfile } from "@/lib/lab/store";
import { pastBuildDayStart, upcomingBuildDayStart } from "@/lib/lab/seed";

let repos: MembershipRepositories;
let studio: Repositories;
let n = 0;

const fakeRender: DocRenderer = async (doc, format) => new Blob([`${format.toUpperCase()}:${doc.title}\n${doc.chapters.map((c) => c.title).join("\n")}`], { type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
const fakeDocx: CampaignDocRenderer = async (doc) => new Blob([`DOCX:${doc.title}\n${doc.chapters.map((c) => c.title).join("\n")}`]);

beforeEach(async () => {
  const db = new MembershipDatabase(`lab-c-${Date.now()}-${n}`);
  await db.open();
  repos = createMembershipRepositories(db);
  setMembershipRepos(repos, db);
  const sdb = new PLRDatabase(`lab-s-${Date.now()}-${n++}`);
  await sdb.open();
  studio = createDexieRepositories(sdb);
  setRepos(studio, sdb);
});

const M = "2026-11";

describe("campaign drops", () => {
  it("starts from a complete template with all ten sections", () => {
    const c = newCampaign("plr-profit-lab", M);
    expect(c.title).toMatch(/November 2026/);
    expect(c.salesPage.sections.length).toBeGreaterThanOrEqual(10);
    expect(c.emails.length).toBeGreaterThan(3);
    expect(c.social).toHaveLength(8);
    expect(c.checklist.length).toBeGreaterThan(10);
    expect(c.calendar.some((e) => e.channel === "launch" && e.day === 0)).toBe(true);
    expect(campaignSections(c).map((s) => s.key)).toEqual(["featured", "rebrand", "positioning", "sales", "emails", "social", "leadMagnet", "bonuses", "checklist", "calendar"]);
    // No product chosen yet, no bonuses.
    const byKey = Object.fromEntries(campaignSections(c).map((s) => [s.key, s.filled]));
    expect(byKey.featured).toBe(false);
    expect(byKey.bonuses).toBe(false);
    expect(byKey.emails).toBe(true);
  });

  it("validates before saving", async () => {
    expect(validateCampaign({ ...newCampaign("plr-profit-lab", M), title: " " })).toMatch(/title/);
    expect(validateCampaign({ ...newCampaign("plr-profit-lab", M), launchDay: 31 })).toMatch(/28th/);
    expect(validateCampaign({ ...newCampaign("plr-profit-lab", M), status: "scheduled", publishAt: null })).toMatch(/released/);
    await expect(saveCampaign({ ...newCampaign("plr-profit-lab", M), month: "2026-13" })).rejects.toThrow(/month/);
  });

  it("turns launch-relative days into dates and keeps manual calendar entries on rebuild", () => {
    const c = { ...newCampaign("plr-profit-lab", M), launchDay: 10 };
    expect(campaignLaunchDate(c)).toBe("2026-11-10");
    expect(entryDate(c, -3)).toBe("2026-11-07");
    const manual = { id: "m1", day: 2, channel: "content" as const, title: "Podcast interview", detail: "", refId: null, source: "manual" as const };
    const rebuilt = buildCalendar({ ...c, calendar: [...c.calendar, manual], emails: c.emails.slice(0, 1) });
    expect(rebuilt.filter((e) => e.channel === "email")).toHaveLength(1);
    expect(rebuilt.find((e) => e.id === "m1")).toBeDefined();
    expect(rebuilt.map((e) => e.day)).toEqual([...rebuilt.map((e) => e.day)].sort((a, b) => a - b));
  });

  it("regenerates a section from the featured product", () => {
    const c = { ...newCampaign("plr-profit-lab", M), featured: { ...newCampaign("plr-profit-lab", M).featured, title: "Sleep Reset", contents: ["Chapter 1: Your Sleep Window"] } };
    const next = regenerateSection(c, "sales");
    expect(JSON.stringify(next.salesPage)).toContain("Sleep Reset");
    expect(regenerateSection(c, "emails").emails[0].body).toContain("Sleep Reset");
  });

  it("is built from a studio project: product file, rules, copy and launch plan", async () => {
    const p = await createProject({ name: "Calm Mornings", audience: "busy parents", niche: "parenting", productType: "ebook", plannedPrice: 19 }, studio);
    const chapters = [
      { id: "c1", title: "Chapter 1: Wake Earlier", content: B.doc(B.p("Getting up ten minutes earlier changes the whole morning."), B.ul(["Set one alarm", "Lay out clothes the night before"])), notes: "", approved: false, sourceChapterId: null },
      { id: "c2", title: "Chapter 2: Breakfast Plan", content: B.doc(B.p("Plan three breakfasts you can make in five minutes.")), notes: "", approved: false, sourceChapterId: null },
    ];
    const main = await createAsset(p.id, "document", { title: "Calm Mornings", data: { role: "main", subtitle: "A simple plan to have calmer family mornings", chapters, rules: [{ id: "r1", find: "John Smith", replace: "Jane Doe", caseSensitive: false, wholeWord: true, enabled: true }] } as Partial<DocumentData> }, studio);
    await studio.projects.put({ ...p, mainDocumentId: main.id });
    await createAsset(p.id, "document", { title: "Morning Checklist", data: { role: "lead-magnet", chapters: [chapters[0]] } as Partial<DocumentData> }, studio);
    await createAsset(p.id, "document", { title: "Breakfast Planner", data: { role: "bonus", description: "Plan your week of breakfasts.", chapters: [chapters[1]] } as Partial<DocumentData> }, studio);
    await createAsset(p.id, "email-campaign", { data: { sequenceType: "launch", emails: [{ id: "e1", day: 0, subject: "It's here", altSubjects: [], preview: "", body: "Hi", ctaText: "", ctaUrl: "", notes: "" }] } }, studio);
    await createAsset(p.id, "launch-plan", { data: { tasks: [{ id: "t1", title: "Record a launch video", category: "marketing", priority: "high", status: "todo", offsetDays: -2, dueDate: null, notes: "", milestoneId: null }] } }, studio);

    const c = await campaignFromProject(p.id, { brandId: "plr-profit-lab", month: M, render: fakeDocx, studio, repos });
    expect(c.featured).toMatchObject({ title: "Calm Mornings", subtitle: "A simple plan to have calmer family mornings", contents: ["Chapter 1: Wake Earlier", "Chapter 2: Breakfast Plan"] });
    expect(c.featured.source).toMatchObject({ kind: "project", projectId: p.id });
    expect(c.featured.files).toHaveLength(1);
    expect(await (await repos.files.get(c.featured.files[0].fileId))!.blob.text()).toContain("DOCX:Calm Mornings");
    expect(c.rebrand.rules).toEqual([expect.objectContaining({ find: "John Smith", replace: "Jane Doe" })]);
    expect(c.emails).toHaveLength(1);
    expect(c.emails[0].subject).toBe("It's here");
    expect(c.leadMagnet).toMatchObject({ title: "Morning Checklist" });
    expect(c.leadMagnet.files).toHaveLength(1);
    expect(c.bonuses.map((b) => b.title)).toEqual(["Breakfast Planner"]);
    expect(c.checklist).toEqual([expect.objectContaining({ text: "Record a launch video", phase: "pre-launch", day: -2 })]);
    expect(c.positioning).toMatchObject({ audience: "busy parents", pricePoint: 19 });
    expect(c.salesPage.sections.find((s) => s.type === "introduction")!.heading).toContain("Calm Mornings");
    expect(c.social.length).toBeGreaterThan(0);
    expect(c.calendar.some((e) => e.title === "It's here")).toBe(true);
    expect(c.coverFileId).toBeTruthy();
    expect(await repos.campaigns.get(c.id)).toBeDefined();
  });

  it("refuses projects without a document", async () => {
    const p = await createProject({ name: "Empty" }, studio);
    await expect(campaignFromProject(p.id, { brandId: "plr-profit-lab", month: M, render: fakeDocx, studio, repos })).rejects.toThrow(/no document/);
  });

  it("starts a studio project from a campaign", async () => {
    const c = await saveCampaign(newCampaign("plr-profit-lab", M, { featured: { ...newCampaign("plr-profit-lab", M).featured, title: "Sleep Reset" } }), repos);
    const res = await campaignToProject(c, { studio, repos });
    const project = await studio.projects.get(res.projectId);
    expect(project!.name).toBe("Sleep Reset");
    const assets = await studio.assets.listByProject(res.projectId);
    expect(assets.map((a) => a.type).sort()).toEqual(["email-campaign", "launch-plan", "sales-page", "social-campaign"]);
    const plan = assets.find((a) => a.type === "launch-plan")!.data as { launchDate: string; tasks: { offsetDays: number }[] };
    expect(plan.launchDate).toBe(campaignLaunchDate(c));
    expect(plan.tasks).toHaveLength(c.checklist.length);
    const social = assets.find((a) => a.type === "social-campaign")!.data as { posts: { scheduledFor: string }[] };
    expect(social.posts[0].scheduledFor).toBe(entryDate(c, c.social[0].day));
    expect(res.importedDocument).toBe(false);
  });

  it("downloads as a kit, duplicates with copied files and deletes its files", async () => {
    const file = await storeCampaignFile(new Blob(["PRODUCT"]), "sleep-reset.docx", "plr-profit-lab", repos);
    const c = await saveCampaign(newCampaign("plr-profit-lab", M, { title: "Sleep Reset Launch", featured: { ...newCampaign("plr-profit-lab", M).featured, title: "Sleep Reset", files: [file] }, bonuses: [{ id: "b", title: "Tracker", description: "", files: [] }] }), repos);
    const kit = await campaignKit(c, repos);
    expect(kit.fileName).toBe("sleep-reset-launch-campaign-kit.zip");
    const zip = await JSZip.loadAsync(await kit.blob.arrayBuffer());
    const names = Object.keys(zip.files);
    for (const part of ["README.md", "01-featured-product/sleep-reset.docx", "04-sales-page/sales-page.html", "05-emails/launch-emails.csv", "06-social/posts.csv", "09-launch-checklist.md", "10-promotional-calendar/calendar.ics"]) expect(names.some((x) => x.endsWith(part)), part).toBe(true);
    expect(campaignMarkdown(c)).toContain("## 10. Promotional calendar");
    expect(calendarIcs(c)).toContain("BEGIN:VEVENT");

    const copy = (await duplicateCampaign(c.id, "2026-12", repos))!;
    expect(copy.month).toBe("2026-12");
    expect(copy.status).toBe("draft");
    expect(copy.featured.files[0].fileId).not.toBe(file.fileId);
    await deleteCampaign(c.id, repos);
    expect(await repos.files.get(file.fileId)).toBeUndefined();
    expect(await repos.files.get(copy.featured.files[0].fileId)).toBeDefined();
  });

  it("prepares BYLDITY handoffs without connecting anything", async () => {
    const c = newCampaign("plr-profit-lab", M, { launchDay: 12 });
    const h = campaignHandoffs(c);
    expect(h.map((x) => x.app)).toEqual(["byldsend", "byldpages", "byld-countdown", "byldflow"]);
    const seq = h[0].payload;
    expect(seq.kind === "email-sequence" && seq.emails[0].sendOn <= "2026-11-12").toBe(true);
    expect(h[2].payload).toMatchObject({ kind: "countdown", endsOn: "2026-11-12" });
    const res = await getConnector("byldsend").push(seq);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/isn't connected/);
  });
});

describe("build days", () => {
  it("schedules sessions back to back from the start time", () => {
    const b = newBuildDay("plr-profit-lab", M, { startsAt: new Date(2026, 10, 14, 10, 0).toISOString() });
    const s = schedule(b);
    expect(s[0].start.getHours()).toBe(10);
    for (let i = 1; i < s.length; i++) expect(s[i].start.getTime()).toBe(s[i - 1].end.getTime());
    expect(endsAt(b).getTime()).toBe(s[s.length - 1].end.getTime());
    expect(phaseOf(b, new Date(2026, 10, 14, 9))).toBe("upcoming");
    expect(phaseOf(b, new Date(2026, 10, 14, 11))).toBe("live");
    expect(phaseOf(b, new Date(2026, 10, 15))).toBe("past");
    expect(countdown(b, new Date(2026, 10, 12, 8, 0))).toBe("2 days 2 hours");
    expect(countdown(b, new Date(2026, 10, 14, 9, 30))).toBe("30 min");
    expect(countdown(b, new Date(2026, 10, 14, 11))).toBeNull();
    expect(actionDue(b, { dueDays: 3 })).toBe("2026-11-17");
  });

  it("defaults to the second Saturday at 10am", () => {
    const d = new Date(defaultStart("2026-11"));
    expect(d.getDay()).toBe(6);
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(10);
  });

  it("validates and cleans links before saving", async () => {
    const b = newBuildDay("plr-profit-lab", M);
    expect(validateBuildDay({ ...b, agenda: [{ ...b.agenda[0], durationMin: 0 }] })).toMatch(/between 1 and 600/);
    expect(validateBuildDay({ ...b, capacity: 2.5 })).toMatch(/whole number/);
    const saved = await saveBuildDay({ ...b, joinUrl: "javascript:alert(1)", replayUrl: "https://example.com/replay" }, repos);
    expect(saved.joinUrl).toBe("");
    expect(saved.replayUrl).toBe("https://example.com/replay");
  });

  it("tracks sessions, checklist and actions including the member's own", () => {
    const b = newBuildDay("plr-profit-lab", M);
    const nonBreak = b.agenda.filter((s) => s.kind !== "break");
    const done = { [`session:${nonBreak[0].id}`]: "x", [`check:${b.checklist[0].id}`]: "x", [`action:${b.actions[0].id}`]: "x" };
    const s = buildDayStats(b, { done, ownActions: [{ id: "o", title: "Mine", done: true }] });
    expect(s.sessions).toEqual({ done: 1, total: nonBreak.length });
    expect(s.actions).toEqual({ done: 2, total: b.actions.length + 1 });
    expect(s.total).toBe(nonBreak.length + b.checklist.length + b.actions.length + 1);
    expect(s.percent).toBe(Math.round((4 / s.total) * 100));
  });

  it("plans next month from this one with copied files and cleared links", async () => {
    const mat = await storeMaterial(new Blob(["WB"]), "workbook.docx", "plr-profit-lab", "Workbook", repos);
    const b = await saveBuildDay(newBuildDay("plr-profit-lab", M, { joinUrl: "https://meet.example.com/x", materials: [mat], startsAt: new Date(2026, 10, 14, 9, 30).toISOString(), status: "published" }), repos);
    const next = (await duplicateBuildDay(b.id, undefined, repos))!;
    expect(next.month).toBe("2026-12");
    expect(next.status).toBe("draft");
    expect(next.joinUrl).toBe("");
    expect(new Date(next.startsAt).getHours()).toBe(9);
    expect(new Date(next.startsAt).getMinutes()).toBe(30);
    expect(next.materials[0].fileId).not.toBe(mat.fileId);
    expect(next.agenda.map((s) => s.title)).toEqual(b.agenda.map((s) => s.title));
    const pack = await buildDayPack(b, repos);
    const zip = await JSZip.loadAsync(await pack.blob.arrayBuffer());
    expect(Object.keys(zip.files).some((f) => f.endsWith("materials/workbook.docx"))).toBe(true);
    expect(runSheetMarkdown(b)).toContain("## Agenda");
    const ics = buildDayIcs(b, new Date("2026-11-01T00:00:00Z"));
    expect(ics).toContain("URL:https://meet.example.com/x");
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    await deleteBuildDay(b.id, repos);
    expect(await repos.files.get(mat.fileId)).toBeUndefined();
  });
});

describe("Profit Lab samples, backups and access", () => {
  it("seeds samples, removes them and restores a backup into the same brand only", async () => {
    const now = new Date();
    const s = await ensureSampleLibrary("plr-profit-lab", { render: fakeRender, now });
    expect(s).toMatchObject({ products: 0, categories: 0, courses: 2, resources: 5, campaigns: 3, buildDays: 2, members: 2 });
    const campaigns = await repos.campaigns.list("plr-profit-lab");
    expect(campaigns.map((c) => c.status).sort()).toEqual(["published", "published", "scheduled"]);
    expect(campaigns.every((c) => c.featured.files.length === 2 && c.leadMagnet.files.length === 1)).toBe(true);
    for (const c of campaigns) expect(campaignSections(c).every((x) => x.filled), c.title).toBe(true);
    const days = await repos.buildDays.list("plr-profit-lab");
    expect(days.map((d) => phaseOf(d, now)).sort()).toEqual(["past", "upcoming"]);
    const accounts = (await repos.accounts.list()).filter((a) => a.isSample);
    expect(accounts).toHaveLength(2);
    const jordan = accounts.find((a) => a.email.startsWith("jordan"))!;
    const profile = (await getProfile("plr-profit-lab", jordan.id))!;
    expect(profile.businessModel).toBe("lead-magnet-funnel");
    expect(generatePlan(profile).tasks.length).toBeGreaterThan(30);

    // Backup v2 carries the lab tables; another brand refuses it.
    const { blob, summary } = await createMembershipBackup("plr-profit-lab");
    expect(summary).toMatchObject({ campaigns: 3, buildDays: 2 });
    const parsed = await parseMembershipBackup(blob);
    expect(parsed.manifest.version).toBe(2);
    await expect(restoreMembershipBackup(parsed, "merge", "plr-champion")).rejects.toThrow(/plr-profit-lab backup/);

    expect(await removeSampleContent("plr-profit-lab")).toBeGreaterThanOrEqual(3 + 2 + 2 + 2 + 5);
    expect(await repos.campaigns.list("plr-profit-lab")).toEqual([]);
    expect(await repos.buildDays.list("plr-profit-lab")).toEqual([]);
    expect((await repos.accounts.list()).filter((a) => a.isSample)).toEqual([]);
    expect(await repos.labProfiles.list("plr-profit-lab")).toEqual([]);

    await restoreMembershipBackup(parsed, "replace", "plr-profit-lab");
    expect(await repos.campaigns.list("plr-profit-lab")).toHaveLength(3);
    expect(await repos.buildDays.list("plr-profit-lab")).toHaveLength(2);
    const restored = (await repos.campaigns.list("plr-profit-lab"))[0];
    expect(await repos.files.get(restored.featured.files[0].fileId)).toBeDefined();
  });

  it("places sample Build Days on Saturdays in the past and future", () => {
    const now = new Date(2026, 9, 17, 12);
    const up = upcomingBuildDayStart(now);
    const past = pastBuildDayStart(now);
    expect(up.getDay()).toBe(6);
    expect(up.getTime() - now.getTime()).toBeGreaterThan(3 * 86_400_000);
    expect(past.getDay()).toBe(6);
    expect(past.getMonth()).toBe(8);
  });

  it("grants Profit Lab through its own membership or the complete bundle", () => {
    const acct = (patch: Partial<MemberAccount>): MemberAccount => ({ id: "a", email: "a@x", displayName: "A", role: "member", brandAccess: {}, linkedAccountIds: [], source: "test", createdAt: "", updatedAt: "", ...patch });
    expect(effectiveTier(acct({ brandAccess: { "plr-champion": "premium" } }), "plr-profit-lab")).toBeNull();
    expect(effectiveTier(acct({ bundleIds: ["plr-ecosystem-bundle"] }), "plr-profit-lab")).toBeNull();
    expect(effectiveTier(acct({ bundleIds: ["plr-business-complete"] }), "plr-profit-lab")).toBe("premium");
    expect(getBundle("plr-business-complete")!.grants).toEqual({ "plr-champion": "premium", plrforim: "premium", "plr-profit-lab": "premium" });
  });
});
