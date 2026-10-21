/**
 * PLR Profit Lab data model.
 *
 * Profit Lab is the third brand in the membership system (`plr-profit-lab`). These records live in
 * the same brand-scoped membership database as the libraries, so View as, test profiles,
 * entitlements, backups and the "erase" tools work the same way. Each interface maps 1:1 to a
 * future Supabase table (see docs/DATABASE-MIGRATION.md → "Profit Lab tables"); nested arrays become
 * jsonb columns. Ids are opaque strings, dates are ISO strings and plan days are local "YYYY-MM-DD".
 */
import type { AccessTier, BrandId, PublishStatus } from "@/lib/membership/types";
import type { EmailItem, SalesSection, SocialPlatform, SocialPostType } from "@/lib/models/marketing";

/* ------------------------------------------------------------------------------------------ */
/* 90-Day Profit Path                                                                          */
/* ------------------------------------------------------------------------------------------ */

export type Experience = "new" | "some" | "experienced";
export const EXPERIENCE_LABELS: Record<Experience, string> = {
  new: "New — I haven't sold a digital product yet",
  some: "Some experience — I've sold a few products",
  experienced: "Experienced — I launch products regularly",
};
export const EXPERIENCE_SHORT: Record<Experience, string> = { new: "New", some: "Some experience", experienced: "Experienced" };

export type BusinessModel = "sell-products" | "lead-magnet-funnel" | "membership" | "bundles" | "plr-reseller" | "services";
export const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  "sell-products": "Sell rebranded info products",
  "lead-magnet-funnel": "Lead magnet + email funnel",
  membership: "Paid membership or subscription",
  bundles: "Product bundles and deals",
  "plr-reseller": "Resell PLR packages",
  services: "Products that lead to coaching or services",
};
export const BUSINESS_MODEL_HINTS: Record<BusinessModel, string> = {
  "sell-products": "Turn PLR into your own ebooks, workbooks and courses and sell them.",
  "lead-magnet-funnel": "Give away a lead magnet, build a list and sell to it by email.",
  membership: "Deliver fresh content every month to paying members.",
  bundles: "Combine several rebranded products into higher-value bundles.",
  "plr-reseller": "Package PLR with a licence and sell the rights to other marketers.",
  services: "Use low-priced products to attract clients for coaching or done-for-you work.",
};

export interface CustomPathTask {
  id: string;
  title: string;
  detail: string;
  /** Local date "YYYY-MM-DD". */
  date: string;
  minutes: number;
}

/**
 * A member's answers to the Profit Path questions. The plan itself is generated from this record
 * (lib/lab/profit-path.ts), so changing an answer re-plans instantly while ticked tasks keep their
 * progress (task keys are stable).
 */
