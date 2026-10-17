import type { PMDoc, PMNode } from "@/lib/doc/types";
import { B } from "@/lib/doc/build";
import { docHeadings, docListItems, docParagraphs, firstSentences, nodeText } from "@/lib/doc/text";
import { deepClone } from "@/lib/utils";
import type { BuildFormat } from "@/lib/ai/tasks";

/**
 * Template builders: restructure selected source chapters into a new product format without AI.
 * They reuse the source's own headings, lists and sentences, so the result is a real, editable first draft —
 * the UI tells the user to rewrite reused wording (or run it through the Rebrand Assistant / AI) before selling.
 */

export type BuilderKind = "product" | "bonus" | "lead-magnet";

export interface FormatInfo {
  format: BuildFormat;
  label: string;
  description: string;
  unitLabel: string;
  defaultUnits: number;
  /** Document chapter label for the created document. */
  chapterLabel: string;
}

const F = (format: BuildFormat, label: string, description: string, unitLabel: string, defaultUnits: number, chapterLabel = "Section"): FormatInfo => ({ format, label, description, unitLabel, defaultUnits, chapterLabel });

export const BUILDER_FORMATS: Record<BuilderKind, FormatInfo[]> = {
  product: [
    F("ebook", "Ebook", "Full chapters with key takeaways and action steps.", "chapters", 6, "Chapter"),
    F("short-guide", "Short guide", "A concise, skimmable guide built from the key points.", "sections", 5),
    F("workbook", "Workbook", "Worksheets with teaching notes, reflection prompts and action tables.", "worksheets", 5, "Worksheet"),
    F("checklist", "Checklist", "Grouped, verb-first checklist items.", "groups", 5, "Group"),
    F("mini-course", "Mini-course", "Lessons with objectives, content, recap and an assignment.", "lessons", 5, "Lesson"),
    F("email-course", "Email course", "One email per lesson with a subject line and a next step.", "emails", 5, "Email"),
    F("challenge", "Challenge", "A day-by-day challenge with a task and reflection each day.", "days", 7, "Day"),
    F("membership-module", "Membership module", "Lessons with exercises and community discussion prompts.", "lessons", 4, "Lesson"),
    F("toolkit", "Digital toolkit", "Ready-to-use checklists, quick references and planners.", "tools", 5, "Tool"),
  ],
  bonus: [
    F("action-plan", "Action plan", "Phases with numbered actions, outcomes and a timeline.", "phases", 4, "Phase"),
    F("worksheet", "Worksheet", "Prompts with answer lines for the reader to fill in.", "sections", 4),
    F("resource-list", "Resource list", "Categories of resources to look for and how to choose them.", "categories", 5, "Category"),
    F("quick-start-guide", "Quick-start guide", "Numbered steps to get a first result fast.", "steps", 5, "Step"),
    F("checklist", "Checklist", "Grouped, verb-first checklist items.", "groups", 4, "Group"),
    F("template", "Templates", "Fill-in templates with [placeholders].", "templates", 4, "Template"),
    F("cheat-sheet", "Cheat sheet", "Compact key points and reminders.", "blocks", 5, "Block"),
    F("implementation-plan", "Implementation plan", "Weeks with tasks, a milestone and a checkpoint.", "weeks", 4, "Week"),
  ],
  "lead-magnet": [
    F("short-report", "Short PDF report", "Quick insights, each ending with a small next step.", "insights", 5, "Insight"),
    F("checklist", "Checklist", "A one-glance checklist people can use today.", "groups", 3, "Group"),
    F("resource-guide", "Resource guide", "Categories of tools and resources and how to evaluate them.", "categories", 4, "Category"),
    F("mini-email-course", "Mini email course", "A short email series delivering quick wins.", "emails", 3, "Email"),
    F("worksheet", "Worksheet", "A focused worksheet with prompts and answer lines.", "sections", 3),
    F("quick-start-plan", "Quick-start plan", "A few days or steps, each with one concrete task.", "days", 5, "Day"),
  ],
};

