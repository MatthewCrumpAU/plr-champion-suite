import type { Chapter } from "@/lib/models/document";
import type { DocumentStats, FunnelRole, Opportunity } from "@/lib/models/product";
import { docHeadings, docListItems, docParagraphs, docWords, firstSentences, walk } from "@/lib/doc/text";
import { toAction } from "./builders";
import { normalizeTitle, uid } from "@/lib/utils";

/**
 * Structural analysis of a PLR document and rule-based repurposing ideas.
 * Everything here is derived from the content's structure (chapters, lists, action steps…). Price ranges and fit
 * scores are planning estimates only and are labelled as such in the UI — they are not market research.
 */

interface ChapterSignals {
  id: string;
  title: string;
  words: number;
  actions: number;
  questions: number;
  listItems: number;
  howTo: number;
}

function sentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+/g) ?? [];
}

export function chapterSignals(c: Chapter): ChapterSignals {
  const paras = docParagraphs(c.content);
  const items = docListItems(c.content);
  const heads = docHeadings(c.content);
  const sents = paras.flatMap(sentences);
  const actions = new Set([...items, ...sents].map((x) => toAction(x)).filter(Boolean)).size;
  return {
    id: c.id,
    title: c.title,
    words: docWords(c.content),
    actions,
    questions: sents.filter((x) => x.trim().endsWith("?")).length,
    listItems: items.length,
    howTo: heads.filter((h) => /^how to\b/i.test(h.text)).length + (/^how to\b/i.test(c.title) ? 1 : 0),
  };
}

export function documentStats(chapters: Chapter[]): DocumentStats {
  const sig = chapters.map(chapterSignals);
  let tables = 0;
  let headings = 0;
  for (const c of chapters)
    walk(c.content, (n) => {
      if (n.type === "table") tables++;
      if (n.type === "heading") headings++;
    });
  return {
    chapters: chapters.length,
    words: sig.reduce((n, s) => n + s.words, 0),
    headings,
    listItems: sig.reduce((n, s) => n + s.listItems, 0),
    actionSteps: sig.reduce((n, s) => n + s.actions, 0),
    questions: sig.reduce((n, s) => n + s.questions, 0),
    tables,
    howToHeadings: sig.reduce((n, s) => n + s.howTo, 0),
  };
}

/** "The Calm Productivity Blueprint" → "Calm Productivity". */
export function coreTopic(title: string): string {
  let t = title.replace(/^sample\s*[—-]\s*/i, "").replace(/\s*[—:|-].*$/, "").trim();
  t = t.replace(/^(the|a|an|your|my)\s+/i, "");
  t = t.replace(/\s+(blueprint|guide|handbook|ebook|e-book|book|report|system|formula|method|secrets|playbook|manual|course|bible|masterclass|toolkit|kit|plan|program|programme)$/i, "");
  return t.trim() || title.trim();
}

const clampRating = (n: number) => Math.max(1, Math.min(5, Math.round(n * 2) / 2));

function topChapters(sig: ChapterSignals[], key: (s: ChapterSignals) => number, n: number): string[] {
  return [...sig].sort((a, b) => key(b) - key(a)).slice(0, n).map((s) => s.id);
}

function make(o: Omit<Opportunity, "id" | "origin" | "builtAssetId" | "dismissed">): Opportunity {
  return { ...o, id: uid("opp"), origin: "analysis", builtAssetId: null, dismissed: false };
}

