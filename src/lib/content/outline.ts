import { B } from "@/lib/doc/build";
import type { PMDoc, PMNode } from "@/lib/doc/types";
import { OUTLINE_TYPE_LABELS, OUTLINE_UNIT_LABELS, type OutlineData, type OutlineItem, type OutlineType } from "@/lib/models/content";
import { uid } from "@/lib/utils";

/**
 * Structured outline templates. Each frame is a proven structure for the format; {topic} is filled from the
 * user's topic. Sections are prompts for the writer, not invented content.
 */
const FRAMES: Record<OutlineType, { items: [string, string, string[]][]; extraFrame: [string, string, string[]] }> = {
  ebook: {
    items: [
      ["Introduction", "Who this book is for and what they'll achieve.", ["The problem readers face", "What this book covers", "How to use this book"]],
      ["Why {topic} matters", "Set the stakes and the opportunity.", ["The cost of getting it wrong", "What success looks like", "Myths to let go of"]],
      ["The foundations of {topic}", "Core principles every reader needs first.", ["Key principle one", "Key principle two", "Quick self-assessment"]],
      ["Getting started: your first steps", "Turn principles into a first win.", ["Step-by-step setup", "Your first quick win", "Action steps"]],
      ["Common mistakes and how to avoid them", "Help readers sidestep frustration.", ["Mistake one", "Mistake two", "What to do instead"]],
      ["Building momentum", "Keep progress going week to week.", ["Daily and weekly habits", "Tracking progress", "Action steps"]],
      ["Taking {topic} further", "Advanced ideas once basics are in place.", ["Advanced strategy one", "Advanced strategy two", "When to get extra help"]],
      ["Conclusion", "Recap and next steps.", ["Key takeaways", "Your 7-day action plan", "Final encouragement"]],
    ],
    extraFrame: ["{topic} in practice", "Apply the ideas to real situations.", ["Scenario one", "Scenario two", "Action steps"]],
  },
  report: {
    items: [
      ["Summary", "The key message in a few lines.", ["Who this report is for", "The main finding", "What to do next"]],
      ["The situation", "Context the reader needs.", ["What's happening", "Why it matters now"]],
      ["Key insight one", "First important point about {topic}.", ["Explanation", "Example", "What it means for you"]],
      ["Key insight two", "Second important point.", ["Explanation", "Example", "What it means for you"]],
      ["Key insight three", "Third important point.", ["Explanation", "Example", "What it means for you"]],
      ["Recommendations", "Practical actions to take.", ["Do this first", "Then this", "Avoid this"]],
      ["Next steps", "Where to go from here.", ["Quick checklist", "Further resources"]],
    ],
    extraFrame: ["Additional insight", "Another relevant point.", ["Explanation", "Example"]],
  },
  guide: {
    items: [
      ["Before you start", "What readers need ready.", ["What you'll need", "How long it takes", "What you'll achieve"]],
      ["Step 1: Prepare", "Set up for success.", ["Instructions", "Tip", "Checkpoint"]],
      ["Step 2: Plan", "Decide the approach.", ["Instructions", "Tip", "Checkpoint"]],
      ["Step 3: Do the core work", "The main task for {topic}.", ["Instructions", "Common mistake", "Checkpoint"]],
      ["Step 4: Review and improve", "Check results and refine.", ["Instructions", "Troubleshooting", "Checkpoint"]],
      ["Step 5: Make it a habit", "Keep the results going.", ["Routine", "Tracking", "Next level"]],
      ["Quick reference", "One-page summary.", ["Checklist", "Key reminders"]],
    ],
    extraFrame: ["Bonus step", "An extra improvement.", ["Instructions", "Tip"]],
  },
  workbook: {
    items: [
      ["How to use this workbook", "Set expectations.", ["Where to start", "How long each worksheet takes"]],
      ["Where you are now", "Self-assessment for {topic}.", ["Rating scale", "Reflection questions", "Answer lines"]],
      ["Your goals", "Define the outcome.", ["Goal-setting prompts", "Why it matters to you", "Answer lines"]],
      ["Your plan", "Turn goals into steps.", ["Action table", "Obstacles and solutions"]],
      ["Weekly tracker", "Track progress.", ["Tracker table", "Weekly reflection"]],
      ["Review and next steps", "Look back and plan ahead.", ["What worked", "What to change", "Next 30 days"]],
    ],
    extraFrame: ["Extra worksheet", "Another exercise.", ["Prompt", "Answer lines"]],
  },
  course: {
    items: [
      ["Module 1: Welcome and orientation", "Set up learners for success.", ["Course roadmap", "How to get the most from this course", "Your starting point"]],
      ["Module 2: Foundations of {topic}", "Core concepts.", ["Lesson: key concept one", "Lesson: key concept two", "Assignment"]],
      ["Module 3: Getting your first result", "Guided first win.", ["Lesson: setup", "Lesson: walkthrough", "Assignment"]],
      ["Module 4: Building the system", "Make it repeatable.", ["Lesson: workflow", "Lesson: tools and templates", "Assignment"]],
      ["Module 5: Troubleshooting and optimising", "Fix common problems.", ["Lesson: common issues", "Lesson: improving results", "Assignment"]],
      ["Module 6: Next steps", "Plan beyond the course.", ["Lesson: 90-day plan", "Lesson: staying consistent", "Final project"]],
    ],
    extraFrame: ["Bonus module", "Extra depth.", ["Lesson", "Assignment"]],
  },
  "mini-course": {
    items: [
      ["Lesson 1: The big idea", "Why {topic} works and what's possible.", ["Concept", "Quick win", "Mini task"]],
      ["Lesson 2: The method", "The simple process.", ["Steps", "Example", "Mini task"]],
      ["Lesson 3: Avoiding the traps", "Mistakes and fixes.", ["Common traps", "What to do instead", "Mini task"]],
      ["Lesson 4: Putting it together", "Apply everything.", ["Walkthrough", "Checklist", "Mini task"]],
      ["Lesson 5: Keep going", "Next steps.", ["Habits", "Resources", "Final task"]],
    ],
    extraFrame: ["Bonus lesson", "Extra tip.", ["Concept", "Mini task"]],
  },
  "email-course": {
    items: [
      ["Email 1: Welcome and quick win", "Deliver value immediately.", ["Subject line", "Quick win", "What's coming next"]],
      ["Email 2: The core problem", "Name what holds readers back with {topic}.", ["Subject line", "The problem", "One action"]],
      ["Email 3: The key principle", "The idea that changes things.", ["Subject line", "Principle", "Example", "One action"]],
      ["Email 4: The simple method", "A step-by-step approach.", ["Subject line", "Steps", "One action"]],
      ["Email 5: Common mistakes", "Help them avoid setbacks.", ["Subject line", "Mistakes", "Fixes"]],
      ["Email 6: Wrap-up and next step", "Recap and invite to continue.", ["Subject line", "Recap", "Next step"]],
    ],
    extraFrame: ["Bonus email", "Extra value.", ["Subject line", "Tip", "One action"]],
  },
  challenge: {
    items: [
      ["Day 1: Set your starting point", "Baseline and commitment for {topic}.", ["Today's goal", "Task", "Reflection"]],
      ["Day 2: Clear the obstacles", "Remove friction.", ["Today's goal", "Task", "Reflection"]],
      ["Day 3: Build the foundation", "Core habit.", ["Today's goal", "Task", "Reflection"]],
      ["Day 4: Take action", "First real progress.", ["Today's goal", "Task", "Reflection"]],
      ["Day 5: Level up", "Push a little further.", ["Today's goal", "Task", "Reflection"]],
      ["Day 6: Make it stick", "Routine and tracking.", ["Today's goal", "Task", "Reflection"]],
      ["Day 7: Celebrate and plan ahead", "Review and next steps.", ["Today's goal", "Task", "Reflection"]],
    ],
    extraFrame: ["Day {n}: Keep going", "Build on progress.", ["Today's goal", "Task", "Reflection"]],
  },
  "membership-lesson": {
    items: [
      ["Overview", "What members will learn this month about {topic}.", ["Why this matters", "Outcome"]],
      ["The lesson", "Core teaching.", ["Concept", "Steps", "Example"]],
      ["Implementation", "Put it into practice.", ["Exercise", "Template or worksheet"]],
      ["Community discussion", "Engage members.", ["Discussion prompt", "Share your win"]],
      ["Resources", "Extra support.", ["Checklist", "Further reading"]],
    ],
    extraFrame: ["Bonus part", "Extra content.", ["Concept", "Exercise"]],
  },
};

