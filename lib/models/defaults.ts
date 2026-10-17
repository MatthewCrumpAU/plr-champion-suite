import { uid } from "@/lib/utils";
import type { RightsReviewData, RightCheck, RightGroup, ReviewChecklistItem } from "./research";
import type { SalesPageData, SalesSection, SalesSectionType, EmailCampaignData, SocialCampaignData, NameIdeasData } from "./marketing";
import { SALES_SECTION_LABELS } from "./marketing";
import type { ProfitData, ProfitScenario, FunnelData, LaunchPlanData } from "./profit";

/* ------------------------------------------------------------------ */
/* Rights review                                                        */
/* ------------------------------------------------------------------ */
const CHECKS: [RightGroup, string, string, string][] = [
  ["permitted", "sell-digital", "Sell as a digital download (ebook/PDF)", "Can you charge for the product as a digital file?"],
  ["permitted", "lead-magnet", "Give away as a free lead magnet", "Can it be used as a free opt-in gift to build an email list?"],
  ["permitted", "membership", "Add to a paid membership site", "Can members access it as part of a subscription?"],
  ["permitted", "bundle", "Include in bundles or as a bonus", "Can it be packaged with other products or offered as a bonus?"],
  ["permitted", "blog-email", "Use content in blog posts and emails", "Can extracts be published on a blog, newsletter or autoresponder?"],
  ["permitted", "course-video", "Turn into courses, video or audio", "Can the content be converted into other media formats?"],
  ["permitted", "print", "Sell in print (physical books)", "Some licences exclude print or print-on-demand."],
  ["permitted", "marketplaces", "Sell on marketplaces (e.g. Amazon Kindle, Etsy)", "Many licences restrict marketplaces or require substantial changes first."],
  ["permitted", "client-work", "Use for client work / ghostwriting", "Can the content be delivered to clients as done-for-you work?"],
  ["modification", "edit", "Edit and rewrite the content", "Can the text be changed, shortened or expanded?"],
  ["modification", "title-cover", "Change the title and cover", "Can you rename and redesign the product?"],
  ["modification", "own-name", "Put your own name as author", "Can you claim authorship of the edited product?"],
  ["modification", "translate", "Translate into other languages", ""],
  ["resale", "pass-plr", "Pass on Private Label Rights to buyers", "Can your buyers receive PLR? Do not assume this."],
  ["resale", "pass-mrr", "Pass on Master Resell Rights to buyers", "Master Resell Rights are NOT automatically included with PLR."],
  ["resale", "pass-rr", "Pass on Resell Rights to buyers", ""],
  ["resale", "own-price", "Set your own price", ""],
  ["resale", "min-price", "Minimum price or price restrictions", "Record any minimum price, 'no free' or 'no auction' rule."],
  ["distribution", "free-giveaway", "Distribute free to the public", "Distinct from a lead magnet: free download without opt-in."],
  ["distribution", "giveaway-events", "Use in giveaway events / JV giveaways", ""],
  ["distribution", "auction", "Sell on auction sites", ""],
  ["distribution", "unedited", "Sell or share the original unedited version", "Some licences require edits before resale."],
  ["distribution", "sell-licence", "Sell or transfer the licence itself", ""],
  ["attribution", "credit", "Original author credit required", "Is attribution required anywhere?"],
  ["attribution", "images", "Images and graphics licensed separately", "Graphics often carry different terms from the text."],
];

const REVIEW_CHECKLIST = [
  "The full licence text is saved in this review.",
  "I've confirmed the licence allows the exact way I plan to sell (format, channel and price).",
  "I've checked whether I may put my own name on it as author.",
  "I've recorded any minimum price, 'no free' or 'no auction' rules.",
  "I've checked what rights I can pass to buyers — and I have not assumed Master Resell Rights are included.",
  "I've checked whether the content must be substantially edited before selling (e.g. for marketplaces).",
  "I've checked the licence for images, graphics and any templates separately.",
  "I've removed trademarks, real names or claims I can't substantiate.",
  "The licence terms I give my buyers match what I'm allowed to grant.",
  "I've kept proof of purchase (receipt or order number).",
  "Anything unclear has been confirmed with the seller or a qualified adviser.",
];

