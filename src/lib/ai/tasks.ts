import { z } from "zod";

/**
 * AI task catalogue — shared by browser and server.
 * The browser sends { task, input }. The server validates `input` with the schema below and builds the
 * prompt server-side (see prompts.ts), so prompts and keys never live in the browser bundle.
 */

const s = (max: number) => z.string().max(max).default("");

export const BriefSchema = z
  .object({
    productName: s(200),
    originalName: s(200),
    niche: s(300),
    audience: s(600),
    promise: s(600),
    voice: s(600),
    author: s(200),
    positioning: s(1200),
    description: s(3000),
    price: s(60),
    website: s(200),
  })
  .partial()
  .default({});
export type Brief = z.infer<typeof BriefSchema>;

export const WRITER_CREATE_TOOLS = [
  "article",
  "ebook-chapter",
  "blog-post",
  "course-lesson",
  "product-description",
  "checklist",
  "workbook",
  "introduction",
  "conclusion",
] as const;

export const WRITER_TRANSFORM_TOOLS = ["expand", "shorten", "tone", "audience", "clarity", "examples", "action-steps"] as const;

export const OUTLINE_TYPES = ["ebook", "report", "guide", "workbook", "course", "mini-course", "email-course", "challenge", "membership-lesson"] as const;

export const BUILD_FORMATS = [
  // Product Builder
  "ebook",
  "short-guide",
  "workbook",
  "checklist",
  "mini-course",
  "email-course",
  "challenge",
  "membership-module",
  "toolkit",
  // Bonus Builder
  "action-plan",
  "worksheet",
  "resource-list",
  "quick-start-guide",
  "template",
  "cheat-sheet",
  "implementation-plan",
  // Lead magnets
  "short-report",
  "resource-guide",
  "mini-email-course",
  "quick-start-plan",
] as const;
export type BuildFormat = (typeof BUILD_FORMATS)[number];

export const SALES_SECTIONS = ["headline", "subheadline", "problem", "introduction", "benefits", "features", "included", "bonuses", "pricing", "faq", "cta", "guarantee"] as const;
export const EMAIL_SEQUENCES = ["welcome", "launch", "sales", "follow-up", "broadcast", "abandoned-checkout"] as const;
export const SOCIAL_PLATFORMS = ["facebook", "instagram", "linkedin", "video-script"] as const;
export const SOCIAL_KINDS = ["educational", "promotional", "announcement", "series", "mixed"] as const;
export const NAME_CATEGORIES = ["product-title", "subtitle", "tagline", "offer-name", "bundle-name", "course-name", "lead-magnet-name"] as const;
export const NICHE_KINDS = ["needs", "problems", "ideas", "personas", "content"] as const;
export const KEYWORD_KINDS = ["long-tail", "question", "product", "topic"] as const;

const text = (max = 60_000) => z.string().max(max, `Text is too long (limit ${max.toLocaleString()} characters). Select less content.`);

