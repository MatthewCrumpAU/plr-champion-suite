import type { WRITER_CREATE_TOOLS, WRITER_TRANSFORM_TOOLS } from "@/lib/ai/tasks";

/**
 * Manual writing templates — structured scaffolds the writer fills in. They contain prompts in [square brackets],
 * never invented content, so the AI Writer is fully usable without an AI provider.
 */

export type CreateTool = (typeof WRITER_CREATE_TOOLS)[number];
export type TransformTool = (typeof WRITER_TRANSFORM_TOOLS)[number];

export interface WriterInputs {
  topic: string;
  audience: string;
  tone: string;
  keyPoints: string;
  length: "short" | "medium" | "long";
}

export const CREATE_TOOL_INFO: Record<CreateTool, { label: string; description: string }> = {
  article: { label: "Article Writer", description: "A complete article with introduction, sections and conclusion." },
  "ebook-chapter": { label: "Ebook Chapter Writer", description: "A structured chapter with action steps." },
  "blog-post": { label: "Blog Post Writer", description: "A scannable, search-friendly blog post." },
  "course-lesson": { label: "Course Lesson Writer", description: "Objectives, lesson content, example, recap and assignment." },
  "product-description": { label: "Product Description Writer", description: "Benefit-led description for a digital product." },
  checklist: { label: "Checklist Writer", description: "Grouped, actionable checklist items." },
  workbook: { label: "Workbook Content Writer", description: "Teaching notes, prompts, answer lines and an action table." },
  introduction: { label: "Introduction Writer", description: "Welcome the reader and set expectations." },
  conclusion: { label: "Conclusion Writer", description: "Recap, next steps and a motivating close." },
};

export const TRANSFORM_TOOL_INFO: Record<TransformTool, { label: string; description: string; manual: string[] }> = {
  expand: {
    label: "Expand",
    description: "Add depth, detail and explanation.",
    manual: ["Add a 'why it matters' sentence after each main point.", "Add one practical how-to step per section.", "Add a short hypothetical example where a point feels abstract.", "Add a transition sentence between sections."],
  },
  shorten: {
    label: "Shorten",
    description: "Cut to roughly half the length.",
    manual: ["Delete sentences that repeat an earlier point.", "Remove filler openers (\"It goes without saying…\").", "Turn long paragraphs into a 3–5 item bullet list.", "Keep one example per point, not several."],
  },
  tone: {
    label: "Change Tone",
    description: "Rewrite in a different voice.",
    manual: ["Read the first paragraph aloud in the new tone and rewrite it.", "Swap formal words for everyday ones (or the reverse).", "Adjust sentence length: short for energetic, longer for calm.", "Check headings match the new tone."],
  },
  audience: {
    label: "Rewrite for Audience",
    description: "Tailor vocabulary and examples to a new reader.",
    manual: ["Replace examples with situations this audience recognises.", "Name their specific goals and frustrations in the intro.", "Remove jargon they wouldn't use, or explain it.", "Update any 'you' statements so they fit their life."],
  },
  clarity: {
    label: "Improve Clarity",
    description: "Plain words, short sentences, logical order.",
    manual: ["Split sentences longer than 25 words.", "Use active voice: 'You plan the day' not 'The day is planned'.", "Put the main point first in each paragraph.", "Check the Analysis tab readability score (aim for 60+)."],
  },
  examples: {
    label: "Generate Examples",
    description: "Add concrete, clearly hypothetical examples.",
    manual: ["Pick the two most abstract points.", "For each, describe a short 'For example…' scenario.", "Keep examples hypothetical — no real names or invented statistics.", "Place each example directly after its point."],
  },
  "action-steps": {
    label: "Generate Action Steps",
    description: "Numbered, practical next steps from the text.",
    manual: ["List each main recommendation in the text.", "Rewrite each as a step starting with a verb.", "Order steps from easiest to hardest.", "Add a time or quantity where it helps ('Spend 10 minutes…')."],
  },
};