/** Rule-based opportunities from the document's structure. */
export function analyseOpportunities(input: { title: string; audience: string; chapters: Chapter[] }): { stats: DocumentStats; opportunities: Opportunity[] } {
  const { chapters } = input;
  const stats = documentStats(chapters);
  const sig = chapters.map(chapterSignals);
  const topic = coreTopic(input.title);
  const aud = input.audience.trim().replace(/\.$/, "");
  const who = aud ? (/^[A-Z][a-z]/.test(aud) ? aud[0].toLowerCase() + aud.slice(1) : aud) : "your audience";
  const all = chapters.map((c) => c.id);
  const out: Opportunity[] = [];
  const nCh = stats.chapters;

  if (stats.actionSteps >= 5) {
    out.push(
      make({
        format: "checklist",
        name: `The ${topic} Checklist`,
        sourceChapterIds: topChapters(sig, (s) => s.actions, Math.min(nCh, 6)),
        complexity: "low",
        positioning: `A one-page, tick-as-you-go checklist that helps ${who} put the main ideas into action today.`,
        funnelRole: "lead-magnet",
        priceLow: 0,
        priceHigh: 0,
        rating: clampRating(2.5 + Math.min(2.5, stats.actionSteps / 12)),
        rationale: `Found ${stats.actionSteps} action-style steps across ${nCh} chapters — enough to fill a practical checklist quickly.`,
      }),
    );
  }
  if (nCh >= 3) {
    const reflective = stats.questions + stats.actionSteps;
    out.push(
      make({
        format: "workbook",
        name: `The ${topic} Workbook`,
        sourceChapterIds: all,
        complexity: "medium",
        positioning: `A fill-in workbook that walks ${who} through each chapter with prompts and an action table — sold alongside or instead of the ebook.`,
        funnelRole: "order-bump",
        priceLow: 9,
        priceHigh: 27,
        rating: clampRating(2.5 + Math.min(1.5, nCh / 6) + Math.min(1, reflective / 30)),
        rationale: `${nCh} chapters give a natural worksheet per chapter; ${reflective} questions and action steps can become prompts.`,
      }),
    );
  }
  if (nCh >= 4 && stats.words >= 2500) {
    out.push(
      make({
        format: "mini-course",
        name: `${topic} Mini-Course`,
        sourceChapterIds: all,
        complexity: "high",
        positioning: `A ${Math.min(nCh, 7)}-lesson course version for ${who} who prefer guided lessons with assignments.`,
        funnelRole: "upsell",
        priceLow: 27,
        priceHigh: 97,
        rating: clampRating(2 + Math.min(2, stats.words / 6000) + (stats.actionSteps > 10 ? 0.5 : 0)),
        rationale: `${stats.words.toLocaleString()} words over ${nCh} chapters is enough material for a short lesson series. Recording video or audio would add work (higher complexity).`,
      }),
    );
  }
  if (nCh >= 3) {
    out.push(
      make({
        format: "email-course",
        name: `${Math.min(nCh, 7)} Days to ${topic}`,
        sourceChapterIds: all.slice(0, 7),
        complexity: "low",
        positioning: `A free ${Math.min(nCh, 7)}-day email course that delivers one idea per day and introduces your paid product.`,
        funnelRole: "lead-magnet",
        priceLow: 0,
        priceHigh: 0,
        rating: clampRating(3 + (nCh >= 5 ? 1 : 0.5)),
        rationale: `Each chapter can become one short email, so it doubles as a nurture sequence for the main product.`,
      }),
    );
  }
  if (stats.actionSteps >= 7 && nCh >= 5) {
    const days = nCh >= 7 ? 7 : 5;
    out.push(
      make({
        format: "challenge",
        name: `The ${days}-Day ${topic} Challenge`,
        sourceChapterIds: topChapters(sig, (s) => s.actions, days),
        complexity: "medium",
        positioning: `A ${days}-day challenge with one small task a day — good for building an engaged list or a paid challenge with community.`,
        funnelRole: "front-end",
        priceLow: 0,
        priceHigh: 27,
        rating: clampRating(2.5 + Math.min(2, stats.actionSteps / 15)),
        rationale: `${stats.actionSteps} concrete actions can be spread into one task per day.`,
      }),
    );
  }
  out.push(
    make({
      format: "cheat-sheet",
      name: `${topic} Cheat Sheet`,
      sourceChapterIds: all,
      complexity: "low",
      positioning: `A compact summary of the key points — a quick bonus that makes the main product feel more complete.`,
      funnelRole: "bonus",
      priceLow: 0,
      priceHigh: 0,
      rating: clampRating(2.5 + Math.min(1.5, stats.headings / 15) + Math.min(1, stats.listItems / 25)),
      rationale: `${stats.headings} headings and ${stats.listItems} list items can be condensed into a one-page reference.`,
    }),
  );
  if (stats.howToHeadings >= 2 || stats.actionSteps >= 10) {
    out.push(
      make({
        format: "quick-start-guide",
        name: `${topic} Quick-Start Guide`,
        sourceChapterIds: topChapters(sig, (s) => s.howTo * 3 + s.actions, Math.min(nCh, 5)),
        complexity: "low",
        positioning: `The fastest path to a first result — a short guide for ${who} who want to start today.`,
        funnelRole: "bonus",
        priceLow: 0,
        priceHigh: 0,
        rating: clampRating(2.5 + Math.min(1.5, stats.howToHeadings / 3) + Math.min(1, stats.actionSteps / 20)),
        rationale: stats.howToHeadings ? `${stats.howToHeadings} “how to” sections suggest a step-by-step format.` : `${stats.actionSteps} action steps can be ordered into quick-start steps.`,
      }),
    );
  }
  if (nCh >= 3) {
    const top = topChapters(sig, (s) => s.actions * 2 + s.listItems, Math.min(3, nCh));
    out.push(
      make({
        format: "short-report",
        name: `${Math.min(nCh, 5)} ${topic} Mistakes (and What to Do Instead)`,
        sourceChapterIds: top,
        complexity: "low",
        positioning: `A short free report built from the most practical chapters — a low-effort opt-in incentive.`,
        funnelRole: "lead-magnet",
        priceLow: 0,
        priceHigh: 0,
        rating: clampRating(3),
        rationale: `The three most practical chapters (${sig.filter((s) => top.includes(s.id)).map((s) => `“${s.title}”`).join(", ")}) can stand alone as a sampler.`,
      }),
    );
  }
  if (stats.listItems + stats.tables * 5 >= 15 || stats.actionSteps >= 15) {
    out.push(
      make({
        format: "toolkit",
        name: `The ${topic} Toolkit`,
        sourceChapterIds: all,
        complexity: "medium",
        positioning: `Checklists, planners and quick references in one pack — an upsell for buyers who want to implement faster.`,
        funnelRole: "upsell",
        priceLow: 17,
        priceHigh: 47,
        rating: clampRating(2 + Math.min(2, (stats.listItems + stats.tables * 5) / 30) + Math.min(1, stats.actionSteps / 30)),
        rationale: `${stats.listItems} list items and ${stats.tables} tables convert naturally into practical tools.`,
      }),
    );
  }
  if (stats.words >= 6000 && nCh >= 5) {
    out.push(
      make({
        format: "membership-module",
        name: `${topic} — Membership Module`,
        sourceChapterIds: all,
        complexity: "medium",
        positioning: `A self-contained module for a membership site, with lessons, exercises and discussion prompts.`,
        funnelRole: "membership",
        priceLow: 9,
        priceHigh: 29,
        rating: clampRating(2 + Math.min(2, stats.words / 12000)),
        rationale: `${stats.words.toLocaleString()} words is enough depth for a month of membership content.`,
      }),
    );
  }
  out.push(
    make({
      format: "ebook",
      name: `${input.title.replace(/^sample\s*[—-]\s*/i, "")} (rebranded edition)`,
      sourceChapterIds: all,
      complexity: stats.words > 15000 ? "medium" : "low",
      positioning: `The core product, rebranded in your voice, as the front-end offer of the funnel.`,
      funnelRole: "front-end",
      priceLow: 7,
      priceHigh: 27,
      rating: clampRating(3 + (stats.words > 4000 ? 0.5 : 0)),
      rationale: `The full document is the natural front-end product once it has been rewritten and rebranded.`,
    }),
  );
  return { stats, opportunities: out };
}