function fill(s: string, topic: string, n: number) {
  return s.replace(/\{topic\}/g, topic || "your topic").replace(/\{n\}/g, String(n));
}

export function outlineFromTemplate(type: OutlineType, topic: string, units: number, sectionsPerUnit: number): OutlineItem[] {
  const frame = FRAMES[type];
  const items: OutlineItem[] = [];
  const base = frame.items;
  // Keep first and last frames (intro/conclusion) when trimming; repeat the extra frame when expanding.
  let chosen: [string, string, string[]][];
  if (units <= base.length) {
    if (units <= 2) chosen = base.slice(0, units);
    else chosen = [base[0], ...base.slice(1, units - 1), base[base.length - 1]];
  } else {
    const middle = Array.from({ length: units - base.length }, () => frame.extraFrame);
    chosen = [...base.slice(0, base.length - 1), ...middle, base[base.length - 1]];
  }
  chosen.forEach(([title, summary, sections], i) => {
    const secs = sectionsPerUnit === 0 ? [] : Array.from({ length: sectionsPerUnit }, (_, j) => sections[j] ?? `Section ${j + 1}`);
    items.push({ id: uid("oi"), title: fill(title, topic, i + 1), summary: fill(summary, topic, i + 1), notes: "", sections: secs.map((t) => ({ id: uid("os"), title: fill(t, topic, i + 1), notes: "" })) });
  });
  return items;
}

