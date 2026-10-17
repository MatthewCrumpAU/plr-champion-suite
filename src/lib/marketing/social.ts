import Papa from "papaparse";
import type { SocialCampaignData, SocialPlatform, SocialPost, SocialPostType } from "@/lib/models/marketing";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/models/marketing";
import type { PMDoc } from "@/lib/doc/types";
import { docListItems, docParagraphs, firstSentences } from "@/lib/doc/text";
import { uid } from "@/lib/utils";

/**
 * Template-based social posts repurposed from chapter content. Each post reuses the chapter's own key points;
 * nothing claims results, follower counts or testimonials.
 */
export interface SocialSource {
  title: string;
  content: PMDoc;
}

export interface SocialContext {
  productName: string;
  audience: string;
  niche: string;
  link: string;
}

const STOP = new Set("the a an and or for to of in on with your you how what why when this that from into are is be at by it its our we my as can will just more most".split(" "));

export function hashtagsFor(...texts: string[]): string[] {
  const words = texts
    .join(" ")
    .replace(/^(chapter|part|section|lesson|day|step)\s+\w+\s*[:.\-–—]\s*/gi, "")
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length >= 5 && !STOP.has(w.toLowerCase()));
  const tags = [...new Set(words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()))].slice(0, 6);
  return tags;
}

function clean(title: string) {
  return title.replace(/^(chapter|part|section|lesson|module|day|step)\s+[\w\d]+\s*[:.\-–—]\s*/i, "").trim();
}

function points(src: SocialSource, n = 3): string[] {
  const items = docListItems(src.content).filter((x) => x.length > 8 && x.length < 160);
  const sentences = docParagraphs(src.content)
    .map((p) => firstSentences(p, 1, 160))
    .filter((x) => x.length > 20);
  return [...new Set([...items, ...sentences])].slice(0, n);
}

function hook(src: SocialSource): string {
  const first = docParagraphs(src.content)[0] ?? "";
  return firstSentences(first, 1, 180) || clean(src.title);
}

export function postText(platform: SocialPlatform, type: SocialPostType, src: SocialSource | null, c: SocialContext, part?: { n: number; of: number }): string {
  const name = c.productName || "[Product name]";
  const link = c.link || "[link]";
  const t = src ? clean(src.title) : name;
  const pts = src ? points(src) : [];
  const h = src ? hook(src) : "";
  const series = part ? `(${part.n}/${part.of}) ` : "";
  if (type === "promotional") {
    switch (platform) {
      case "instagram":
        return `${series}Made for ${c.audience || "[your audience]"} 👇\n\n${name} helps you [main benefit].\n\nInside:\n• [Component 1]\n• [Component 2]\n• [Component 3]\n\nLink in bio.`;
      case "linkedin":
        return `${series}I put together ${name} for ${c.audience || "[your audience]"} who want to [main benefit].\n\nIt covers:\n→ [Component 1]\n→ [Component 2]\n→ [Component 3]\n\nDetails here: ${link}`;
      case "video-script":
        return `[HOOK] Want to [main benefit] without [common frustration]?\n[BODY] ${name} walks you through it step by step: [component 1], [component 2] and [component 3].\n[CTA] Grab it at ${link}.`;
      default:
        return `${series}If you're ${c.audience ? `one of the ${c.audience.toLowerCase()}` : "[your audience]"} trying to [main benefit], ${name} was made for you.\n\nInside you'll find [what's included].\n\nTake a look: ${link}`;
    }
  }
  if (type === "announcement") {
    switch (platform) {
      case "video-script":
        return `[HOOK] It's here — ${name}.\n[BODY] It's a [format] that helps you [main benefit]. [One detail that makes it useful.]\n[CTA] Find it at ${link}.`;
      case "instagram":
        return `It's here! ✨\n\n${name} is now available.\n\n[One-sentence description.]\n\nLink in bio.`;
      default:
        return `New: ${name} is now available.\n\n[One or two sentences about what it is and who it's for.]\n\n${link}`;
    }
  }
  if (type === "engagement") {
    return platform === "video-script" ? `[HOOK] Quick question about ${t.toLowerCase()}…\n[BODY] What's the hardest part for you — [option A] or [option B]?\n[CTA] Tell me in the comments.` : `${series}Quick question for ${c.audience ? c.audience.toLowerCase() : "you"}:\n\nWhat's your biggest challenge with ${t.toLowerCase()}?\n\n${pts[0] ? `For me it was learning that ${pts[0].charAt(0).toLowerCase()}${pts[0].slice(1).replace(/[.!]$/, "")}.\n\n` : ""}Tell me in the comments 👇`;
  }
  // educational
  switch (platform) {
    case "instagram":
      return `${series}${t} 👇\n\n${pts.map((p) => `✔️ ${p}`).join("\n") || "✔️ [Key point 1]\n✔️ [Key point 2]\n✔️ [Key point 3]"}\n\nSave this for later.`;
    case "linkedin":
      return `${series}${h}\n\nThree things that help with ${t.toLowerCase()}:\n\n${pts.map((p) => `→ ${p}`).join("\n") || "→ [Point 1]\n→ [Point 2]\n→ [Point 3]"}\n\nWhat would you add?`;
    case "video-script":
      return `[HOOK] ${h || `Here's how to get better at ${t.toLowerCase()}.`}\n[BODY] ${pts.map((p, i) => `${i + 1}. ${p}`).join(" ") || "[Point 1]. [Point 2]. [Point 3]."}\n[CTA] Follow for more tips like this${c.productName ? ` — or get the full guide, ${c.productName}` : ""}.`;
    default:
      return `${series}${h}\n\n${pts.map((p) => `✅ ${p}`).join("\n") || "✅ [Key point 1]\n✅ [Key point 2]\n✅ [Key point 3]"}\n\nWhich one will you try first?`;
  }
}

