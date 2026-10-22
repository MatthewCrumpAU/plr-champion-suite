import JSZip from "jszip";
import Papa from "papaparse";
import { getRepos, type Repositories } from "@/lib/data";
import type { Asset } from "@/lib/data/types";
import type { EmailItem, SalesPageData, SalesSection, SocialPost, SocialPostType } from "@/lib/models/marketing";
import { SOCIAL_PLATFORM_LABELS, type SalesSectionType } from "@/lib/models/marketing";
import type { LaunchTask, LaunchTaskCategory } from "@/lib/models/profit";
import { defaultSalesPageData } from "@/lib/models/defaults";
import { emptyDoc, type PMDoc } from "@/lib/doc/types";
import { docListItems } from "@/lib/doc/text";
import { campaignCsv as emailsCsvOf, campaignMarkdown as emailsMarkdownOf } from "@/lib/marketing/emails";
import { newSectionFromTemplate, outcomeFrom, salesPageDoc, salesPageHtml, type SalesContext } from "@/lib/marketing/sales";
import { templateEmails, type EmailContext } from "@/lib/marketing/emails";
import { hashtagsFor, postText, type SocialSource } from "@/lib/marketing/social";
import { docToMarkdown } from "@/lib/doc/markdown";
import { defaultMarketing, defaultReadiness } from "@/lib/profit/launch";
import { createProject } from "@/lib/services/projects";
import { createAsset } from "@/lib/services/assets";
import { deepClone, nowIso, slugify, uid } from "@/lib/utils";
import { getMembershipRepos, type MembershipRepositories } from "@/lib/membership/db";
import { deleteMemberFiles, storeMemberFile } from "@/lib/membership/files";
import { coverSvg, svgBlob } from "@/lib/membership/covers";
import { getBrand } from "@/lib/membership/brands";
import type { BrandId } from "@/lib/membership/types";
import { addDays, dayOfMonth, isMonth, monthLabel } from "./dates";
import { buildIcs } from "./ics";
import {
  CALENDAR_CHANNEL_LABELS,
  CAMPAIGN_PHASE_LABELS,
  CAMPAIGN_PHASES,
  type CalendarEntry,
  type CampaignBonus,
  type CampaignChecklistItem,
  type CampaignChecklistPhase,
  type CampaignDrop,
  type CampaignFile,
  type CampaignPost,
  type FeaturedProduct,
  type LeadMagnet,
  type Positioning,
  type RebrandInstructions,
  type RebrandRule,
} from "./types";

/**
 * Monthly Profit Campaign Drops: everything a member needs to launch one PLR product this month —
 * the product, rebrand instructions, positioning, sales copy, emails, posts, lead magnet, bonuses,
 * launch checklist and a day-by-day promotional calendar.
 *
 * Template copy follows the studio's rules: the member's own details plus [placeholders] for
 * anything only they know. No invented testimonials, results, income claims or fake scarcity.
 */

/* ------------------------------------------------------------------------------------------ */
/* Sections                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export const CAMPAIGN_SECTIONS = [
  { key: "featured", label: "Featured PLR product" },
  { key: "rebrand", label: "Rebranding instructions" },
  { key: "positioning", label: "Product positioning" },
  { key: "sales", label: "Sales-page copy" },
  { key: "emails", label: "Email marketing sequence" },
  { key: "social", label: "Social media content" },
  { key: "leadMagnet", label: "Lead magnet" },
  { key: "bonuses", label: "Bonus materials" },
  { key: "checklist", label: "Launch checklist" },
  { key: "calendar", label: "Promotional calendar" },
] as const;
export type CampaignSectionKey = (typeof CAMPAIGN_SECTIONS)[number]["key"];

export const CAMPAIGN_SALES_SECTIONS: SalesSectionType[] = ["headline", "subheadline", "problem", "introduction", "benefits", "included", "bonuses", "pricing", "faq", "guarantee", "cta"];

export interface CampaignContext {
  productName: string;
  subtitle: string;
  audience: string;
  outcome: string;
  format: string;
  niche: string;
  contents: string[];
  bonuses: string[];
  leadMagnet: string;
  price: number | null;
  currency: string;
  fromName: string;
  /** Chapter content for repurposed social posts. */
  sources: SocialSource[];
}

export function contextFromCampaign(c: CampaignDrop): CampaignContext {
  return {
    productName: c.featured.title,
    subtitle: c.featured.subtitle,
    audience: c.positioning.audience,
    outcome: outcomeFrom(c.positioning.promise || c.featured.subtitle),
    format: c.featured.format || "guide",
    niche: c.positioning.audience,
    contents: c.featured.contents,
    bonuses: c.bonuses.map((b) => b.title).filter(Boolean),
    leadMagnet: c.leadMagnet.title,
    price: c.positioning.pricePoint,
    currency: c.positioning.currency,
    fromName: "",
    sources: c.featured.contents.map((title) => ({ title, content: emptyDoc() })),
  };
}

export function emptyFeatured(): FeaturedProduct {
  return { title: "", subtitle: "", description: "", format: "ebook", contents: [], files: [], licenceNotes: "", source: { kind: "manual", projectId: null, projectName: null, importedAt: null } };
}

export const DEFAULT_REBRAND_STEPS = [
  "Download the featured product and open the DOCX in the PLR Editor — or use **Start this campaign in the studio**, which does it for you.",
  "Read the licence notes and only use the product in the ways they allow.",
  "Apply the find-and-replace rules below with the Rebrand Assistant (author, links and brand).",
  "Rewrite the introduction and conclusion in your own voice.",
  "Add at least one example, story or tip of your own to each chapter.",
  "Change the title and subtitle if another angle suits your audience better.",
  "Design your cover with your brand kit, then a 3D mockup for the sales page.",
  "Export the final DOCX and PDF and proofread them once more.",
]
  .map((s, i) => `${i + 1}. ${s}`)
  .join("\n");