export function defaultRightsChecks(): RightCheck[] {
  return CHECKS.map(([group, key, label, help]) => ({ id: uid("chk"), key, group, label, help, status: "not-reviewed", evidence: "", notes: "" }));
}

export function defaultRightsReviewData(partial: Partial<RightsReviewData> = {}): RightsReviewData {
  return {
    licenceName: "",
    licenceType: "unknown",
    source: { vendor: "", productName: "", purchaseDate: "", orderRef: "", url: "", notes: "" },
    licenceText: "",
    licenceFileId: null,
    checks: defaultRightsChecks(),
    attribution: "",
    resaleNotes: "",
    modificationNotes: "",
    distributionNotes: "",
    warnings: [],
    checklist: REVIEW_CHECKLIST.map((label): ReviewChecklistItem => ({ id: uid("rc"), label, done: false })),
    reviewedAt: null,
    summary: "",
    ...partial,
  };
}

export function normalizeRightsReviewData(raw: unknown): RightsReviewData {
  const d = (raw ?? {}) as Partial<RightsReviewData>;
  const def = defaultRightsReviewData();
  return { ...def, ...d, source: { ...def.source, ...(d.source ?? {}) }, checks: d.checks?.length ? d.checks : def.checks, checklist: d.checklist?.length ? d.checklist : def.checklist, warnings: d.warnings ?? [] };
}

/* ------------------------------------------------------------------ */
/* Sales page                                                           */
/* ------------------------------------------------------------------ */
export const SALES_SECTION_ORDER: SalesSectionType[] = ["headline", "subheadline", "problem", "introduction", "benefits", "features", "included", "bonuses", "pricing", "faq", "guarantee", "cta"];

export function emptySalesSection(type: SalesSectionType): SalesSection {
  return { id: uid("sec"), type, enabled: true, heading: type === "headline" || type === "subheadline" ? "" : SALES_SECTION_LABELS[type], subheading: "", body: "", bullets: [], items: [], buttonText: type === "pricing" || type === "cta" ? "Get instant access" : "" };
}

export function defaultSalesPageData(partial: Partial<SalesPageData> = {}): SalesPageData {
  return {
    productName: "",
    sections: SALES_SECTION_ORDER.map(emptySalesSection),
    theme: { primary: "#5b4df5", accent: "#f5b544", background: "#ffffff", surface: "#f6f7fb", text: "#111827", headingFont: "inter", bodyFont: "inter", maxWidth: 860, rounded: true },
    price: { amount: null, currency: "USD", label: "One-time payment", billing: "one-time" },
    checkoutUrl: "",
    brandKitId: null,
    coverAssetId: null,
    mockupAssetId: null,
    ...partial,
  };
}

export function normalizeSalesPageData(raw: unknown): SalesPageData {
  const d = (raw ?? {}) as Partial<SalesPageData>;
  const def = defaultSalesPageData();
  return { ...def, ...d, theme: { ...def.theme, ...(d.theme ?? {}) }, price: { ...def.price, ...(d.price ?? {}) }, sections: Array.isArray(d.sections) ? d.sections : def.sections };
}

/* ------------------------------------------------------------------ */
/* Email, social, names                                                 */
/* ------------------------------------------------------------------ */
export function defaultEmailCampaignData(partial: Partial<EmailCampaignData> = {}): EmailCampaignData {
  return { sequenceType: "launch", goal: "", fromName: "", defaultCtaUrl: "", emails: [], ...partial };
}
export function normalizeEmailCampaignData(raw: unknown): EmailCampaignData {
  const d = (raw ?? {}) as Partial<EmailCampaignData>;
  return { ...defaultEmailCampaignData(), ...d, emails: Array.isArray(d.emails) ? d.emails : [] };
}