export const BUILDER_KIND_LABELS: Record<BuilderKind, { tool: string; noun: string; role: "product" | "bonus" | "lead-magnet" }> = {
  product: { tool: "Product Builder", noun: "product", role: "product" },
  bonus: { tool: "Bonus Builder", noun: "bonus", role: "bonus" },
  "lead-magnet": { tool: "Lead Magnet Creator", noun: "lead magnet", role: "lead-magnet" },
};

export function formatInfo(kind: BuilderKind, format: string): FormatInfo {
  return BUILDER_FORMATS[kind].find((f) => f.format === format) ?? BUILDER_FORMATS[kind][0];
}

/** Which builder suits a format (used by the Opportunity Scanner hand-off). */
export function kindForFormat(format: string, funnelRole?: string): BuilderKind {
  if (funnelRole === "lead-magnet" && BUILDER_FORMATS["lead-magnet"].some((f) => f.format === format)) return "lead-magnet";
  if ((funnelRole === "bonus" || funnelRole === "order-bump") && BUILDER_FORMATS.bonus.some((f) => f.format === format)) return "bonus";
  if (BUILDER_FORMATS.product.some((f) => f.format === format)) return "product";
  if (BUILDER_FORMATS.bonus.some((f) => f.format === format)) return "bonus";
  if (BUILDER_FORMATS["lead-magnet"].some((f) => f.format === format)) return "lead-magnet";
  return "product";
}

export interface SourceChapter {
  id: string;
  title: string;
  content: PMDoc;
}

export interface BuildInput {
  kind: BuilderKind;
  format: BuildFormat;
  title: string;
  audience: string;
  units: number;
  author?: string;
  sources: SourceChapter[];
}

export interface BuiltDocument {
  title: string;
  subtitle: string;
  chapters: { title: string; content: PMDoc }[];
}

/* ------------------------------------------------------------------ */
/* Source analysis                                                      */
/* ------------------------------------------------------------------ */
interface Section {
  title: string;
  blocks: PMNode[];
  paragraphs: string[];
  listItems: string[];
  headings: string[];
  sentences: string[];
  actions: string[];
}

const ACTION_VERBS =
  "add|ask|avoid|batch|begin|block|book|build|calculate|celebrate|check|choose|clear|close|collect|commit|compare|create|decide|define|delete|draft|drink|eat|end|estimate|find|finish|fix|focus|follow|get|give|go|identify|keep|label|launch|learn|limit|list|look|make|map|mark|measure|move|name|note|open|organise|organize|pick|plan|post|practise|practice|prepare|prioritise|prioritize|protect|put|read|record|reduce|reflect|remove|repeat|replace|review|reward|rewrite|run|save|schedule|send|set|share|silence|sort|spend|start|stop|switch|take|tell|test|track|try|turn|update|use|walk|write";
const ACTION_START = new RegExp(`^(${ACTION_VERBS})\\b`, "i");
const SHOULD_RE = /\b(?:you should|you need to|try to|make sure (?:to|you)|remember to|it helps to)\s+([^.!?]+)/i;

function sentencesOf(text: string): string[] {
  return (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 3);
}

function cap(s: string): string {
  const t = s.trim().replace(/^[-•*]\s*/, "");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

function trimTo(s: string, max = 160): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, "") + "…" : t;
}

/** Turns a sentence into a short verb-first action if it reads like one. */
export function toAction(s: string): string | null {
  const t = s.trim().replace(/^[-•*\d.)\s]+/, "");
  if (!t || t.length < 6) return null;
  if (ACTION_START.test(t)) return cap(trimTo(t.replace(/[.!]+$/, ""), 140));
  const m = SHOULD_RE.exec(t);
  if (m && ACTION_START.test(m[1].trim())) return cap(trimTo(m[1].replace(/[.!]+$/, ""), 140));
  return null;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = i.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}

