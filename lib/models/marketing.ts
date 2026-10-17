/* ------------------------------------------------------------------ */
/* Sales Page Builder                                                   */
/* ------------------------------------------------------------------ */
export type SalesSectionType =
  | "headline"
  | "subheadline"
  | "problem"
  | "introduction"
  | "benefits"
  | "features"
  | "included"
  | "bonuses"
  | "pricing"
  | "faq"
  | "cta"
  | "guarantee";

export const SALES_SECTION_LABELS: Record<SalesSectionType, string> = {
  headline: "Headline",
  subheadline: "Subheadline",
  problem: "Problem & solution",
  introduction: "Product introduction",
  benefits: "Benefits",
  features: "Features",
  included: "What's included",
  bonuses: "Bonuses",
  pricing: "Pricing",
  faq: "FAQ",
  cta: "Call to action",
  guarantee: "Guarantee",
};

export interface SalesItem {
  id: string;
  title: string;
  text: string;
}

export interface SalesSection {
  id: string;
  type: SalesSectionType;
  enabled: boolean;
  heading: string;
  subheading: string;
  body: string;
  bullets: string[];
  items: SalesItem[];
  buttonText: string;
}

export interface SalesTheme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  headingFont: string;
  bodyFont: string;
  maxWidth: number;
  rounded: boolean;
}

export interface SalesPageData {
  productName: string;
  sections: SalesSection[];
  theme: SalesTheme;
  price: { amount: number | null; currency: string; label: string; billing: string };
  checkoutUrl: string;
  brandKitId: string | null;
  coverAssetId: string | null;
  mockupAssetId: string | null;
}

/* ------------------------------------------------------------------ */
/* Email Swipe Builder                                                  */
/* ------------------------------------------------------------------ */
export type EmailSequenceType = "welcome" | "launch" | "sales" | "follow-up" | "broadcast" | "abandoned-checkout";

export const EMAIL_SEQUENCE_LABELS: Record<EmailSequenceType, string> = {
  welcome: "Welcome sequence",
  launch: "Product launch sequence",
  sales: "Sales sequence",
  "follow-up": "Follow-up sequence",
  broadcast: "Promotional broadcast",
  "abandoned-checkout": "Abandoned checkout",
};

export interface EmailItem {
  id: string;
  day: number;
  subject: string;
  altSubjects: string[];
  preview: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  notes: string;
}

export interface EmailCampaignData {
  sequenceType: EmailSequenceType;
  goal: string;
  fromName: string;
  defaultCtaUrl: string;
  emails: EmailItem[];
}

/* ------------------------------------------------------------------ */
/* Social Content Creator                                               */
/* ------------------------------------------------------------------ */
export type SocialPlatform = "facebook" | "instagram" | "linkedin" | "video-script";
export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  "video-script": "Short video script",
};
export type SocialPostType = "educational" | "promotional" | "announcement" | "engagement";

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  type: SocialPostType;
  text: string;
  hashtags: string[];
  scheduledFor: string | null;
  status: "idea" | "draft" | "scheduled" | "posted";
  seriesId: string | null;
  linkedAssetId: string | null;
  source: "template" | "ai" | "manual";
  notes: string;
}

export interface SocialSeries {
  id: string;
  name: string;
  color: string;
}

export interface SocialCampaignData {
  posts: SocialPost[];
  series: SocialSeries[];
}

/* ------------------------------------------------------------------ */
/* Product Name Generator                                               */
/* ------------------------------------------------------------------ */
export type NameCategory = "product-title" | "subtitle" | "tagline" | "offer-name" | "bundle-name" | "course-name" | "lead-magnet-name";

export const NAME_CATEGORY_LABELS: Record<NameCategory, string> = {
  "product-title": "Product titles",
  subtitle: "Subtitles",
  tagline: "Taglines",
  "offer-name": "Offer names",
  "bundle-name": "Bundle names",
  "course-name": "Course names",
  "lead-magnet-name": "Lead magnet names",
};

export interface NameIdea {
  id: string;
  category: NameCategory;
  name: string;
  note: string;
  favourite: boolean;
  source: "template" | "ai" | "manual";
  appliedTo: string | null;
  createdAt: string;
}

export interface NameIdeasData {
  topic: string;
  audience: string;
  outcome: string;
  format: string;
  ideas: NameIdea[];
}