export const DEFAULT_UNITS: Record<OutlineType, number> = { ebook: 8, report: 7, guide: 7, workbook: 6, course: 6, "mini-course": 5, "email-course": 6, challenge: 7, "membership-lesson": 5 };

export function outlineToMarkdown(o: OutlineData, title: string): string {
  const unit = OUTLINE_UNIT_LABELS[o.type];
  const lines = [`# ${title}`];
  if (o.subtitle) lines.push(`*${o.subtitle}*`);
  const meta = [`Format: ${OUTLINE_TYPE_LABELS[o.type]}`, o.topic && `Topic: ${o.topic}`, o.audience && `Audience: ${o.audience}`, o.promise && `Promise: ${o.promise}`].filter(Boolean);
  lines.push(meta.join(" · "));
  o.items.forEach((it, i) => {
    lines.push(`## ${unit} ${i + 1}: ${it.title.replace(new RegExp(`^${unit}\\s+\\d+:\\s*`, "i"), "")}`);
    if (it.summary) lines.push(it.summary);
    if (it.sections.length) lines.push(it.sections.map((s) => `- ${s.title}${s.notes ? ` — ${s.notes}` : ""}`).join("\n"));
    if (it.notes) lines.push(`> Notes: ${it.notes}`);
  });
  return lines.join("\n\n") + "\n";
}

/** One document chapter per outline item, with section headings and writing prompts. */
export function outlineToChapters(o: OutlineData): { title: string; content: PMDoc }[] {
  return o.items.map((it) => {
    const nodes: PMNode[] = [];
    if (it.summary) nodes.push(B.callout("note", B.p(it.summary)));
    for (const s of it.sections) {
      nodes.push(B.h(2, s.title));
      nodes.push(B.p(s.notes ? `[${s.notes}]` : "[Write this section.]"));
    }
    if (!it.sections.length) nodes.push(B.p("[Write this part.]"));
    return { title: it.title, content: B.doc(nodes) };
  });
}

/** Outline as a single document for DOCX/PDF export. */
export function outlineToExportDoc(o: OutlineData, title: string) {
  const unit = OUTLINE_UNIT_LABELS[o.type];
  const nodes: PMNode[] = [];
  const meta = [o.topic && `Topic: ${o.topic}`, o.audience && `Audience: ${o.audience}`, o.promise && `Promise: ${o.promise}`].filter(Boolean) as string[];
  if (meta.length) nodes.push(B.p(meta.join(" · ")));
  o.items.forEach((it, i) => {
    nodes.push(B.h(2, `${unit} ${i + 1}: ${it.title}`));
    if (it.summary) nodes.push(B.p(`*${it.summary}*`));
    if (it.sections.length) nodes.push(B.ul(it.sections.map((s) => (s.notes ? `${s.title} — ${s.notes}` : s.title))));
    if (it.notes) nodes.push(B.quote(it.notes));
  });
  return { title, subtitle: o.subtitle, chapters: [{ title: `${OUTLINE_TYPE_LABELS[o.type]} outline`, content: B.doc(nodes) }] };
}