function analyse(title: string, blocks: PMNode[]): Section {
  const doc: PMDoc = { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] };
  const paragraphs = docParagraphs(doc).filter((p) => p.length > 2);
  const listItems = docListItems(doc);
  const headings = docHeadings(doc).map((h) => h.text).filter(Boolean);
  const sentences = paragraphs.flatMap(sentencesOf);
  const actions = dedupe([...listItems.map(toAction).filter((x): x is string => !!x), ...sentences.map(toAction).filter((x): x is string => !!x)]);
  return { title, blocks, paragraphs, listItems, headings, sentences, actions };
}

/** Splits a chapter into sections at its H2/H3 headings (or keeps it whole). */
function chapterSections(ch: SourceChapter): Section[] {
  const blocks = ch.content.content ?? [];
  const isSplit = (n: PMNode) => n.type === "heading" && [2, 3].includes(Number(n.attrs?.level ?? 0));
  if (blocks.filter(isSplit).length < 2) return [analyse(ch.title, blocks)];
  const out: Section[] = [];
  let cur: { title: string; blocks: PMNode[] } = { title: ch.title, blocks: [] };
  for (const b of blocks) {
    if (isSplit(b)) {
      if (cur.blocks.length) out.push(analyse(cur.title, cur.blocks));
      cur = { title: nodeText(b).trim() || ch.title, blocks: [] };
    } else cur.blocks.push(b);
  }
  if (cur.blocks.length) out.push(analyse(cur.title, cur.blocks));
  return out.length ? out : [analyse(ch.title, blocks)];
}