export function defaultRebrandRules(): RebrandRule[] {
  return [
    { id: uid("rr"), find: "[Author Name]", replace: "Your name", note: "Every mention of the original author." },
    { id: uid("rr"), find: "[Website URL]", replace: "https://yourwebsite.com", note: "Links in the text and resource pages." },
    { id: uid("rr"), find: "[Support Email]", replace: "you@yourdomain.com", note: "Contact details." },
    { id: uid("rr"), find: "[Brand Name]", replace: "Your brand", note: "Headers, footers and the title page." },
  ];
}

export function defaultCampaignChecklist(): CampaignChecklistItem[] {
  const items: [CampaignChecklistPhase, string, number | null][] = [
    ["prepare", "Rebrand the featured product using the rules in this drop", -12],
    ["prepare", "Design the cover and a 3D mockup", -11],
    ["prepare", "Customise the sales-page copy and publish it as a draft", -10],
    ["prepare", "Set up checkout and automatic delivery", -9],
    ["prepare", "Build the lead magnet and its opt-in page", -8],
    ["prepare", "Load the email sequence into your email tool", -6],
    ["pre-launch", "Share the lead magnet to warm up your list", -5],
    ["pre-launch", "Schedule the social posts", -4],
    ["pre-launch", "Test purchase and delivery on your phone", -2],
    ["launch", "Publish the sales page and open checkout", 0],
    ["launch", "Send the launch email and post the announcement", 0],
    ["launch", "Reply to every question and comment", 0],
    ["post-launch", "Send the follow-up emails as scheduled", null],
    ["post-launch", "Record sales in the Profit Calculator", 3],
    ["post-launch", "Ask buyers for feedback", 7],
    ["post-launch", "Add real questions to the sales-page FAQ", 7],
  ];
  return items.map(([phase, text, day]) => ({ id: uid("cl"), phase, text, day }));
}

function salesContext(c: CampaignContext): SalesContext {
  return {
    productName: c.productName,
    audience: c.audience,
    outcome: c.outcome,
    format: c.format,
    included: c.contents.slice(0, 8),
    bonuses: c.bonuses,
    price: c.price ? `${c.currency} ${c.price}` : "",
  };
}

function emailContext(c: CampaignContext): EmailContext {
  return { productName: c.productName, audience: c.audience, outcome: c.outcome, fromName: c.fromName, topics: c.contents, price: c.price ? `${c.currency} ${c.price}` : "" };
}

/** Promotion days for template posts around launch day. */
export const POST_DAYS = [-7, -5, -3, -1, 0, 1, 3, 5];
const POST_TYPES: SocialPostType[] = ["educational", "engagement", "educational", "educational", "announcement", "promotional", "educational", "promotional"];

export function templateCampaignPosts(c: CampaignContext): CampaignPost[] {
  const platforms = ["facebook", "instagram", "linkedin", "video-script"] as const;
  const sources = c.sources.length ? c.sources : [{ title: c.productName || "Your product", content: emptyDoc() }];
  const context = { productName: c.productName, audience: c.audience, niche: c.niche, link: "[link]" };
  return POST_DAYS.map((day, i) => {
    const type = POST_TYPES[i];
    const platform = platforms[i % platforms.length];
    const src = sources[i % sources.length];
    return {
      id: uid("cp"),
      platform,
      type,
      day,
      text: postText(platform, type, src, context),
      hashtags: platform === "instagram" || platform === "linkedin" ? hashtagsFor(c.niche, src.title).slice(0, platform === "instagram" ? 6 : 3) : [],
    };
  });
}

export function templatePositioning(c: CampaignContext): Positioning {
  return {
    audience: c.audience,
    problem: c.outcome ? `They want to ${c.outcome} but [describe what gets in the way, in their words].` : "[The problem your buyer wants solved, in their words.]",
    promise: c.productName && c.outcome ? `${c.productName} helps ${c.audience || "[your audience]"} ${c.outcome} — without [what they want to avoid].` : "[Product] helps [who] [get what] without [what they want to avoid].",
    angle: "[What makes your version different: your story, your examples, a narrower audience or a faster route to the result.]",
    pricePoint: c.price,
    currency: c.currency,
    offerStack: [c.productName ? `${c.productName} (${c.format})` : "[Main product]", ...c.bonuses.map((b) => `Bonus: ${b}`), ...(c.leadMagnet ? [`Free gift that leads in: ${c.leadMagnet}`] : [])],
    notes: "",
  };
}

export function templateLeadMagnet(c: CampaignContext): LeadMagnet {
  const first = c.contents[0]?.replace(/^(chapter|part|section|lesson|module)\s+\w+\s*[:.\-–—]\s*/i, "") ?? "";
  const pts = c.sources[0] ? docListItems(c.sources[0].content).slice(0, 7) : [];
  return {
    title: first ? `Quick-start checklist: ${first}` : "[Lead magnet title]",
    format: "Checklist",
    description: `A one-page checklist that gives ${c.audience || "your reader"} a quick win and shows them what the full ${c.format || "product"} covers.`,
    outline: pts.length ? pts : ["[Step 1 — a quick win from chapter 1]", "[Step 2]", "[Step 3]", "[Where the full product takes them next]"],
    files: [],
  };
}