export interface ProfitPathProfile {
  /** `path:<memberId>` */
  id: string;
  brandId: BrandId;
  memberId: string;
  experience: Experience;
  hoursPerWeek: number;
  /** Working weekdays, 0 = Sunday … 6 = Saturday. */
  workDays: number[];
  /** Day 1 of the plan, local "YYYY-MM-DD". */
  startDate: string;
  niche: string;
  productIdea: string;
  /** PLR products the member already has to work with. */
  plrProducts: number;
  /** Products the member already sells. */
  ownProducts: number;
  hasEmailList: boolean;
  listSize: number;
  hasWebsite: boolean;
  hasCheckout: boolean;
  hasSocialAudience: boolean;
  businessModel: BusinessModel;
  /** Launches planned inside the 90 days (1–3). */
  launches: number;
  /** Week of the first launch (3–11). */
  firstLaunchWeek: number;
  revenueGoal: number;
  pricePoint: number;
  /** What-if sales-page conversion rate used for the goal maths, in percent. */
  conversionPct: number;
  listGoal: number;
  currency: string;
  /** Optional studio project the plan is built around. */
  projectId: string | null;
  customTasks: CustomPathTask[];
  skippedTaskKeys: string[];
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------------------------------ */
/* Progress (one row per member per plan / campaign / Build Day)                               */
/* ------------------------------------------------------------------------------------------ */

export type LabProgressKind = "path" | "campaign" | "build-day";

export interface OwnAction {
  id: string;
  title: string;
  done: boolean;
}

export interface LabProgress {
  /** `${memberId}:${kind}:${refId}` */
  id: string;
  brandId: BrandId;
  memberId: string;
  kind: LabProgressKind;
  /** Profile, campaign or Build Day id. */
  refId: string;
  /** Item key → ISO time it was completed. */
  done: Record<string, string>;
  /** Item key → note (weekly reflections, task notes). */
  notes: Record<string, string>;
  /** Build Day extras: RSVP, attendance, the member's own action items and wins journal. */
  rsvp: "going" | "maybe" | "not-going" | null;
  attended: boolean;
  ownActions: OwnAction[];
  journal: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------------------------------ */
/* Monthly Profit Campaign Drop                                                                 */
/* ------------------------------------------------------------------------------------------ */

export interface CampaignFile {
  id: string;
  fileId: string;
  name: string;
  size: number;
  mime: string;
}

export interface FeaturedProduct {
  title: string;
  subtitle: string;
  /** Markdown. */
  description: string;
  format: string;
  /** Contents, one line per chapter/module. */
  contents: string[];
  files: CampaignFile[];
  /** What the PLR licence allows, in plain words. */
  licenceNotes: string;
  source: {
    kind: "manual" | "project";
    projectId: string | null;
    projectName: string | null;
    importedAt: string | null;
  };
}

export interface RebrandRule {
  id: string;
  find: string;
  replace: string;
  note: string;
}

export interface RebrandInstructions {
  /** Markdown, one step per line. */
  steps: string;
  rules: RebrandRule[];
}

export interface Positioning {
  audience: string;
  problem: string;
  promise: string;
  angle: string;
  pricePoint: number | null;
  currency: string;
  offerStack: string[];
  /** Markdown. */
  notes: string;
}

export interface CampaignPost {
  id: string;
  platform: SocialPlatform;
  type: SocialPostType;
  /** Day relative to launch day (0). */
  day: number;
  text: string;
  hashtags: string[];
}

export interface LeadMagnet {
  title: string;
  format: string;
  description: string;
  outline: string[];
  files: CampaignFile[];
}

export interface CampaignBonus {
  id: string;
  title: string;
  description: string;
  files: CampaignFile[];
}

export type CampaignChecklistPhase = "prepare" | "pre-launch" | "launch" | "post-launch";
export const CAMPAIGN_PHASE_LABELS: Record<CampaignChecklistPhase, string> = {
  prepare: "Prepare",
  "pre-launch": "Pre-launch",
  launch: "Launch day",
  "post-launch": "After launch",
};
export const CAMPAIGN_PHASES: CampaignChecklistPhase[] = ["prepare", "pre-launch", "launch", "post-launch"];

export interface CampaignChecklistItem {
  id: string;
  text: string;
  phase: CampaignChecklistPhase;
  /** Day relative to launch day, if it belongs on the calendar. */
  day: number | null;
}

export type CalendarChannel = "email" | "social" | "content" | "launch" | "task";
export const CALENDAR_CHANNEL_LABELS: Record<CalendarChannel, string> = { email: "Email", social: "Social", content: "Content", launch: "Launch", task: "Task" };

export interface CalendarEntry {
  id: string;
  /** Day relative to launch day (0). */
  day: number;
  channel: CalendarChannel;
  title: string;
  detail: string;
  /** Email/post/checklist item this entry was built from (auto entries). */
  refId: string | null;
  source: "auto" | "manual";
}

export interface CampaignDrop {
  id: string;
  brandId: BrandId;
  title: string;
  /** "YYYY-MM" */
  month: string;
  /** Headline for the month, e.g. "The Sleep Better Launch". */
  theme: string;
  /** Markdown. */
  summary: string;
  /** Suggested launch day of the month (1–28) used to turn calendar days into dates. */
  launchDay: number;
  status: PublishStatus;
  publishAt: string | null;
  access: AccessTier;
  coverFileId: string | null;
  featured: FeaturedProduct;
  rebrand: RebrandInstructions;
  positioning: Positioning;
  salesPage: { sections: SalesSection[] };
  emails: EmailItem[];
  social: CampaignPost[];
  leadMagnet: LeadMagnet;
  bonuses: CampaignBonus[];
  checklist: CampaignChecklistItem[];
  calendar: CalendarEntry[];
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------------------------------ */
/* PLR Profit Build Day                                                                         */
/* ------------------------------------------------------------------------------------------ */

export type SessionKind = "welcome" | "teach" | "build" | "hot-seat" | "qa" | "break" | "review";
export const SESSION_KIND_LABELS: Record<SessionKind, string> = {
  welcome: "Welcome",
  teach: "Teaching",
  build: "Build sprint",
  "hot-seat": "Hot seats",
  qa: "Q&A",
  break: "Break",
  review: "Share & commit",
};

export interface SessionResource {
  id: string;
  title: string;
  kind: "file" | "link";
  fileId: string | null;
  fileName: string | null;
  size: number | null;
  /** http(s) or an in-app path such as /sales-pages. */
  url: string;
}

export interface BuildSession {
  id: string;
  title: string;
  kind: SessionKind;
  durationMin: number;
  presenter: string;
  /** Markdown. */
  description: string;
  /** What attendees should have at the end of the session. */
  outcome: string;
  resources: SessionResource[];
  /** Discussion prompts for the future community feed; shown to members as reflection prompts. */
  prompts: string[];
}

export interface BuildMaterial {
  id: string;
  title: string;
  description: string;
  fileId: string;
  fileName: string;
  size: number;
  mime: string;
}

export type BuildChecklistPhase = "before" | "during" | "after";
export const BUILD_PHASE_LABELS: Record<BuildChecklistPhase, string> = { before: "Before the day", during: "On the day", after: "After the day" };
export const BUILD_PHASES: BuildChecklistPhase[] = ["before", "during", "after"];

export interface BuildChecklistItem {
  id: string;
  text: string;
  phase: BuildChecklistPhase;
}

export interface BuildAction {
  id: string;
  title: string;
  detail: string;
  /** Days after the Build Day it should be done by. */
  dueDays: number;
}

export type BuildFormat = "live-online" | "in-person" | "self-paced";
export const BUILD_FORMAT_LABELS: Record<BuildFormat, string> = { "live-online": "Live online", "in-person": "In person", "self-paced": "Self-paced" };

export interface BuildDay {
  id: string;
  brandId: BrandId;
  title: string;
  /** "YYYY-MM" */
  month: string;
  theme: string;
  /** Markdown: what everyone leaves with. */
  outcome: string;
  /** ISO start time. */
  startsAt: string;
  /** IANA time zone the host plans in, shown to members. */
  timezone: string;
  format: BuildFormat;
  host: string;
  /** In-person venue or practical notes. */
  location: string;
  /** External meeting link (Zoom, Meet…). No streaming is built in. */
  joinUrl: string;
  /** External recording link, added after the day. */
  replayUrl: string;
  capacity: number | null;
  status: PublishStatus;
  publishAt: string | null;
  access: AccessTier;
  coverFileId: string | null;
  agenda: BuildSession[];
  materials: BuildMaterial[];
  checklist: BuildChecklistItem[];
  actions: BuildAction[];
  /** Community participation, prepared for later (discussion feed, attendee wins). */
  community: { enabled: boolean; prompt: string };
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}
