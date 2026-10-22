import { B } from "@/lib/doc/build";
import { nowIso, slugify, uid } from "@/lib/utils";
import { getMembershipRepos, type MembershipRepositories } from "@/lib/membership/db";
import { getBrand } from "@/lib/membership/brands";
import { coverSvg, svgBlob, bannerSvg } from "@/lib/membership/covers";
import { storeMemberFile } from "@/lib/membership/files";
import { CHAMPION_SAMPLE } from "@/lib/membership/sample-content";
import type { BrandId, MemberAccount } from "@/lib/membership/types";
import type { DocRenderer } from "@/lib/membership/seed";
import { buildCalendar, deleteCampaign, newCampaign, saveCampaign, storeCampaignFile, templateCampaignCopy, type CampaignContext } from "./campaigns";
import { deleteBuildDay, newBuildDay, newSession, saveBuildDay, storeMaterial, storeSessionFile } from "./build-days";
import { formatDay, monthOf, todayDay } from "./dates";
import { defaultProfile, nextMonday } from "./profit-path";
import { saveProfile } from "./store";
import { SAMPLE_BUILD_DAYS, SAMPLE_CAMPAIGNS, SAMPLE_MEMBERS } from "./sample-content";
import type { BuildDay, CampaignBonus, CampaignFile, SessionResource } from "./types";

/**
 * Seeds PLR Profit Lab's sample campaigns, Build Days and two sample member profiles (with their
 * own Profit Path answers) the first time the Profit Lab opens. Called from the membership seeder.
 */

export interface LabSeedSummary {
  campaigns: number;
  buildDays: number;
  members: number;
  files: number;
}

export const LAB_SAMPLE_STEPS = SAMPLE_CAMPAIGNS.length + SAMPLE_BUILD_DAYS.length + 1;

const chapterDoc = (c: { paras: string[]; points?: string[]; steps?: string[] }) =>
  B.doc(
    c.paras.map((p) => B.p(p)),
    c.points?.length ? [B.h(2, "Key points"), B.ul(c.points)] : null,
    c.steps?.length ? [B.h(2, "Action steps"), B.ol(c.steps)] : null,
  );

/** Next Saturday at least four days away, 10:00 local. */
export function upcomingBuildDayStart(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4, 10, 0, 0, 0);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return d;
}

/** Second Saturday of last month, 10:00 local. */
export function pastBuildDayStart(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1, 10, 0, 0, 0);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7);
  return d;
}