const sectionCount = (len: WriterInputs["length"]) => (len === "short" ? 3 : len === "medium" ? 4 : 6);
const points = (kp: string) =>
  kp
    .split(/\n|;/)
    .map((p) => p.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);

export function createTemplate(tool: CreateTool, i: WriterInputs): string {
  const topic = i.topic.trim() || "[Your topic]";
  const audience = i.audience.trim() || "[your reader]";
  const kp = points(i.keyPoints);
  const sections = kp.length ? kp : Array.from({ length: sectionCount(i.length) }, (_, n) => `[Main point ${n + 1}]`);
  const toneNote = i.tone ? `\n\n> Tone: ${i.tone}` : "";
  switch (tool) {
    case "article":
    case "blog-post":
      return `# ${topic}${toneNote}

[Hook: one or two sentences that name the problem ${audience} face with ${topic.toLowerCase()}.]

[Promise: what the reader will be able to do after reading.]

${sections.map((s) => `## ${s}\n\n[Explain this point in 2–3 short paragraphs. Include one practical tip ${audience} can use today.]`).join("\n\n")}

## ${tool === "blog-post" ? "Your next step" : "Conclusion"}

[Recap the key idea in one sentence.]

[Invite the reader to take one specific action.]`;
    case "ebook-chapter":
      return `# ${topic}${toneNote}

[Opening: describe a moment ${audience} will recognise, then state what this chapter will help them do.]

${sections.map((s) => `## ${s}\n\n[Teach this idea. Keep paragraphs short. Add a tip or example.]`).join("\n\n")}

> [Key takeaway in one sentence.]

## Action steps

1. [First small action]
2. [Second action]
3. [Third action]`;
    case "course-lesson":
      return `# ${topic}${toneNote}

## What you'll learn

- [Objective 1]
- [Objective 2]
- [Objective 3]

${sections.map((s, n) => `## Step ${n + 1}: ${s}\n\n[Explain the step clearly for ${audience}.]`).join("\n\n")}

## Example

[Walk through a short hypothetical example applying the steps.]

## Recap

- [Key point 1]
- [Key point 2]

## Your assignment

[One task the learner completes before the next lesson.]`;
    case "product-description":
      return `# ${topic}

[One-sentence description: who it's for and the result it helps them work towards.]

## Inside, you'll discover how to:

${sections.map((s) => `- ${s}`).join("\n")}

## What's included

- [Main product and format, e.g. 45-page PDF guide]
- [Any worksheets, checklists or templates]

## Who it's for

[Describe ${audience} and the situation they're in.]`;
    case "checklist":
      return `# ${topic} Checklist

[One sentence: when and how to use this checklist.]

${sections
  .map(
    (s) => `## ${s}

- [ ] [Action starting with a verb]
- [ ] [Action starting with a verb]
- [ ] [Action starting with a verb]`,
  )
  .join("\n\n")}`;
    case "workbook":
      return `# ${topic} Workbook

[Short welcome: how ${audience} should use this workbook.]

${sections
  .map(
    (s) => `## ${s}

[2–3 sentence teaching note.]

**Reflect:** [Question for the reader]

______________________________

______________________________

**Action:** [What will you do this week?]

______________________________`,
  )
  .join("\n\n")}

## Action plan

| Action | By when | Done |
| --- | --- | --- |
| | | |
| | | |`;
    case "introduction":
      return `# Introduction

[Welcome ${audience}. Name the problem they're facing with ${topic.toLowerCase()}.]

[Explain why the usual approach falls short.]

## What this guide covers

${sections.map((s) => `- ${s}`).join("\n")}

## How to use it

[Explain how to read the guide and get the most from the action steps.]`;
    case "conclusion":
      return `# Conclusion

[Congratulate the reader on finishing.]

## What you've learned

${sections.map((s) => `- ${s}`).join("\n")}

## Your next steps

1. [The single most important action]
2. [A follow-up action]
3. [How to keep going]

[A short, encouraging closing line — no hype.]`;
  }
}