/** Template copy for every section, from the product details. */
export function templateCampaignCopy(c: CampaignContext): Pick<CampaignDrop, "rebrand" | "positioning" | "salesPage" | "emails" | "social" | "leadMagnet" | "checklist"> {
  const sc = salesContext(c);
  return {
    rebrand: { steps: DEFAULT_REBRAND_STEPS, rules: defaultRebrandRules() },
    positioning: templatePositioning(c),
    salesPage: { sections: CAMPAIGN_SALES_SECTIONS.map((t) => newSectionFromTemplate(t, sc)) },
    emails: templateEmails("launch", emailContext(c), "[link]"),
    social: templateCampaignPosts(c),
    leadMagnet: templateLeadMagnet(c),
    checklist: defaultCampaignChecklist(),
  };
}

export function regenerateSection(c: CampaignDrop, key: "rebrand" | "positioning" | "sales" | "emails" | "social" | "leadMagnet" | "checklist"): CampaignDrop {
  const copy = templateCampaignCopy(contextFromCampaign(c));
  switch (key) {
    case "rebrand":
      return { ...c, rebrand: copy.rebrand };
    case "positioning":
      return { ...c, positioning: copy.positioning };
    case "sales":
      return { ...c, salesPage: copy.salesPage };
    case "emails":
      return { ...c, emails: copy.emails };
    case "social":
      return { ...c, social: copy.social };
    case "leadMagnet":
      return { ...c, leadMagnet: { ...copy.leadMagnet, files: c.leadMagnet.files } };
    case "checklist":
      return { ...c, checklist: copy.checklist };
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Records                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export function newCampaign(brandId: BrandId, month: string, patch: Partial<CampaignDrop> = {}): CampaignDrop {
  const now = nowIso();
  const ctx: CampaignContext = { productName: "", subtitle: "", audience: "", outcome: "", format: "ebook", niche: "", contents: [], bonuses: [], leadMagnet: "", price: null, currency: "USD", fromName: "", sources: [] };
  const base: CampaignDrop = {
    id: uid("cmp"),
    brandId,
    title: `${monthLabel(month)} Campaign`,
    month,
    theme: "",
    summary: "",
    launchDay: 15,
    status: "draft",
    publishAt: null,
    access: "member",
    coverFileId: null,
    featured: emptyFeatured(),
    ...templateCampaignCopy(ctx),
    bonuses: [],
    calendar: [],
    isSample: false,
    createdAt: now,
    updatedAt: now,
  };
  const c = { ...base, ...patch };
  return { ...c, calendar: patch.calendar ?? buildCalendar(c) };
}

/** The campaign's suggested launch day as a date. */
export function campaignLaunchDate(c: Pick<CampaignDrop, "month" | "launchDay">): string {
  return dayOfMonth(c.month, c.launchDay);
}

export function entryDate(c: Pick<CampaignDrop, "month" | "launchDay">, day: number): string {
  return addDays(campaignLaunchDate(c), day);
}

export function dayText(day: number): string {
  if (day === 0) return "Launch day";
  return day < 0 ? `${-day} day${day === -1 ? "" : "s"} before` : `${day} day${day === 1 ? "" : "s"} after`;
}

/**
 * Promotional calendar: launch day, every email, post and dated checklist item ("auto"), plus any
 * entries the owner added ("manual"). Rebuilding keeps manual entries.
 */
export function buildCalendar(c: Pick<CampaignDrop, "featured" | "theme" | "emails" | "social" | "checklist" | "calendar" | "leadMagnet">): CalendarEntry[] {
  const auto: CalendarEntry[] = [];
  auto.push({ id: uid("cal"), day: 0, channel: "launch", title: `Launch: ${c.featured.title || c.theme || "your product"}`, detail: "Publish the sales page, open checkout and send the launch email.", refId: "launch", source: "auto" });
  for (const e of c.emails) auto.push({ id: uid("cal"), day: e.day, channel: "email", title: e.subject || "Email", detail: e.preview, refId: e.id, source: "auto" });
  for (const p of c.social) auto.push({ id: uid("cal"), day: p.day, channel: "social", title: `${SOCIAL_PLATFORM_LABELS[p.platform]} ${p.type} post`, detail: p.text.split("\n")[0]?.slice(0, 140) ?? "", refId: p.id, source: "auto" });
  for (const i of c.checklist) if (i.day !== null) auto.push({ id: uid("cal"), day: i.day, channel: "task", title: i.text, detail: CAMPAIGN_PHASE_LABELS[i.phase], refId: i.id, source: "auto" });
  if (c.leadMagnet.title) auto.push({ id: uid("cal"), day: -8, channel: "content", title: `Lead magnet live: ${c.leadMagnet.title}`, detail: "Opt-in page published and delivery tested.", refId: "lead-magnet", source: "auto" });
  const manual = (c.calendar ?? []).filter((e) => e.source === "manual");
  return sortCalendar([...auto, ...manual]);
}

const CHANNEL_ORDER = ["launch", "task", "content", "email", "social"];
export function sortCalendar(list: CalendarEntry[]): CalendarEntry[] {
  return [...list].sort((a, b) => a.day - b.day || CHANNEL_ORDER.indexOf(a.channel) - CHANNEL_ORDER.indexOf(b.channel) || a.title.localeCompare(b.title));
}

export interface SectionStatus {
  key: CampaignSectionKey;
  label: string;
  filled: boolean;
  count: number;
  summary: string;
}

/** What's in the campaign — powers the admin checklist and the member "What's included" grid. */
export function campaignSections(c: CampaignDrop): SectionStatus[] {
  const salesFilled = c.salesPage.sections.filter((s) => s.enabled && (s.heading.trim() || s.body.trim() || s.bullets.some((b) => b.trim()) || s.items.length)).length;
  const files = c.featured.files.length;
  const out: Record<CampaignSectionKey, Omit<SectionStatus, "key" | "label">> = {
    featured: { filled: !!c.featured.title.trim() && (files > 0 || c.featured.contents.length > 0), count: files, summary: c.featured.title ? `${c.featured.title}${files ? ` · ${files} file${files === 1 ? "" : "s"}` : ""}` : "Not chosen yet" },
    rebrand: { filled: !!c.rebrand.steps.trim(), count: c.rebrand.rules.length, summary: `${c.rebrand.steps.split("\n").filter((l) => l.trim()).length} steps · ${c.rebrand.rules.length} find-and-replace rules` },
    positioning: { filled: !!(c.positioning.audience.trim() && c.positioning.promise.trim()), count: c.positioning.offerStack.length, summary: c.positioning.audience ? `For ${c.positioning.audience}` : "Audience not set" },
    sales: { filled: salesFilled >= 3, count: salesFilled, summary: `${salesFilled} sections` },
    emails: { filled: c.emails.length > 0, count: c.emails.length, summary: `${c.emails.length} email${c.emails.length === 1 ? "" : "s"}` },
    social: { filled: c.social.length > 0, count: c.social.length, summary: `${c.social.length} post${c.social.length === 1 ? "" : "s"}` },
    leadMagnet: { filled: !!c.leadMagnet.title.trim(), count: c.leadMagnet.files.length, summary: c.leadMagnet.title || "Not set" },
    bonuses: { filled: c.bonuses.length > 0, count: c.bonuses.length, summary: `${c.bonuses.length} bonus${c.bonuses.length === 1 ? "" : "es"}` },
    checklist: { filled: c.checklist.length > 0, count: c.checklist.length, summary: `${c.checklist.length} steps` },
    calendar: { filled: c.calendar.length > 0, count: c.calendar.length, summary: c.calendar.length ? `${c.calendar.length} entries from ${dayText(Math.min(...c.calendar.map((e) => e.day)))} to ${dayText(Math.max(...c.calendar.map((e) => e.day)))}` : "Empty" },
  };
  return CAMPAIGN_SECTIONS.map((s) => ({ key: s.key, label: s.label, ...out[s.key] }));
}

export function validateCampaign(c: CampaignDrop): string | null {
  if (!c.title.trim()) return "Give the campaign a title.";
  if (!isMonth(c.month)) return "Choose the campaign's month.";
  if (c.launchDay < 1 || c.launchDay > 28) return "The launch day must be between the 1st and the 28th.";
  if (c.status === "scheduled" && !c.publishAt) return "Choose when the scheduled campaign is released.";
  return null;
}

export async function saveCampaign(c: CampaignDrop, repos?: MembershipRepositories): Promise<CampaignDrop> {
  const problem = validateCampaign(c);
  if (problem) throw new Error(problem);
  const r = repos ?? getMembershipRepos();
  const next = { ...c, title: c.title.trim(), launchDay: Math.round(c.launchDay), updatedAt: nowIso() };
  await r.campaigns.put(next);
  return next;
}

export function campaignFileIds(c: CampaignDrop): string[] {
  return [c.coverFileId, ...c.featured.files.map((f) => f.fileId), ...c.leadMagnet.files.map((f) => f.fileId), ...c.bonuses.flatMap((b) => b.files.map((f) => f.fileId))].filter((x): x is string => !!x);
}

export async function deleteCampaign(id: string, repos?: MembershipRepositories) {
  const r = repos ?? getMembershipRepos();
  const c = await r.campaigns.get(id);
  if (!c) return;
  await r.campaigns.delete(id);
  await deleteMemberFiles(campaignFileIds(c), r);
}

export async function storeCampaignFile(blob: Blob, name: string, brandId: BrandId, repos?: MembershipRepositories): Promise<CampaignFile> {
  const f = await storeMemberFile(blob, name, brandId, repos ?? getMembershipRepos());
  return { id: uid("cf"), fileId: f.id, name: f.name, size: f.size, mime: f.mime };
}

/** Copy of a campaign (new ids, copied files) for another month. */
export async function duplicateCampaign(id: string, month?: string, repos?: MembershipRepositories): Promise<CampaignDrop | null> {
  const r = repos ?? getMembershipRepos();
  const src = await r.campaigns.get(id);
  if (!src) return null;
  const copyFile = async (f: CampaignFile): Promise<CampaignFile> => {
    const stored = await r.files.get(f.fileId);
    return stored ? storeCampaignFile(stored.blob, f.name, src.brandId, r) : f;
  };
  const cover = src.coverFileId ? await r.files.get(src.coverFileId) : null;
  const now = nowIso();
  const c: CampaignDrop = {
    ...deepClone(src),
    id: uid("cmp"),
    title: `${src.title} (copy)`,
    month: month && isMonth(month) ? month : src.month,
    status: "draft",
    publishAt: null,
    isSample: false,
    coverFileId: cover ? (await storeMemberFile(cover.blob, cover.name, src.brandId, r)).id : null,
    featured: { ...deepClone(src.featured), files: await Promise.all(src.featured.files.map(copyFile)) },
    leadMagnet: { ...deepClone(src.leadMagnet), files: await Promise.all(src.leadMagnet.files.map(copyFile)) },
    bonuses: await Promise.all(src.bonuses.map(async (b) => ({ ...deepClone(b), id: uid("cb"), files: await Promise.all(b.files.map(copyFile)) }))),
    createdAt: now,
    updatedAt: now,
  };
  await r.campaigns.put(c);
  return c;
}

/* ------------------------------------------------------------------------------------------ */
/* From a studio project                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** Renders a document to a file. Injected so tests can skip the heavy DOCX engine. */
export type CampaignDocRenderer = (doc: { title: string; subtitle?: string; author?: string; chapters: { title: string; content: PMDoc }[] }, accent: string) => Promise<Blob>;

export const defaultDocxRenderer: CampaignDocRenderer = async (doc, accent) => {
  const { exportDocument, DEFAULT_DOC_EXPORT } = await import("@/lib/export/document");
  return (await exportDocument(doc, "docx", { ...DEFAULT_DOC_EXPORT, accent })).blob;
};

const PHASE_BY_CATEGORY: Record<LaunchTaskCategory, CampaignChecklistPhase> = { product: "prepare", content: "prepare", tech: "prepare", admin: "prepare", marketing: "pre-launch", "launch-day": "launch", "post-launch": "post-launch" };

function liveAssets(assets: Asset[]) {
  return assets.filter((a) => !a.deletedAt);
}

function docAssets(assets: Asset[]) {
  return liveAssets(assets).filter((a): a is Asset<"document"> => a.type === "document");
}

export interface FromProjectOptions {
  brandId: BrandId;
  month: string;
  render?: CampaignDocRenderer;
  studio?: Repositories;
  repos?: MembershipRepositories;
}

/**
 * Builds a campaign from a PLR Editor project: the main document becomes the featured product (with
 * a DOCX file), the project's own sales page, emails, posts, lead magnet, bonuses and launch plan are
 * copied in, and anything missing is filled with template copy based on the product.
 */
export async function campaignFromProject(projectId: string, opts: FromProjectOptions): Promise<CampaignDrop> {
  const studio = opts.studio ?? getRepos();
  const r = opts.repos ?? getMembershipRepos();
  const render = opts.render ?? defaultDocxRenderer;
  const project = await studio.projects.get(projectId);
  if (!project || project.deletedAt) throw new Error("That project couldn't be found.");
  const assets = liveAssets(await studio.assets.listByProject(projectId));
  const docs = docAssets(assets);
  const main = docs.find((d) => d.id === project.mainDocumentId) ?? docs.find((d) => d.data.role === "main") ?? docs[0];
  if (!main) throw new Error("This project has no document yet. Import or write the product in the PLR Editor first.");
  const accent = getBrand(opts.brandId).theme.primary;
  const author = main.data.author || "";

  const leadDoc = docs.find((d) => d.data.role === "lead-magnet");
  const bonusDocs = docs.filter((d) => d.data.role === "bonus").slice(0, 5);
  const ctx: CampaignContext = {
    productName: project.name || main.title,
    subtitle: main.data.subtitle,
    audience: project.audience,
    outcome: outcomeFrom(main.data.subtitle || project.description),
    format: project.productType || main.data.format || "ebook",
    niche: project.niche,
    contents: main.data.chapters.map((c) => c.title),
    bonuses: bonusDocs.map((b) => b.title),
    leadMagnet: leadDoc?.title ?? "",
    price: project.plannedPrice ?? main.data.price,
    currency: project.currency || "USD",
    fromName: author,
    sources: main.data.chapters.map((c) => ({ title: c.title, content: c.content })),
  };
  const copy = templateCampaignCopy(ctx);

  const docFile = async (d: Asset<"document">, suffix = ""): Promise<CampaignFile> => {
    const blob = await render({ title: d.title, subtitle: d.data.subtitle, author, chapters: d.data.chapters.map((c) => ({ title: c.title, content: c.content })) }, accent);
    return storeCampaignFile(blob, `${slugify(d.title)}${suffix}.docx`, opts.brandId, r);
  };

  const featured: FeaturedProduct = {
    title: ctx.productName,
    subtitle: main.data.subtitle,
    description: main.data.description || project.description || "",
    format: ctx.format,
    contents: ctx.contents,
    files: [await docFile(main)],
    licenceNotes: "Check the original PLR licence before you include this product in a member campaign — members must be allowed to edit, rebrand and sell it.",
    source: { kind: "project", projectId: project.id, projectName: project.name, importedAt: nowIso() },
  };

  // Rebrand rules the owner already set up in the editor come first.
  const rules: RebrandRule[] = main.data.rules.filter((x) => x.enabled && x.find.trim()).map((x) => ({ id: uid("rr"), find: x.find, replace: x.replace, note: "From the project's find-and-replace rules." }));
  const rebrand: RebrandInstructions = { steps: copy.rebrand.steps, rules: rules.length ? rules : copy.rebrand.rules };

  const salesAsset = liveAssets(assets).find((a): a is Asset<"sales-page"> => a.type === "sales-page");
  const salesSections: SalesSection[] = salesAsset?.data.sections.length ? salesAsset.data.sections.map((s) => ({ ...deepClone(s), id: uid("sec") })) : copy.salesPage.sections;

  const emailAssets = liveAssets(assets).filter((a): a is Asset<"email-campaign"> => a.type === "email-campaign");
  const emailAsset = emailAssets.find((a) => a.data.sequenceType === "launch" && a.data.emails.length) ?? emailAssets.find((a) => a.data.emails.length);
  const emails: EmailItem[] = emailAsset ? emailAsset.data.emails.map((e) => ({ ...deepClone(e), id: uid("em") })) : copy.emails;

  const socialAsset = liveAssets(assets)
    .filter((a): a is Asset<"social-campaign"> => a.type === "social-campaign")
    .find((a) => a.data.posts.length > 0);
  const social: CampaignPost[] = socialAsset ? postsToCampaign(socialAsset.data.posts) : copy.social;

  const leadMagnet: LeadMagnet = leadDoc
    ? { title: leadDoc.title, format: leadDoc.data.format || "Guide", description: leadDoc.data.description || copy.leadMagnet.description, outline: leadDoc.data.chapters.map((c) => c.title), files: [await docFile(leadDoc)] }
    : copy.leadMagnet;

  const bonuses: CampaignBonus[] = [];
  for (const b of bonusDocs) bonuses.push({ id: uid("cb"), title: b.title, description: b.data.description || `${b.data.format || "Bonus"} built from the main product.`, files: [await docFile(b)] });

  const launchAsset = liveAssets(assets)
    .filter((a): a is Asset<"launch-plan"> => a.type === "launch-plan")
    .find((a) => a.data.tasks.length > 0);
  const checklist: CampaignChecklistItem[] = launchAsset ? launchAsset.data.tasks.map((t: LaunchTask) => ({ id: uid("cl"), text: t.title, phase: PHASE_BY_CATEGORY[t.category] ?? "prepare", day: t.offsetDays })) : copy.checklist;

  const brand = getBrand(opts.brandId);
  const cover = await storeMemberFile(svgBlob(coverSvg({ title: ctx.productName, subtitle: "Profit Campaign Drop", kicker: monthLabel(opts.month), brandName: brand.name, palette: ["#15803d", "#0a140f", "#f2b632"], motif: "steps" })), `${slugify(ctx.productName)}-campaign.svg`, opts.brandId, r);

  const c = newCampaign(opts.brandId, opts.month, {
    title: `${monthLabel(opts.month)}: ${ctx.productName}`,
    theme: ctx.productName,
    summary: `This month's campaign launches **${ctx.productName}**${ctx.audience ? ` for ${ctx.audience}` : ""}. Everything you need is below: the product, how to make it yours, the copy and the plan.`,
    coverFileId: cover.id,
    featured,
    rebrand,
    positioning: copy.positioning,
    salesPage: { sections: salesSections },
    emails,
    social,
    leadMagnet,
    bonuses,
    checklist,
  });
  return saveCampaign(c, r);
}

/** Social posts from the studio → campaign posts spread around launch day. */
export function postsToCampaign(posts: SocialPost[]): CampaignPost[] {
  const dated = posts.filter((p) => p.scheduledFor).sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
  const undated = posts.filter((p) => !p.scheduledFor);
  const ordered = [...dated, ...undated].slice(0, 30);
  const spread = ordered.length <= POST_DAYS.length ? POST_DAYS : ordered.map((_, i) => Math.round(-10 + (i * 20) / Math.max(1, ordered.length - 1)));
  return ordered.map((p, i) => ({ id: uid("cp"), platform: p.platform, type: p.type, day: spread[i] ?? 0, text: p.text, hashtags: [...p.hashtags] }));
}

/* ------------------------------------------------------------------------------------------ */
/* Into the studio (member: "Start this campaign in the studio")                                 */
/* ------------------------------------------------------------------------------------------ */

export function campaignSalesPageData(c: CampaignDrop): SalesPageData {
  return defaultSalesPageData({
    productName: c.featured.title || c.theme,
    sections: c.salesPage.sections.map((s) => deepClone(s)),
    price: { amount: c.positioning.pricePoint, currency: c.positioning.currency || "USD", label: "One-time payment", billing: "one-time" },
  });
}

const CATEGORY_BY_PHASE: Record<CampaignChecklistPhase, LaunchTaskCategory> = { prepare: "product", "pre-launch": "marketing", launch: "launch-day", "post-launch": "post-launch" };
const DEFAULT_PHASE_DAY: Record<CampaignChecklistPhase, number> = { prepare: -10, "pre-launch": -3, launch: 0, "post-launch": 3 };

export interface ToProjectOptions {
  studio?: Repositories;
  repos?: MembershipRepositories;
  /** Import the featured product's editable file as the main document (needs the browser importers). */
  importDocument?: (file: File, projectId: string, title: string) => Promise<void>;
}

/**
 * Creates a studio project ready to work through the campaign: sales page, launch emails, dated
 * social posts and a launch plan (from the checklist, relative to the campaign's launch day), plus
 * the featured product as the main document when an editable file is attached.
 */
export async function campaignToProject(c: CampaignDrop, opts: ToProjectOptions = {}): Promise<{ projectId: string; assets: number; importedDocument: boolean }> {
  const studio = opts.studio ?? getRepos();
  const r = opts.repos ?? getMembershipRepos();
  const name = c.featured.title || c.theme || c.title;
  const project = await createProject(
    {
      name,
      description: c.featured.subtitle || c.positioning.promise,
      audience: c.positioning.audience,
      productType: c.featured.format || "ebook",
      stage: "rebranding",
      plannedPrice: c.positioning.pricePoint,
      currency: c.positioning.currency || "USD",
      tags: ["Campaign Drop", c.month],
      notes: `Started from the ${monthLabel(c.month)} Profit Campaign Drop “${c.title}”. Follow the rebrand instructions and check the licence before you sell.`,
    },
    studio,
  );
  let assets = 0;
  await createAsset(project.id, "sales-page", { title: `${name} — sales page`, data: campaignSalesPageData(c) }, studio);
  assets++;
  if (c.emails.length) {
    await createAsset(project.id, "email-campaign", { title: `${name} — launch emails`, data: { sequenceType: "launch", goal: c.positioning.promise, fromName: "", defaultCtaUrl: "", emails: c.emails.map((e) => ({ ...deepClone(e), id: uid("em") })) } }, studio);
    assets++;
  }
  if (c.social.length) {
    const posts: SocialPost[] = c.social.map((p) => ({ id: uid("post"), platform: p.platform, type: p.type, text: p.text, hashtags: [...p.hashtags], scheduledFor: entryDate(c, p.day), status: "scheduled", seriesId: null, linkedAssetId: null, source: "template", notes: `${dayText(p.day)} (campaign day ${p.day})` }));
    await createAsset(project.id, "social-campaign", { title: `${name} — launch posts`, data: { posts, series: [] } }, studio);
    assets++;
  }
  const milestoneId = uid("ms");
  await createAsset(
    project.id,
    "launch-plan",
    {
      title: `${name} — launch plan`,
      data: {
        launchDate: campaignLaunchDate(c),
        tasks: c.checklist.map((i) => ({ id: uid("lt"), title: i.text, category: CATEGORY_BY_PHASE[i.phase], priority: i.phase === "launch" ? "high" : "medium", status: "todo", offsetDays: i.day ?? DEFAULT_PHASE_DAY[i.phase], dueDate: null, notes: "", milestoneId: i.phase === "launch" ? milestoneId : null })),
        milestones: [{ id: milestoneId, title: "Launch day", offsetDays: 0, date: null, done: false }],
        readiness: defaultReadiness(),
        marketing: defaultMarketing(),
        notes: c.rebrand.steps,
        templateName: "Profit Campaign Drop",
      },
    },
    studio,
  );
  assets++;

  let importedDocument = false;
  const editable = c.featured.files.find((f) => /\.(docx|pdf|txt|md|markdown|html?)$/i.test(f.name));
  if (editable && opts.importDocument) {
    const stored = await r.files.get(editable.fileId);
    if (stored) {
      await opts.importDocument(new File([stored.blob], editable.name, { type: stored.mime }), project.id, name);
      importedDocument = true;
    }
  }
  return { projectId: project.id, assets, importedDocument };
}

/* ------------------------------------------------------------------------------------------ */
/* Exports                                                                                      */
/* ------------------------------------------------------------------------------------------ */

function bullets(list: string[]) {
  return list.filter((x) => x.trim()).map((x) => `- ${x}`);
}

export function salesCopyMarkdown(c: CampaignDrop): string {
  return docToMarkdown(salesPageDoc(campaignSalesPageData(c)));
}

export function campaignMarkdown(c: CampaignDrop): string {
  const L: string[] = [`# ${c.title}`, "", c.theme ? `**${c.theme}** · ${monthLabel(c.month)}` : monthLabel(c.month), "", c.summary, "", `Suggested launch date: **${campaignLaunchDate(c)}**`, ""];
  const f = c.featured;
  L.push("## 1. Featured PLR product", "", `**${f.title || "Not chosen yet"}**${f.subtitle ? ` — ${f.subtitle}` : ""}`, "", f.description, "");
  if (f.contents.length) L.push("Contents:", "", ...bullets(f.contents), "");
  if (f.files.length) L.push("Files:", "", ...bullets(f.files.map((x) => x.name)), "");
  if (f.licenceNotes) L.push(`**Licence:** ${f.licenceNotes}`, "");
  L.push("## 2. Rebranding instructions", "", c.rebrand.steps, "");
  if (c.rebrand.rules.length) L.push("| Find | Replace with | Note |", "| --- | --- | --- |", ...c.rebrand.rules.map((x) => `| ${x.find} | ${x.replace} | ${x.note} |`), "");
  const p = c.positioning;
  L.push("## 3. Product positioning", "", `**Who it's for:** ${p.audience}`, "", `**Their problem:** ${p.problem}`, "", `**Promise:** ${p.promise}`, "", `**Your angle:** ${p.angle}`, "", `**Price:** ${p.pricePoint ? `${p.currency} ${p.pricePoint}` : "[your price]"}`, "", "**Offer stack:**", "", ...bullets(p.offerStack), "");
  if (p.notes) L.push(p.notes, "");
  L.push("## 4. Sales-page copy", "", salesCopyMarkdown(c), "");
  L.push("## 5. Email marketing sequence", "", emailsMarkdownOf({ sequenceType: "launch", goal: "", fromName: "", defaultCtaUrl: "", emails: c.emails }, "Launch emails").replace(/^# .*\n/, ""), "");
  L.push("## 6. Social media content", "");
  for (const s of [...c.social].sort((a, b) => a.day - b.day)) L.push(`### ${dayText(s.day)} · ${SOCIAL_PLATFORM_LABELS[s.platform]} (${s.type})`, "", s.text, "", s.hashtags.length ? s.hashtags.map((h) => `#${h}`).join(" ") : "", "");
  const lm = c.leadMagnet;
  L.push("## 7. Lead magnet", "", `**${lm.title}** (${lm.format})`, "", lm.description, "", ...bullets(lm.outline), "");
  L.push("## 8. Bonus materials", "");
  if (!c.bonuses.length) L.push("No bonuses this month.", "");
  for (const b of c.bonuses) L.push(`### ${b.title}`, "", b.description, "", ...bullets(b.files.map((x) => x.name)), "");
  L.push("## 9. Launch checklist", "");
  for (const ph of CAMPAIGN_PHASES) {
    const items = c.checklist.filter((i) => i.phase === ph);
    if (items.length) L.push(`### ${CAMPAIGN_PHASE_LABELS[ph]}`, "", ...items.map((i) => `- [ ] ${i.text}${i.day !== null ? ` (${dayText(i.day)})` : ""}`), "");
  }
  L.push("## 10. Promotional calendar", "", "| Date | Day | Channel | What |", "| --- | --- | --- | --- |", ...c.calendar.map((e) => `| ${entryDate(c, e.day)} | ${dayText(e.day)} | ${CALENDAR_CHANNEL_LABELS[e.channel]} | ${e.title.replace(/\|/g, "/")} |`), "");
  return L.join("\n");
}

export function socialCsv(c: CampaignDrop): string {
  return Papa.unparse([...c.social].sort((a, b) => a.day - b.day).map((p) => ({ date: entryDate(c, p.day), day: p.day, platform: SOCIAL_PLATFORM_LABELS[p.platform], type: p.type, text: p.text, hashtags: p.hashtags.map((h) => `#${h}`).join(" ") })));
}

export function calendarCsv(c: CampaignDrop): string {
  return Papa.unparse(c.calendar.map((e) => ({ date: entryDate(c, e.day), day: e.day, when: dayText(e.day), channel: CALENDAR_CHANNEL_LABELS[e.channel], title: e.title, detail: e.detail })));
}

export function calendarIcs(c: CampaignDrop, now: Date = new Date()): string {
  return buildIcs(`${c.title} — promotional calendar`, { allDay: c.calendar.map((e) => ({ uid: `${c.id}-${e.id}`, day: entryDate(c, e.day), summary: `${CALENDAR_CHANNEL_LABELS[e.channel]}: ${e.title}`, description: e.detail })) }, now);
}

export function emailsCsv(c: CampaignDrop): string {
  return emailsCsvOf({ sequenceType: "launch", goal: "", fromName: "", defaultCtaUrl: "", emails: c.emails });
}

/** The whole campaign as one ZIP: a README, every section as Markdown/CSV/HTML/ICS and every file. */
export async function campaignKit(c: CampaignDrop, repos?: MembershipRepositories): Promise<{ blob: Blob; fileName: string; files: number }> {
  const r = repos ?? getMembershipRepos();
  const zip = new JSZip();
  const root = zip.folder(slugify(c.title, "campaign"))!;
  let files = 0;
  const add = async (folder: JSZip, f: CampaignFile) => {
    const stored = await r.files.get(f.fileId);
    if (!stored) return;
    folder.file(f.name, stored.blob);
    files++;
  };
  root.file("README.md", campaignMarkdown(c));
  const featured = root.folder("01-featured-product")!;
  for (const f of c.featured.files) await add(featured, f);
  featured.file("product-brief.md", [`# ${c.featured.title}`, "", c.featured.subtitle, "", c.featured.description, "", ...bullets(c.featured.contents), "", `Licence: ${c.featured.licenceNotes}`].join("\n"));
  root.file("02-rebranding-instructions.md", [`# Rebranding instructions`, "", c.rebrand.steps, "", ...c.rebrand.rules.map((x) => `- Replace “${x.find}” with “${x.replace}”${x.note ? ` — ${x.note}` : ""}`)].join("\n"));
  const p = c.positioning;
  root.file("03-positioning.md", [`# Positioning`, "", `Who it's for: ${p.audience}`, "", `Problem: ${p.problem}`, "", `Promise: ${p.promise}`, "", `Angle: ${p.angle}`, "", `Price: ${p.pricePoint ? `${p.currency} ${p.pricePoint}` : "[your price]"}`, "", "Offer stack:", ...bullets(p.offerStack), "", p.notes].join("\n"));
  const sales = root.folder("04-sales-page")!;
  sales.file("sales-page.html", salesPageHtml(campaignSalesPageData(c), { title: c.featured.title || c.title }));
  sales.file("sales-page.md", salesCopyMarkdown(c));
  const emails = root.folder("05-emails")!;
  emails.file("launch-emails.md", emailsMarkdownOf({ sequenceType: "launch", goal: "", fromName: "", defaultCtaUrl: "", emails: c.emails }, "Launch emails"));
  emails.file("launch-emails.csv", emailsCsv(c));
  const social = root.folder("06-social")!;
  social.file("posts.csv", socialCsv(c));
  social.file("posts.md", [...c.social].sort((a, b) => a.day - b.day).map((s) => `## ${dayText(s.day)} · ${SOCIAL_PLATFORM_LABELS[s.platform]}\n\n${s.text}\n\n${s.hashtags.map((h) => `#${h}`).join(" ")}`).join("\n\n"));
  const lead = root.folder("07-lead-magnet")!;
  lead.file("lead-magnet.md", [`# ${c.leadMagnet.title}`, "", `Format: ${c.leadMagnet.format}`, "", c.leadMagnet.description, "", ...bullets(c.leadMagnet.outline)].join("\n"));
  for (const f of c.leadMagnet.files) await add(lead, f);
  const bonus = root.folder("08-bonuses")!;
  for (const b of c.bonuses) {
    const folder = bonus.folder(slugify(b.title, "bonus"))!;
    folder.file("about.md", `# ${b.title}\n\n${b.description}`);
    for (const f of b.files) await add(folder, f);
  }
  root.file(
    "09-launch-checklist.md",
    ["# Launch checklist", "", ...CAMPAIGN_PHASES.flatMap((ph) => {
      const items = c.checklist.filter((i) => i.phase === ph);
      return items.length ? [`## ${CAMPAIGN_PHASE_LABELS[ph]}`, "", ...items.map((i) => `- [ ] ${i.text}${i.day !== null ? ` (${entryDate(c, i.day)})` : ""}`), ""] : [];
    })].join("\n"),
  );
  const cal = root.folder("10-promotional-calendar")!;
  cal.file("calendar.csv", calendarCsv(c));
  cal.file("calendar.ics", calendarIcs(c));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { blob, fileName: `${slugify(c.title, "campaign")}-campaign-kit.zip`, files };
}