export async function seedLabSamples(brandId: BrandId, opts: { repos?: MembershipRepositories; now?: Date; render: DocRenderer; onStep?: (label: string) => void }): Promise<LabSeedSummary> {
  const r = opts.repos ?? getMembershipRepos();
  const now = opts.now ?? new Date();
  const brand = getBrand(brandId);
  const summary: LabSeedSummary = { campaigns: 0, buildDays: 0, members: 0, files: 0 };
  const file = async (blob: Blob, name: string): Promise<CampaignFile> => {
    summary.files++;
    return storeCampaignFile(blob, name, brandId, r);
  };

  /* Campaigns */
  for (const def of SAMPLE_CAMPAIGNS) {
    const product = CHAMPION_SAMPLE.products.find((p) => p.key === def.productKey);
    if (!product) continue;
    const month = monthOf(now, def.monthOffset);
    const chapters = product.chapters.map((c) => ({ title: c.title, content: chapterDoc(c) }));
    const accent = def.palette[0];
    const featuredFiles = [
      await file(await opts.render({ title: product.title, subtitle: product.subtitle, author: "[Author Name]", chapters }, "docx", accent), `${slugify(product.title)}.docx`),
      await file(await opts.render({ title: product.title, subtitle: product.subtitle, author: "[Author Name]", chapters }, "pdf", accent), `${slugify(product.title)}.pdf`),
    ];
    const leadFile = await file(await opts.render({ title: def.leadMagnet.title, subtitle: def.leadMagnet.description, chapters: [{ title: def.leadMagnet.title, content: B.doc(B.tasks(def.leadMagnet.outline)) }] }, "pdf", accent), `${slugify(def.leadMagnet.title)}.pdf`);
    const bonuses: CampaignBonus[] = [];
    for (const b of def.bonuses) {
      const content =
        b.kind === "workbook"
          ? product.chapters.map((c) => ({ title: c.title, content: B.doc(B.p(`Use these prompts after reading “${c.title.replace(/^[^:]+:\s*/, "")}”.`), (c.steps ?? []).flatMap((s) => [B.h(3, s), B.lines(2)])) }))
          : [{ title: b.title, content: B.doc(B.tasks(product.chapters.flatMap((c) => c.steps ?? []).slice(0, 14))) }];
      const f = await file(await opts.render({ title: b.title, subtitle: product.title, chapters: content }, b.kind === "workbook" ? "docx" : "pdf", accent), `${slugify(b.title)}.${b.kind === "workbook" ? "docx" : "pdf"}`);
      bonuses.push({ id: uid("cb"), title: b.title, description: b.description, files: [f] });
    }
    const ctx: CampaignContext = {
      productName: product.title,
      subtitle: product.subtitle,
      audience: def.audience,
      outcome: def.outcome,
      format: product.format === "course" ? "mini-course" : product.format,
      niche: product.tags[0] ?? "",
      contents: product.chapters.map((c) => c.title),
      bonuses: def.bonuses.map((b) => b.title),
      leadMagnet: def.leadMagnet.title,
      price: def.price,
      currency: "USD",
      fromName: "",
      sources: chapters,
    };
    const copy = templateCampaignCopy(ctx);
    const cover = await storeMemberFile(svgBlob(coverSvg({ title: def.theme, subtitle: product.title, kicker: "Profit Campaign Drop", brandName: brand.name, palette: def.palette, motif: def.motif })), `${slugify(def.theme)}.svg`, brandId, r);
    summary.files++;
    const publishAt = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toISOString();
    const future = new Date(publishAt) > now;
    const c = newCampaign(brandId, month, {
      title: `${def.theme}`,
      theme: def.theme,
      summary: def.summary,
      launchDay: def.launchDay,
      access: def.access,
      status: future ? "scheduled" : "published",
      publishAt,
      coverFileId: cover.id,
      featured: {
        title: product.title,
        subtitle: product.subtitle,
        description: product.description.replace(/\*\*Perfect for:\*\*.*$/m, "").trim(),
        format: ctx.format,
        contents: ctx.contents,
        files: featuredFiles,
        licenceNotes: "Private Label Rights: edit, rebrand and sell the finished product, use it as a bonus or lead magnet, and break it into articles, emails and posts. You may not sell or give away the PLR rights themselves.",
        source: { kind: "manual", projectId: null, projectName: null, importedAt: null },
      },
      ...copy,
      positioning: { ...copy.positioning, audience: def.audience, problem: def.problem, promise: def.promise, angle: def.angle },
      leadMagnet: { ...def.leadMagnet, files: [leadFile] },
      bonuses,
      isSample: true,
    });
    await saveCampaign({ ...c, calendar: buildCalendar(c) }, r);
    summary.campaigns++;
    opts.onStep?.(`Campaign: ${def.theme}`);
  }

  /* Build Days */
  for (const def of SAMPLE_BUILD_DAYS) {
    const start = def.when === "upcoming" ? upcomingBuildDayStart(now) : pastBuildDayStart(now);
    const month = monthOf(start);
    const accent = def.palette[0];
    const workbook = await storeMaterial(
      await opts.render({ title: def.workbook.title, subtitle: def.theme, chapters: def.workbook.chapters.map((c) => ({ title: c.title, content: B.doc(B.tasks(c.steps), B.h(3, "Notes"), B.lines(4)) })) }, "docx", accent),
      `${slugify(def.workbook.title)}.docx`,
      brandId,
      def.workbook.title,
      r,
    );
    summary.files++;
    const agenda = [];
    for (const s of def.sessions) {
      const resources: SessionResource[] = [];
      if (s.resource && "content" in s.resource) {
        resources.push(await storeSessionFile(new Blob([s.resource.content], { type: "text/markdown" }), s.resource.name, brandId, r));
        summary.files++;
      } else if (s.resource) resources.push({ id: uid("sr"), title: s.resource.title, kind: "link", fileId: null, fileName: null, size: null, url: s.resource.url });
      agenda.push(newSession(s.kind, { title: s.title, durationMin: s.durationMin, description: s.description, outcome: s.outcome ?? "", prompts: s.prompts ?? [], presenter: s.kind === "break" ? "" : def.host, resources }));
    }
    const cover = await storeMemberFile(svgBlob(bannerSvg({ title: def.title, subtitle: def.theme, kicker: "Build Day", brandName: brand.name, palette: def.palette, motif: def.motif })), `${slugify(def.title)}-banner.svg`, brandId, r);
    summary.files++;
    const b: BuildDay = newBuildDay(brandId, month, {
      title: def.title,
      theme: def.theme,
      outcome: def.outcome,
      startsAt: start.toISOString(),
      host: def.host,
      access: def.access,
      status: "published",
      publishAt: new Date(start.getTime() - 21 * 86_400_000).toISOString(),
      coverFileId: cover.id,
      agenda,
      materials: [workbook],
      checklist: def.checklist.map((c) => ({ id: uid("bc"), phase: c.phase, text: c.text })),
      actions: def.actions.map((a) => ({ id: uid("ba"), title: a.title, detail: "", dueDays: a.dueDays })),
      community: { enabled: true, prompt: "Share your win from today's Build Day." },
      isSample: true,
    });
    await saveBuildDay(b, r);
    summary.buildDays++;
    opts.onStep?.(`Build Day: ${def.title}`);
  }

  /* Sample members with their own Profit Path answers */
  const accounts = await r.accounts.list();
  for (const def of SAMPLE_MEMBERS) {
    if (accounts.some((a) => a.email.toLowerCase() === def.email)) continue;
    const stamp = nowIso();
    const account: MemberAccount = {
      id: uid("acct"),
      email: def.email,
      displayName: def.displayName,
      role: "member",
      brandAccess: { "plr-profit-lab": def.labTier, ...(def.championTier ? { "plr-champion": def.championTier } : {}) },
      linkedAccountIds: [],
      bundleIds: [],
      source: "test",
      note: def.note,
      isSample: true,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await r.accounts.put(account);
    // Their plans started last Monday, so the Today view has something to show.
    const start = nextMonday(formatDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)));
    await saveProfile(defaultProfile(brandId, account.id, now, { ...def.profile, startDate: start <= todayDay(now) ? start : todayDay(now), currency: "USD", conversionPct: 2, isSample: true }), r);
    summary.members++;
  }
  opts.onStep?.("Sample members");
  return summary;
}

/** Removes Profit Lab sample campaigns, Build Days and sample members (with their files and progress). */
export async function removeLabSamples(brandId: BrandId, repos?: MembershipRepositories): Promise<number> {
  const r = repos ?? getMembershipRepos();
  let n = 0;
  for (const c of (await r.campaigns.list(brandId)).filter((x) => x.isSample)) {
    await deleteCampaign(c.id, r);
    n++;
  }
  for (const b of (await r.buildDays.list(brandId)).filter((x) => x.isSample)) {
    await deleteBuildDay(b.id, r);
    n++;
  }
  for (const p of (await r.labProfiles.list(brandId)).filter((x) => x.isSample)) await r.labProfiles.delete(p.id);
  for (const a of (await r.accounts.list()).filter((x) => x.isSample && x.role !== "owner")) {
    for (const row of await r.labProgress.listForMember(brandId, a.id)) await r.labProgress.delete(row.id);
    await r.accounts.delete(a.id);
    n++;
  }
  return n;
}