/** Converts an AI suggestion (parsed JSON) into an Opportunity, matching chapter titles to ids. */
export function opportunityFromAI(raw: unknown, chapters: Chapter[]): Opportunity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name ?? "").trim();
  const format = String(r.format ?? "").trim();
  if (!name || !format) return null;
  const roles: FunnelRole[] = ["lead-magnet", "front-end", "order-bump", "upsell", "downsell", "bonus", "membership"];
  const funnelRole = roles.includes(r.funnelRole as FunnelRole) ? (r.funnelRole as FunnelRole) : "front-end";
  const titles = Array.isArray(r.sourceChapters) ? (r.sourceChapters as unknown[]).map((x) => normalizeTitle(String(x))) : [];
  const ids = chapters.filter((c) => titles.some((t) => t && (normalizeTitle(c.title) === t || normalizeTitle(c.title).includes(t) || t.includes(normalizeTitle(c.title))))).map((c) => c.id);
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  const lo = num(r.priceLow);
  const hi = Math.max(lo, num(r.priceHigh));
  const complexity = ["low", "medium", "high"].includes(String(r.complexity)) ? (r.complexity as Opportunity["complexity"]) : "medium";
  return {
    id: uid("opp"),
    format,
    name: name.slice(0, 200),
    sourceChapterIds: ids.length ? ids : chapters.map((c) => c.id),
    complexity,
    positioning: String(r.positioning ?? "").slice(0, 600),
    funnelRole,
    priceLow: lo,
    priceHigh: hi,
    rating: 0,
    rationale: String(r.rationale ?? "").slice(0, 800),
    origin: "ai",
    builtAssetId: null,
    dismissed: false,
  };
}

/** One-line chapter summaries for the AI prompt. */
export function chapterSummaries(chapters: Chapter[]): { title: string; summary: string }[] {
  return chapters.slice(0, 80).map((c) => ({ title: c.title.slice(0, 300), summary: firstSentences(docParagraphs(c.content).slice(0, 3).join(" "), 2, 400) }));
}