export function templatePosts(opts: { sources: SocialSource[]; platforms: SocialPlatform[]; kind: "educational" | "promotional" | "announcement" | "series" | "mixed"; count: number; context: SocialContext; seriesId?: string | null }): SocialPost[] {
  const { sources, platforms, kind, context } = opts;
  const count = Math.max(1, Math.min(60, opts.count));
  const out: SocialPost[] = [];
  const mixed: SocialPostType[] = ["educational", "engagement", "educational", "promotional"];
  for (let i = 0; i < count; i++) {
    const platform = platforms[i % platforms.length];
    const src = sources.length ? sources[i % sources.length] : null;
    const type: SocialPostType = kind === "mixed" ? mixed[i % mixed.length] : kind === "series" ? "educational" : kind;
    const part = kind === "series" ? { n: i + 1, of: count } : undefined;
    out.push({
      id: uid("post"),
      platform,
      type,
      text: postText(platform, type, src, context, part),
      hashtags: platform === "instagram" || platform === "linkedin" ? hashtagsFor(context.niche, src?.title ?? "").slice(0, platform === "instagram" ? 6 : 3) : [],
      scheduledFor: null,
      status: "draft",
      seriesId: kind === "series" ? (opts.seriesId ?? null) : null,
      linkedAssetId: null,
      source: "template",
      notes: src ? `From: ${src.title}` : "",
    });
  }
  return out;
}

/** Spreads unscheduled posts over days from `start`, `every` days apart. Returns a new list. */
export function autoSchedule(posts: SocialPost[], start: string, every: number, onlyIds?: Set<string>): SocialPost[] {
  const base = new Date(`${start}T00:00:00`);
  if (Number.isNaN(base.getTime())) return posts;
  let n = 0;
  return posts.map((p) => {
    if (p.scheduledFor || (onlyIds && !onlyIds.has(p.id))) return p;
    const d = new Date(base);
    d.setDate(d.getDate() + n * Math.max(1, every));
    n++;
    return { ...p, scheduledFor: isoDay(d), status: p.status === "idea" || p.status === "draft" ? "scheduled" : p.status };
  });
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 6×7 grid of ISO days for the calendar month containing `month` (YYYY-MM). Weeks start on Monday. */
export function monthGrid(month: string): { day: string; inMonth: boolean }[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(y, m - 1, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { day: isoDay(d), inMonth: d.getMonth() === m - 1 };
  });
}

export function socialCsv(d: SocialCampaignData): string {
  const series = new Map(d.series.map((s) => [s.id, s.name]));
  return Papa.unparse(
    [...d.posts]
      .sort((a, b) => (a.scheduledFor ?? "9999").localeCompare(b.scheduledFor ?? "9999"))
      .map((p) => ({ date: p.scheduledFor ?? "", platform: SOCIAL_PLATFORM_LABELS[p.platform], type: p.type, status: p.status, series: p.seriesId ? (series.get(p.seriesId) ?? "") : "", text: p.text, hashtags: p.hashtags.map((h) => `#${h}`).join(" "), notes: p.notes })),
  );
}

export function socialMarkdown(d: SocialCampaignData, title: string): string {
  const lines = [`# ${title}`, ""];
  for (const p of [...d.posts].sort((a, b) => (a.scheduledFor ?? "9999").localeCompare(b.scheduledFor ?? "9999"))) {
    lines.push(`## ${SOCIAL_PLATFORM_LABELS[p.platform]} · ${p.type}${p.scheduledFor ? ` · ${p.scheduledFor}` : ""}`, "", p.text, "");
    if (p.hashtags.length) lines.push(p.hashtags.map((h) => `#${h}`).join(" "), "");
  }
  return lines.join("\n");
}