export const TaskSchemas = {
  "writer.create": z.object({
    tool: z.enum(WRITER_CREATE_TOOLS),
    topic: z.string().min(2, "Enter a topic.").max(400),
    audience: s(400),
    tone: s(200),
    length: z.enum(["short", "medium", "long"]).default("medium"),
    keyPoints: s(4000),
    sourceText: text(60_000).default(""),
    extra: s(2000),
    brief: BriefSchema,
  }),
  "writer.transform": z.object({
    tool: z.enum(WRITER_TRANSFORM_TOOLS),
    text: text(60_000).min(20, "Select or paste at least a sentence to work on."),
    tone: s(200),
    audience: s(400),
    extra: s(2000),
    brief: BriefSchema,
  }),
  "rebrand.rewrite": z.object({
    chapterTitle: s(300),
    text: text(60_000).min(1),
    level: z.enum(["light", "moderate", "full"]).default("moderate"),
    extra: s(2000),
    brief: BriefSchema,
  }),
  "outline.create": z.object({
    type: z.enum(OUTLINE_TYPES),
    topic: z.string().min(2, "Enter a topic.").max(400),
    audience: s(400),
    promise: s(400),
    units: z.number().int().min(1).max(60).default(7),
    sectionsPerUnit: z.number().int().min(0).max(12).default(3),
    notes: s(3000),
    brief: BriefSchema,
  }),
  "product.build": z.object({
    format: z.enum(BUILD_FORMATS),
    title: z.string().min(1).max(300),
    audience: s(400),
    units: z.number().int().min(1).max(60).default(5),
    sourceText: text(90_000).default(""),
    extra: s(3000),
    brief: BriefSchema,
  }),
  "opportunity.scan": z.object({
    title: s(300),
    niche: s(300),
    audience: s(400),
    chapters: z.array(z.object({ title: z.string().max(300), summary: z.string().max(1500) })).max(80),
    brief: BriefSchema,
  }),
  "research.niche": z.object({
    kind: z.enum(NICHE_KINDS),
    niche: z.string().min(2, "Enter a niche.").max(300),
    audience: s(400),
    existing: z.array(z.string().max(300)).max(100).default([]),
    notes: s(3000),
    count: z.number().int().min(1).max(20).default(8),
  }),
  "research.keywords": z.object({
    seed: z.string().min(2, "Enter a seed keyword.").max(200),
    niche: s(300),
    audience: s(400),
    kinds: z.array(z.enum(KEYWORD_KINDS)).min(1).max(4),
    count: z.number().int().min(5).max(80).default(30),
    existing: z.array(z.string().max(200)).max(500).default([]),
  }),
  "marketing.sales": z.object({
    section: z.enum(SALES_SECTIONS),
    included: z.array(z.string().max(300)).max(40).default([]),
    bonuses: z.array(z.string().max(300)).max(20).default([]),
    current: s(6000),
    extra: s(2000),
    brief: BriefSchema,
  }),
  "marketing.emails": z.object({
    sequence: z.enum(EMAIL_SEQUENCES),
    count: z.number().int().min(1).max(14).default(5),
    ctaUrl: s(500),
    extra: s(2000),
    brief: BriefSchema,
  }),
  "marketing.social": z.object({
    platforms: z.array(z.enum(SOCIAL_PLATFORMS)).min(1),
    kind: z.enum(SOCIAL_KINDS).default("mixed"),
    count: z.number().int().min(1).max(30).default(6),
    sourceText: text(30_000).default(""),
    extra: s(2000),
    brief: BriefSchema,
  }),
  "marketing.names": z.object({
    category: z.enum(NAME_CATEGORIES),
    topic: z.string().min(2, "Enter a topic.").max(300),
    audience: s(400),
    outcome: s(400),
    format: s(100),
    style: s(200),
    count: z.number().int().min(3).max(40).default(15),
    avoid: z.array(z.string().max(200)).max(200).default([]),
  }),
  "test.ping": z.object({}).default({}),
} as const;

export type AITaskId = keyof typeof TaskSchemas;
export type AITaskInput<T extends AITaskId> = z.input<(typeof TaskSchemas)[T]>;
export type AITaskParsed<T extends AITaskId> = z.output<(typeof TaskSchemas)[T]>;

export const AIGenerateBody = z.object({
  task: z.enum(Object.keys(TaskSchemas) as [AITaskId, ...AITaskId[]]),
  input: z.unknown(),
  model: z.string().max(100).optional(),
});

export const TASK_LABELS: Record<AITaskId, string> = {
  "writer.create": "AI Writer",
  "writer.transform": "AI Writer — transform",
  "rebrand.rewrite": "Rebrand rewrite",
  "outline.create": "Outline",
  "product.build": "Product builder",
  "opportunity.scan": "Opportunity scan",
  "research.niche": "Niche research",
  "research.keywords": "Keyword ideas",
  "marketing.sales": "Sales page section",
  "marketing.emails": "Email sequence",
  "marketing.social": "Social posts",
  "marketing.names": "Name ideas",
  "test.ping": "Connection test",
};