/** Groups the source into `units` parts (by chapter, or by sub-section when more parts are wanted than chapters). */
export function partition(sources: SourceChapter[], units: number): Section[] {
  const n = Math.max(1, Math.min(60, Math.round(units)));
  if (!sources.length) return [];
  let pieces: Section[] = sources.map((c) => analyse(c.title, c.content.content ?? []));
  if (n > pieces.length) {
    const subs = sources.flatMap(chapterSections);
    if (subs.length > pieces.length) pieces = subs;
  }
  if (pieces.length <= n) return pieces;
  // Merge neighbouring pieces into n balanced groups.
  const groups: Section[] = [];
  const per = pieces.length / n;
  for (let g = 0; g < n; g++) {
    const slice = pieces.slice(Math.round(g * per), Math.round((g + 1) * per));
    if (!slice.length) continue;
    const blocks = slice.flatMap((s, i) => (i === 0 ? s.blocks : [B.h(3, s.title), ...s.blocks]));
    const merged = analyse(slice[0].title, blocks);
    merged.headings = dedupe([...slice.slice(1).map((s) => s.title), ...merged.headings]);
    groups.push(merged);
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/* Helpers for prompts and wording                                      */
/* ------------------------------------------------------------------ */
const lc = (s: string) => s.replace(/^(chapter|part|section|lesson|module|day|step|week)\s+[\w\d]+\s*[:.\-–—]\s*/i, "").trim();
const topicOf = (s: Section) => lc(s.title) || s.title;
const lower = (s: string) => (s && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const titleRef = (t: string) => (/^The\s/.test(t) ? "the" + t.slice(3) : t);
const GENERIC_PREFIX = /^(welcome|introduction|intro|conclusion|overview|getting started|final thoughts|summary)\s*[:.\-–—]\s*/i;
/** A topic phrase that reads naturally mid-sentence: sentence-case gets lower-cased, Title Case gets quoted. */
function topicPhrase(s: Section): string {
  const t = topicOf(s).replace(GENERIC_PREFIX, "").trim() || topicOf(s);
  const words = t.split(/\s+/);
  const capitalised = words.slice(1).filter((w) => /^[A-Z]/.test(w)).length;
  if (words.length > 2 && capitalised >= Math.ceil((words.length - 1) / 2)) return `“${t}”`;
  return lower(t);
}

function keyPoints(s: Section, max = 5): string[] {
  const fromLists = s.listItems.filter((x) => x.length > 8).map((x) => trimTo(x, 150));
  const fromHeads = s.headings.map((h) => trimTo(h, 120));
  const fromSentences = s.paragraphs.map((p) => trimTo(firstSentences(p, 1, 170), 170));
  return dedupe([...fromHeads, ...fromLists, ...fromSentences]).slice(0, max);
}

function summary(s: Section, sentences = 2): string {
  const text = s.paragraphs.slice(0, 3).join(" ");
  return text ? firstSentences(text, sentences, 360) : `This part covers ${topicPhrase(s)}.`;
}

function actionsFor(s: Section, max = 6): string[] {
  const acts = s.actions.slice(0, max);
  if (acts.length) return acts;
  const fallback = keyPoints(s, 3).map((k) => `Apply this: ${lower(k.replace(/[.!]+$/, ""))}`);
  return fallback.length ? fallback : [`Choose one idea from “${topicOf(s)}” and put it into practice today`];
}

function reflectionQuestions(s: Section, max = 3): string[] {
  const t = topicPhrase(s);
  const qs = [
    `Where are you right now with ${t}? Describe it in a sentence or two.`,
    `What is one change you will make after this ${s.headings.length ? "section" : "part"}?`,
    `What might get in the way, and how will you handle it?`,
  ];
  for (const h of s.headings.slice(0, 2)) qs.splice(1, 0, `How could “${trimTo(h, 80)}” work in your situation?`);
  return dedupe(qs).slice(0, max);
}

function originalBlocks(s: Section, maxParagraphs?: number): PMNode[] {
  if (!maxParagraphs) return deepClone(s.blocks);
  const out: PMNode[] = [];
  let paras = 0;
  for (const b of s.blocks) {
    if (b.type === "paragraph") {
      if (paras >= maxParagraphs) continue;
      paras++;
    }
    out.push(deepClone(b));
  }
  return out;
}

function intro(input: BuildInput, info: FormatInfo, parts: Section[], extra: PMNode[] = []): { title: string; content: PMDoc } {
  const who = input.audience ? ` for ${lower(input.audience)}` : "";
  return {
    title: "Introduction",
    content: B.doc(
      B.p(`Welcome to **${input.title}** — ${info.label.toLowerCase()}${who}.`),
      B.p(`It is organised into ${parts.length} ${info.unitLabel}. Work through them in order, and give yourself time to complete each one before moving on.`),
      B.h(2, "What's inside"),
      B.ol(parts.map((p) => topicOf(p))),
      ...extra,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Format builders                                                      */
/* ------------------------------------------------------------------ */
type Builder = (input: BuildInput, parts: Section[], info: FormatInfo) => { title: string; content: PMDoc }[];

const numbered = (label: string, i: number, s: Section) => `${label} ${i + 1}: ${topicOf(s)}`;

const BUILDERS: Record<BuildFormat, Builder> = {
  ebook: (input, parts, info) => [
    intro(input, info, parts),
    ...parts.map((s) => ({
      title: topicOf(s),
      content: B.doc(...originalBlocks(s), B.callout("summary", B.h(3, "Key takeaways"), B.ul(keyPoints(s, 4))), B.h(3, "Action steps"), B.tasks(actionsFor(s, 5))),
    })),
    { title: "Conclusion", content: B.doc(B.p(`You now have a clear path through ${titleRef(input.title)}. Pick the one action that will make the biggest difference this week and start there.`), B.h(2, "Your next steps"), B.tasks(parts.slice(0, 5).map((p) => actionsFor(p, 1)[0]))) },
  ],
  "short-guide": (input, parts) => [
    { title: "Start here", content: B.doc(B.p(`This short guide${input.audience ? ` for ${lower(input.audience)}` : ""} gives you the essentials of ${titleRef(input.title)} in ${parts.length} quick sections.`)) },
    ...parts.map((s) => ({ title: topicOf(s), content: B.doc(B.p(summary(s)), B.h(3, "Key points"), B.ul(keyPoints(s, 5)), B.callout("tip", B.p(`**Do this next:** ${actionsFor(s, 1)[0]}.`))) })),
  ],
  workbook: (input, parts, info) => [
    intro(input, info, parts, [B.callout("note", B.p("Print this workbook or fill it in digitally. There are no wrong answers — be honest and specific."))]),
    ...parts.map((s, i) => ({
      title: numbered("Worksheet", i, s),
      content: B.doc(
        B.callout("note", B.p(summary(s))),
        B.h(3, "Reflect"),
        ...reflectionQuestions(s).flatMap((q) => [B.p(`**${q}**`), B.lines(3)]),
        B.h(3, "Your action plan"),
        B.table(["Action", "When", "Done"], actionsFor(s, 4).map((a) => [a, "", "☐"])),
      ),
    })),
  ],
  checklist: (input, parts) => [
    { title: "How to use this checklist", content: B.doc(B.p(`Work through each group and tick items off as you go. ${input.audience ? `Written for ${lower(input.audience)}.` : ""}`.trim())) },
    ...parts.map((s) => ({ title: topicOf(s), content: B.doc(B.tasks(dedupe([...actionsFor(s, 10), ...keyPoints(s, 3).map((k) => `Review: ${lower(k.replace(/[.!]+$/, ""))}`)]).slice(0, 10))) })),
  ],
  "mini-course": (input, parts, info) => [
    intro(input, info, parts),
    ...parts.map((s, i) => ({
      title: numbered("Lesson", i, s),
      content: B.doc(
        B.h(3, "In this lesson you will"),
        B.ul(dedupe([`Understand the essentials of ${topicPhrase(s)}`, ...s.headings.slice(0, 2).map((h) => `Learn about ${lower(trimTo(h, 90))}`), `Complete one practical assignment`])),
        B.h(3, "Lesson"),
        ...originalBlocks(s, 6),
        B.callout("summary", B.h(3, "Recap"), B.ul(keyPoints(s, 3))),
        B.callout("exercise", B.h(3, "Assignment"), B.p(actionsFor(s, 1)[0] + "."), B.lines(3)),
      ),
    })),
  ],
  "email-course": (input, parts) =>
    parts.map((s, i) => ({
      title: `Email ${i + 1}: ${topicOf(s)}`,
      content: B.doc(
        B.p(`**Subject:** ${i === 0 ? `Welcome — let's start with ${topicPhrase(s)}` : `Day ${i + 1}: ${topicOf(s)}`}`),
        B.p("Hi [First name],"),
        B.p(summary(s, 3)),
        B.p(`Here's the key idea for today: ${lower(keyPoints(s, 1)[0] ?? topicOf(s))}`),
        B.p(`**Your next step:** ${actionsFor(s, 1)[0]}.`),
        B.p(i < parts.length - 1 ? `Tomorrow: ${topicOf(parts[i + 1])}.` : "That's the end of the course — reply and tell me what changed for you."),
        B.p(`Talk soon,\n${input.author || "[Your name]"}`),
      ),
    })),
  challenge: (input, parts, info) => [
    intro(input, info, parts, [B.callout("tip", B.p("Do one day at a time. Each task is designed to take less than 30 minutes."))]),
    ...parts.map((s, i) => ({
      title: numbered("Day", i, s),
      content: B.doc(B.p(`**Today's goal:** make progress on ${topicPhrase(s)}.`), B.h(3, "Why it matters"), B.p(summary(s)), B.h(3, "Today's task"), B.tasks(actionsFor(s, 2)), B.h(3, "Reflection"), B.p(reflectionQuestions(s, 1)[0]), B.lines(3)),
    })),
  ],
  "membership-module": (input, parts) => [
    { title: "Module overview", content: B.doc(B.p(`This module covers ${titleRef(input.title)}${input.audience ? ` for ${lower(input.audience)}` : ""}.`), B.ol(parts.map((p) => topicOf(p)))) },
    ...parts.map((s, i) => ({
      title: numbered("Lesson", i, s),
      content: B.doc(B.h(3, "Overview"), B.p(summary(s)), B.h(3, "Lesson"), ...originalBlocks(s, 5), B.callout("exercise", B.h(3, "Implementation exercise"), B.tasks(actionsFor(s, 3))), B.callout("note", B.h(3, "Discussion prompt"), B.p(`Share in the community: ${reflectionQuestions(s, 2)[1] ?? reflectionQuestions(s, 1)[0]}`))),
    })),
  ],
  toolkit: (input, parts) => [
    { title: "Your toolkit", content: B.doc(B.p(`${parts.length} ready-to-use tools for ${titleRef(input.title)}. Print them, copy them into your planner, or keep them open while you work.`)) },
    ...parts.map((s, i) => {
      const kinds = ["checklist", "quick reference", "planner"] as const;
      const k = kinds[i % kinds.length];
      const content =
        k === "checklist"
          ? B.doc(B.p("Use this checklist each time:"), B.tasks(actionsFor(s, 8)))
          : k === "quick reference"
            ? B.doc(B.table(["Topic", "Remember"], keyPoints(s, 6).map((kp, j) => [s.headings[j] ? trimTo(s.headings[j], 60) : `Point ${j + 1}`, kp])))
            : B.doc(B.table(["Action", "Day", "Time", "Done"], actionsFor(s, 6).map((a) => [a, "", "", "☐"])));
      return { title: `Tool ${i + 1}: ${topicOf(s)} ${k === "checklist" ? "checklist" : k === "quick reference" ? "quick reference" : "planner"}`, content };
    }),
  ],
  "action-plan": (input, parts) => [
    { title: "How to use this plan", content: B.doc(B.p(`Follow the phases in order. Each phase lists the actions to take and the outcome you're aiming for.`)) },
    ...parts.map((s, i) => ({ title: numbered("Phase", i, s), content: B.doc(B.p(`**Timeline:** Week ${i + 1}`), B.h(3, "Actions"), B.ol(actionsFor(s, 6)), B.callout("summary", B.p(`**Outcome:** ${summary(s, 1)}`))) })),
  ],
  worksheet: (input, parts) => [
    { title: "Instructions", content: B.doc(B.p(`Answer each prompt in your own words. ${input.audience ? `Written for ${lower(input.audience)}.` : ""}`.trim())) },
    ...parts.map((s) => ({ title: topicOf(s), content: B.doc(B.p(summary(s, 1)), ...reflectionQuestions(s, 3).flatMap((q) => [B.p(`**${q}**`), B.lines(3)])) })),
  ],
  "resource-list": (input, parts) => [
    { title: "About this list", content: B.doc(B.p("This list describes the kinds of resources worth having for each area and how to choose them. Add your own recommended tools, links and affiliate notes where marked."), B.callout("warning", B.p("Only recommend resources you have checked yourself. Prices and features change often."))) },
    ...parts.map((s) => ({ title: topicOf(s), content: B.doc(B.p(`**What it's for:** ${summary(s, 1)}`), B.h(3, "What to look for"), B.ul(keyPoints(s, 4)), B.h(3, "Recommended resources"), B.table(["Resource", "Why it helps", "Link"], [["[Add a resource]", "", ""], ["[Add a resource]", "", ""]])) })),
  ],
  "quick-start-guide": (input, parts) => [
    { title: "Before you start", content: B.doc(B.p(`Follow these ${parts.length} steps to get your first result with ${titleRef(input.title)} as quickly as possible.`)) },
    ...parts.map((s, i) => ({ title: numbered("Step", i, s), content: B.doc(B.p(summary(s, 2)), B.callout("tip", B.p(`**Do it now:** ${actionsFor(s, 1)[0]}.`))) })),
  ],
  template: (input, parts) => [
    { title: "How to use these templates", content: B.doc(B.p("Copy a template, replace everything in [square brackets], and keep the finished version somewhere you'll see it.")) },
    ...parts.map((s) => ({
      title: `Template: ${topicOf(s)}`,
      content: B.doc(B.p(`My goal for ${topicPhrase(s)}: [describe it]`), ...keyPoints(s, 3).map((k) => B.p(`${trimTo(k.replace(/[.!]+$/, ""), 90)} → [how this applies to me]`)), B.p("First action: [what] — by [when]"), B.p("How I'll know it worked: [measure]")),
    })),
  ],
  "cheat-sheet": (input, parts) => [
    ...parts.map((s) => ({ title: topicOf(s), content: B.doc(B.ul(keyPoints(s, 4)), B.callout("tip", B.p(`**Remember:** ${actionsFor(s, 1)[0]}.`))) })),
  ],
  "implementation-plan": (input, parts) => [
    { title: "Your implementation plan", content: B.doc(B.p(`A ${parts.length}-week plan for putting ${titleRef(input.title)} into practice.`), B.table(["Week", "Focus"], parts.map((p, i) => [`Week ${i + 1}`, topicOf(p)]))) },
    ...parts.map((s, i) => ({ title: numbered("Week", i, s), content: B.doc(B.h(3, "Tasks"), B.tasks(actionsFor(s, 5)), B.p(`**Milestone:** ${trimTo(keyPoints(s, 1)[0] ?? topicOf(s), 140)}`), B.p(`**Checkpoint:** ${reflectionQuestions(s, 2)[1] ?? "What worked this week?"}`), B.lines(2)) })),
  ],
  "short-report": (input, parts) => [
    { title: "Introduction", content: B.doc(B.p(`This free report${input.audience ? ` for ${lower(input.audience)}` : ""} shares ${parts.length} practical insights about ${titleRef(input.title)} you can use straight away.`)) },
    ...parts.map((s, i) => ({ title: numbered("Insight", i, s), content: B.doc(B.p(summary(s, 3)), B.ul(keyPoints(s, 3)), B.callout("tip", B.p(`**Quick win:** ${actionsFor(s, 1)[0]}.`))) })),
    { title: "What's next", content: B.doc(B.p("[Describe your paid product or next step here — keep it honest and specific about what's included.]")) },
  ],
  "resource-guide": (input, parts) => [
    { title: "Introduction", content: B.doc(B.p("This guide explains which types of tools and resources help most, and how to evaluate them before you commit."), B.callout("warning", B.p("Add specific recommendations only after you've checked them yourself."))) },
    ...parts.map((s) => ({ title: topicOf(s), content: B.doc(B.p(summary(s, 1)), B.h(3, "How to evaluate options"), B.tasks(dedupe([...keyPoints(s, 3).map((k) => `Check: ${lower(k.replace(/[.!]+$/, ""))}`), "Check it fits your budget and the time you have"])), B.h(3, "Recommendations"), B.p("[Add your recommended resources]")) })),
  ],
  "mini-email-course": (input, parts) => BUILDERS["email-course"](input, parts, formatInfo("lead-magnet", "mini-email-course")),
  "quick-start-plan": (input, parts) => [
    { title: "Your quick-start plan", content: B.doc(B.p(`${parts.length} days. One task a day. Each task takes about 15 minutes.`)) },
    ...parts.map((s, i) => ({ title: numbered("Day", i, s), content: B.doc(B.p(`**Task:** ${actionsFor(s, 1)[0]}.`), B.p(summary(s, 1)), B.tasks(["Done"])) })),
  ],
};

export function buildFromTemplate(input: BuildInput): BuiltDocument {
  const info = formatInfo(input.kind, input.format);
  const parts = partition(input.sources, input.units);
  if (!parts.length) throw new Error("Select at least one source chapter.");
  const chapters = BUILDERS[input.format](input, parts, info).map((c) => ({ title: c.title.slice(0, 200), content: c.content }));
  return { title: input.title, subtitle: `${info.label}${input.audience ? ` for ${lower(input.audience)}` : ""}`, chapters };
}