export function defaultSocialCampaignData(partial: Partial<SocialCampaignData> = {}): SocialCampaignData {
  return { posts: [], series: [], ...partial };
}
export function normalizeSocialCampaignData(raw: unknown): SocialCampaignData {
  const d = (raw ?? {}) as Partial<SocialCampaignData>;
  return { posts: Array.isArray(d.posts) ? d.posts : [], series: Array.isArray(d.series) ? d.series : [] };
}

export function defaultNameIdeasData(partial: Partial<NameIdeasData> = {}): NameIdeasData {
  return { topic: "", audience: "", outcome: "", format: "", ideas: [], ...partial };
}
export function normalizeNameIdeasData(raw: unknown): NameIdeasData {
  const d = (raw ?? {}) as Partial<NameIdeasData>;
  return { ...defaultNameIdeasData(), ...d, ideas: Array.isArray(d.ideas) ? d.ideas : [] };
}

/* ------------------------------------------------------------------ */
/* Profit                                                               */
/* ------------------------------------------------------------------ */
export function newScenario(partial: Partial<ProfitScenario> = {}): ProfitScenario {
  return {
    id: uid("scn"),
    name: "Base case",
    price: 27,
    feePercent: 2.9,
    feeFixed: 0.3,
    affiliatePercent: 0,
    variableCost: 0,
    refundRate: 0,
    adSpend: 0,
    fixedCosts: 0,
    traffic: 1000,
    conversionRate: 2,
    unitsOverride: null,
    ...partial,
  };
}

export function defaultProfitData(partial: Partial<ProfitData> = {}): ProfitData {
  const s = newScenario();
  return { currency: "USD", scenarios: [s], activeScenarioId: s.id, actuals: [], ...partial };
}
export function normalizeProfitData(raw: unknown): ProfitData {
  const d = (raw ?? {}) as Partial<ProfitData>;
  const def = defaultProfitData();
  const scenarios = Array.isArray(d.scenarios) && d.scenarios.length ? d.scenarios.map((s) => newScenario(s)) : def.scenarios;
  return { currency: d.currency ?? "USD", scenarios, activeScenarioId: d.activeScenarioId && scenarios.some((s) => s.id === d.activeScenarioId) ? d.activeScenarioId : scenarios[0].id, actuals: Array.isArray(d.actuals) ? d.actuals : [] };
}

export function defaultFunnelData(partial: Partial<FunnelData> = {}): FunnelData {
  return { nodes: [], edges: [], assumptions: { traffic: 1000, currency: "USD", adSpend: 0 }, notes: "", ...partial };
}
export function normalizeFunnelData(raw: unknown): FunnelData {
  const d = (raw ?? {}) as Partial<FunnelData>;
  const def = defaultFunnelData();
  return {
    ...def,
    ...d,
    assumptions: { ...def.assumptions, ...(d.assumptions ?? {}) },
    nodes: Array.isArray(d.nodes) ? d.nodes : [],
    edges: Array.isArray(d.edges) ? d.edges.map((e) => ({ ...e, kind: e.kind ?? "yes" })) : [],
  };
}

export function defaultLaunchPlanData(partial: Partial<LaunchPlanData> = {}): LaunchPlanData {
  return { launchDate: null, tasks: [], milestones: [], readiness: [], marketing: [], notes: "", templateName: null, ...partial };
}
export function normalizeLaunchPlanData(raw: unknown): LaunchPlanData {
  const d = (raw ?? {}) as Partial<LaunchPlanData>;
  return { ...defaultLaunchPlanData(), ...d, tasks: d.tasks ?? [], milestones: d.milestones ?? [], readiness: d.readiness ?? [], marketing: d.marketing ?? [] };
}
