/**
 * Membership data model (PLR Champion, PLRforIM — and later PLR Profit Lab).
 *
 * Every record carries a `brandId` so brands keep separate libraries, categories, releases and
 * customer access while sharing one codebase. Each interface maps 1:1 to a future Supabase table
 * (see docs/DATABASE-MIGRATION.md → "Membership tables"); ids are opaque strings and all dates are ISO.
 */

export type BrandId = "plr-champion" | "plrforim";
export const BRAND_IDS: BrandId[] = ["plr-champion", "plrforim"];

/** Access tiers inside a brand. Higher tiers include everything below them. */
export type AccessTier = "free" | "member" | "premium";
export const ACCESS_TIERS: AccessTier[] = ["free", "member", "premium"];
export const ACCESS_TIER_LABELS: Record<AccessTier, string> = { free: "Free", member: "Member", premium: "Premium" };

export type PublishStatus = "draft" | "scheduled" | "published" | "archived";
export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = { draft: "Draft", scheduled: "Scheduled", published: "Published", archived: "Archived" };

export interface Category {
  id: string;
  brandId: BrandId;
  name: string;
  slug: string;
  description: string;
  /** Lucide icon name from CATEGORY_ICONS. */
  icon: string;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Rights granted by a PLR licence. "unclear" means the licence doesn't say — never assumed. */
export type RightValue = "yes" | "no" | "conditional" | "unclear";
export const RIGHT_VALUE_LABELS: Record<RightValue, string> = { yes: "Allowed", no: "Not allowed", conditional: "Conditions apply", unclear: "Not stated" };

export type LicenceType = "plr" | "mrr" | "rr" | "personal";
export const LICENCE_TYPE_LABELS: Record<LicenceType, string> = { plr: "Private Label Rights", mrr: "Master Resell Rights", rr: "Resell Rights", personal: "Personal use only" };

export const LICENCE_RIGHTS = [
  ["edit", "Edit and rebrand the content"],
  ["claimAuthorship", "Put your name on it as author"],
  ["sell", "Sell the finished product"],
  ["giveAway", "Give it away (e.g. as a lead magnet)"],
  ["useAsBonus", "Use it as a bonus"],
  ["addToMembership", "Add it to a paid membership"],
  ["sellPlr", "Sell the PLR rights to others"],
  ["breakUp", "Break it into articles, emails or posts"],
] as const;
export type LicenceRightKey = (typeof LICENCE_RIGHTS)[number][0];

export interface Licence {
  type: LicenceType;
  rights: Record<LicenceRightKey, RightValue>;
  /** Free-text conditions (minimum prices, prohibited platforms…). */
  terms: string;
  /** Optional attached licence document. */
  fileId: string | null;
}

export type ProductFileKind = "ebook" | "workbook" | "checklist" | "graphics" | "audio" | "video" | "sales" | "licence" | "package" | "other";
export const PRODUCT_FILE_KIND_LABELS: Record<ProductFileKind, string> = {
  ebook: "Ebook",
  workbook: "Workbook",
  checklist: "Checklist",
  graphics: "Graphics",
  audio: "Audio",
  video: "Video",
  sales: "Sales materials",
  licence: "Licence",
  package: "Complete package",
  other: "Other",
};

export interface ProductAttachment {
  id: string;
  fileId: string;
  name: string;
  kind: ProductFileKind;
  size: number;
  mime: string;
  /** True when this file can be opened in the PLR Editor (DOCX, PDF, TXT, MD, HTML). */
  editable: boolean;
}

export type ProductFormat = "ebook" | "course" | "workbook" | "checklist" | "templates" | "graphics" | "bundle" | "articles" | "emails" | "other";
export const PRODUCT_FORMAT_LABELS: Record<ProductFormat, string> = {
  ebook: "Ebook",
  course: "Mini-course",
  workbook: "Workbook",
  checklist: "Checklist",
  templates: "Templates",
  graphics: "Graphics pack",
  bundle: "Bundle",
  articles: "Article pack",
  emails: "Email swipes",
  other: "Other",
};

export interface Product {
  id: string;
  brandId: BrandId;
  slug: string;
  title: string;
  subtitle: string;
  /** Markdown. */
  description: string;
  /** Bullet points shown on the preview page. */
  highlights: string[];
  format: ProductFormat;
  categoryIds: string[];
  tags: string[];
  coverFileId: string | null;
  galleryFileIds: string[];
  files: ProductAttachment[];
  licence: Licence;
  wordCount: number | null;
  pageCount: number | null;
  /** Monthly drop this product belongs to. */
  releaseId: string | null;
  access: AccessTier;
  status: PublishStatus;
  /** Visible to members from this moment (status "scheduled" or "published"). */
  publishAt: string | null;
  featured: boolean;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Release {
  id: string;
  brandId: BrandId;
  title: string;
  /** "YYYY-MM" */
  month: string;
  theme: string;
  /** Markdown. */
  description: string;
  productIds: string[];
  coverFileId: string | null;
  status: PublishStatus;
  publishAt: string | null;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LessonType = "article" | "video" | "download" | "checklist";
export const LESSON_TYPE_LABELS: Record<LessonType, string> = { article: "Article", video: "Video", download: "Download", checklist: "Checklist" };

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  /** Markdown body. For checklists, each "- " line is a tickable item. */
  body: string;
  /** External video URL (YouTube/Vimeo/Loom). No streaming infrastructure is bundled. */
  videoUrl: string;
  durationMin: number;
  /** Stored files offered with the lesson. */
  attachments: { fileId: string; name: string; size: number }[];
}

export interface CourseModule {
  id: string;
  title: string;
  lessons: Lesson[];
}

export type CourseKind = "course" | "tutorial";
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export interface Course {
  id: string;
  brandId: BrandId;
  kind: CourseKind;
  title: string;
  summary: string;
  level: CourseLevel;
  /** Studio tool this tutorial teaches, e.g. "editor" — shown as a "Try it" button. */
  toolHint: string | null;
  coverFileId: string | null;
  modules: CourseModule[];
  access: AccessTier;
  status: PublishStatus;
  order: number;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ResourceType = "template" | "checklist" | "swipe" | "tool" | "guide" | "link";
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = { template: "Template", checklist: "Checklist", swipe: "Swipe file", tool: "Tool", guide: "Guide", link: "Link" };

export interface Resource {
  id: string;
  brandId: BrandId;
  title: string;
  description: string;
  type: ResourceType;
  fileId: string | null;
  fileName: string | null;
  fileSize: number | null;
  /** http(s) only. */
  url: string;
  access: AccessTier;
  status: PublishStatus;
  order: number;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One file (or bundle) a member downloaded. Powers "My Downloads" and re-downloads. */
export interface DownloadRecord {
  id: string;
  brandId: BrandId;
  memberId: string;
  productId: string | null;
  productTitle: string;
  /** Attachment id, or "bundle" for a ZIP built by the Download Manager. */
  attachmentId: string;
  fileName: string;
  size: number;
  kind: "file" | "bundle" | "resource" | "lesson";
  createdAt: string;
}

export interface LessonProgress {
  /** `${memberId}:${courseId}:${lessonId}` */
  id: string;
  brandId: BrandId;
  memberId: string;
  courseId: string;
  lessonId: string;
  completedAt: string | null;
  /** Ticked checklist item indexes. */
  checked: number[];
  updatedAt: string;
}

export interface Favourite {
  /** `${memberId}:${productId}` */
  id: string;
  brandId: BrandId;
  memberId: string;
  productId: string;
  createdAt: string;
}

/** A stored binary (cover, product file, licence, lesson attachment). */
export interface MemberFile {
  id: string;
  brandId: BrandId | null;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

/**
 * Customer account model, prepared for later. In private testing there is exactly one account (the
 * owner) and no live sign-up or cross-brand authentication. `brandAccess` and `linkedAccountIds`
 * let a future bundle purchase grant access to both brands through linked accounts.
 */
export interface MemberAccount {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "member";
  /** Per-brand access level; a brand that isn't listed has no access. */
  brandAccess: Partial<Record<BrandId, AccessTier>>;
  /** Accounts on other brands that belong to the same person (bundle purchasers). */
  linkedAccountIds: string[];
  /** Where the account came from — "owner" now; later a purchase or bundle. */
  source: "owner" | "purchase" | "bundle" | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface KV<T = unknown> {
  key: string;
  value: T;
}
