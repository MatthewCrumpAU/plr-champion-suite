import "server-only";
import type { AITaskId, AITaskParsed, Brief } from "./tasks";

export interface BuiltPrompt {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
}

const BASE_RULES = `You are the writing engine inside PLR Champion, a private studio used by a digital product creator to edit, rebrand and repurpose private label rights (PLR) content they hold rights to.

Non-negotiable rules:
- Never invent testimonials, reviews, customer stories presented as real, statistics, study findings, income or earnings claims, or guaranteed results.
- Never attribute quotes to real people. Do not name real brands as endorsers.
- When a statement would need a source, phrase it generally or flag it with [verify].
- Write in clear, natural, modern English. Match the spelling conventions of any source text provided.
- Output only the requested content. No preamble, no "Here is…", no closing remarks.`;

const MARKDOWN_RULES = `Format the answer as Markdown: "## " for section headings, "### " for sub-headings, "- " for bullet points, "1. " for numbered steps, **bold** sparingly, "> " for a short tip or callout, and GitHub-style tables only where a table genuinely helps.`;

const JSON_RULES = `Respond with a single valid JSON value only. Do not wrap it in code fences. Do not add commentary before or after it.`;

function briefBlock(b: Brief | undefined): string {
  if (!b) return "";
  const rows: [string, string | undefined][] = [
    ["Product name", b.productName],
    ["Original product name (replace it)", b.originalName],
    ["Niche", b.niche],
    ["Target audience", b.audience],
    ["Main promise", b.promise],
    ["Brand voice", b.voice],
    ["Author / company", b.author],
    ["Positioning", b.positioning],
    ["Product description", b.description],
    ["Price", b.price],
    ["Website", b.website],
  ];
  const filled = rows.filter(([, v]) => v && v.trim());
  if (!filled.length) return "";
  return `\n\nProduct brief:\n${filled.map(([k, v]) => `- ${k}: ${v!.trim()}`).join("\n")}`;
}

function source(label: string, text: string | undefined): string {
  if (!text || !text.trim()) return "";
  return `\n\n${label}:\n<<<\n${text.trim()}\n>>>`;
}

const LENGTH_WORDS: Record<string, string> = { short: "about 400–600 words", medium: "about 900–1,300 words", long: "about 1,800–2,500 words" };

const CREATE_TOOL_SPECS: Record<string, string> = {
  article: "Write a complete article with a compelling title (as a level-1 heading '# '), an engaging introduction, 3–6 well-structured sections, practical detail and a short conclusion.",
  "ebook-chapter": "Write a complete ebook chapter with a chapter title (as '# '), an opening that connects with the reader's situation, structured sections with sub-headings, practical guidance, and an 'Action steps' section at the end.",
  "blog-post": "Write a blog post with an SEO-friendly title (as '# '), a hook in the first two sentences, scannable sections with sub-headings, and a closing call to action that invites the reader to take a next step (do not invent offers).",
  "course-lesson": "Write a course lesson with a lesson title (as '# '), 'What you'll learn' objectives, the core lesson content in clear steps, a worked example (clearly hypothetical), a short recap, and an assignment.",
  "product-description": "Write a product description for a digital product: a headline (as '# '), a short opening paragraph, a bullet list of benefits, a 'What's inside' list, and who it is for. Do not invent results, testimonials or bonuses.",
  checklist: "Write a practical checklist with a title (as '# '), a one-sentence intro, then grouped sections with checklist items written as Markdown task items ('- [ ] '), each starting with a verb.",
  workbook: "Write workbook content with a title (as '# '), short teaching notes for each section, reflection questions, fill-in prompts (use lines of underscores '______' for answers), and an action-planning table.",
  introduction: "Write an introduction section (as '# Introduction' unless a better title fits) that welcomes the reader, names their problem, explains what the product covers and how to use it.",
  conclusion: "Write a conclusion section (as '# Conclusion' unless a better title fits) that recaps the key ideas, encourages action with concrete next steps, and ends on a motivating note without hype.",
};

const TRANSFORM_SPECS: Record<string, (i: AITaskParsed<"writer.transform">) => string> = {
  expand: () => "Expand the text: add depth, explanation, practical detail and smooth transitions while keeping the original structure and meaning. Roughly double its length.",
  shorten: () => "Shorten the text to roughly half its length. Keep every essential point, remove repetition and filler, and keep the structure.",
  tone: (i) => `Rewrite the text in this tone: ${i.tone || "warm, confident and practical"}. Keep the meaning, facts and structure.`,
  audience: (i) => `Rewrite the text for this audience: ${i.audience || "beginners"}. Adjust vocabulary, examples and emphasis so it speaks directly to them. Keep the core advice.`,
  clarity: () => "Improve clarity: shorter sentences, plain words, active voice, logical order and clear headings. Fix grammar and awkward phrasing. Keep the meaning.",
  examples: () => "Add 2–4 concrete, realistic examples that illustrate the main points. Label them clearly as examples, keep them hypothetical (no real names, no invented statistics), and place each near the point it supports. Return the full text with the examples added.",
  "action-steps": () => "Write a set of clear action steps the reader can take based on the text: a short heading '## Action steps' followed by 4–8 numbered steps, each starting with a verb and including a brief how-to. Return only the action steps section.",
};

const OUTLINE_UNIT: Record<string, string> = {
  ebook: "chapters",
  report: "sections",
  guide: "sections",
  workbook: "worksheets/sections",
  course: "modules",
  "mini-course": "lessons",
  "email-course": "emails",
  challenge: "days",
  "membership-lesson": "lesson parts",
};

const BUILD_SPECS: Record<string, string> = {
  ebook: "a complete ebook. Each '## ' section is a chapter with a title, sub-headings, practical content and action steps.",
  "short-guide": "a short, focused guide. Each '## ' section is concise, practical and skimmable.",
  workbook: "a workbook. Each '## ' section is a worksheet with a brief teaching note, reflection questions, fill-in prompts using '______' lines, and a small action table.",
  checklist: "a checklist product. Each '## ' section is a checklist group of '- [ ] ' items that each start with a verb.",
  "mini-course": "a mini-course. Each '## ' section is a lesson: objectives, lesson content, a short recap and an assignment.",
  "email-course": "an email course. Each '## ' section is one email: start with 'Subject: …' on its own line, then the email body with a single clear takeaway and a next step.",
  challenge: "a challenge. Each '## ' section is a day: 'Day N: title', today's goal, why it matters, the task, and a reflection prompt.",
  "membership-module": "a membership module. Each '## ' section is a lesson with an overview, the lesson, an implementation exercise and a community discussion prompt.",
  toolkit: "a digital toolkit. Each '## ' section is a tool: a checklist, template, swipe, planner or quick reference the reader can use straight away.",
  "action-plan": "an action plan. Each '## ' section is a phase with numbered actions, the outcome to aim for, and a simple timeline.",
  worksheet: "a worksheet. Each '## ' section contains prompts with '______' answer lines and short instructions.",
  "resource-list": "a resource list. Each '## ' section is a category listing resource types the reader should look for, with what each is for and how to choose one. Do not invent specific product names, URLs or prices.",
  "quick-start-guide": "a quick-start guide. Each '## ' section is a numbered step to get a first result fast.",
  template: "fill-in templates. Each '## ' section is one template with placeholders in [square brackets] and a note on how to use it.",
  "cheat-sheet": "a one-page style cheat sheet. Each '## ' section is a compact block of key points, formulas, do's and don'ts.",
  "implementation-plan": "an implementation plan. Each '## ' section is a week or stage with tasks, a milestone and a checkpoint question.",
  "short-report": "a short report used as a free lead magnet. Each '## ' section delivers one quick, useful insight and ends with a small next step.",
  "resource-guide": "a resource guide used as a lead magnet. Each '## ' section covers a category of tools or resources to look for and how to evaluate them, without naming specific products or prices.",
  "mini-email-course": "a mini email course used as a lead magnet. Each '## ' section is one email starting with 'Subject: …' on its own line.",
  "quick-start-plan": "a quick-start plan used as a lead magnet. Each '## ' section is a day or step with a single concrete task.",
};

export function buildPrompt<T extends AITaskId>(task: T, raw: AITaskParsed<T>, maxOut: number): BuiltPrompt {
  const cap = (n: number) => Math.min(n, maxOut);
  switch (task) {
    case "writer.create": {
      const i = raw as AITaskParsed<"writer.create">;
      const spec = CREATE_TOOL_SPECS[i.tool];
      const len = i.tool === "checklist" || i.tool === "product-description" || i.tool === "introduction" || i.tool === "conclusion" ? "a length that suits the format" : LENGTH_WORDS[i.length];
      return {
        system: `${BASE_RULES}\n\n${MARKDOWN_RULES}`,
        user: `${spec}\n\nTopic: ${i.topic}\nAudience: ${i.audience || "general readers interested in the topic"}\nTone: ${i.tone || "clear, friendly and practical"}\nLength: ${len}.${i.keyPoints ? `\nKey points to cover:\n${i.keyPoints}` : ""}${i.extra ? `\nAdditional instructions: ${i.extra}` : ""}${briefBlock(i.brief)}${source("Source material to draw from (rewrite in your own words; do not copy sentences verbatim)", i.sourceText)}`,
        maxTokens: cap(i.length === "long" ? 6000 : 3500),
        temperature: 0.7,
      };
    }
    case "writer.transform": {
      const i = raw as AITaskParsed<"writer.transform">;
      return {
        system: `${BASE_RULES}\n\n${MARKDOWN_RULES}\nPreserve headings, lists and tables from the original where they still make sense.`,
        user: `${TRANSFORM_SPECS[i.tool](i)}${i.extra ? `\nAdditional instructions: ${i.extra}` : ""}${briefBlock(i.brief)}${source("Text", i.text)}`,
        maxTokens: cap(i.tool === "expand" ? 7000 : 5000),
        temperature: 0.6,
      };
    }
    case "rebrand.rewrite": {
      const i = raw as AITaskParsed<"rebrand.rewrite">;
      const level =
        i.level === "light"
          ? "Light rebrand: keep the structure and most sentences; update names, audience references, examples and voice so it fits the new brand."
          : i.level === "full"
            ? "Full rewrite: rewrite every paragraph in fresh words and the new brand voice, restructure where it improves flow, and tailor examples to the new audience, while keeping the useful substance."
            : "Moderate rebrand: rewrite sentences in the new brand voice, tailor examples and framing to the new audience and niche, keep the structure and all useful advice.";
      return {
        system: `${BASE_RULES}\n\n${MARKDOWN_RULES}\nThe first line of your answer must be the new chapter title as a level-1 heading ("# Title"). Then the chapter body.`,
        user: `Rebrand this chapter for the new product described in the brief. ${level}\nReplace any mention of the original product name, author or brand with the new ones. Remove outdated or generic filler phrases ("In today's fast-paced world", "It goes without saying", etc.).${i.extra ? `\nAdditional instructions: ${i.extra}` : ""}${briefBlock(i.brief)}\n\nOriginal chapter title: ${i.chapterTitle || "(untitled)"}${source("Original chapter text", i.text)}`,
        maxTokens: cap(7000),
        temperature: 0.6,
      };
    }
    case "outline.create": {
      const i = raw as AITaskParsed<"outline.create">;
      const unit = OUTLINE_UNIT[i.type] ?? "sections";
      return {
        system: `${BASE_RULES}\n\n${JSON_RULES}`,
        user: `Create an outline for a ${i.type.replace(/-/g, " ")} on: ${i.topic}.\nAudience: ${i.audience || "beginners"}\nPromise / outcome: ${i.promise || "a clear, practical result"}\nNumber of ${unit}: ${i.units}\nSections per ${unit.replace(/s$/, "")}: ${i.sectionsPerUnit}${i.notes ? `\nNotes: ${i.notes}` : ""}${briefBlock(i.brief)}\n\nReturn JSON with this shape:\n{"title": string, "subtitle": string, "items": [{"title": string, "summary": string (one sentence), "sections": string[]}]}`,
        maxTokens: cap(4000),
        temperature: 0.7,
      };
    }
    case "product.build": {
      const i = raw as AITaskParsed<"product.build">;
      return {
        system: `${BASE_RULES}\n\n${MARKDOWN_RULES}\nStart with "# <title>" and then use exactly one "## " heading per part.`,
        user: `Using the source material, create ${BUILD_SPECS[i.format]}\nTitle: ${i.title}\nAudience: ${i.audience || "the product's audience"}\nNumber of parts: ${i.units}${i.extra ? `\nAdditional instructions: ${i.extra}` : ""}${briefBlock(i.brief)}${source("Source material (repurpose it in fresh words; keep useful advice; do not copy long passages verbatim)", i.sourceText)}`,
        maxTokens: cap(8000),
        temperature: 0.6,
      };
    }
    case "opportunity.scan": {
      const i = raw as AITaskParsed<"opportunity.scan">;
      return {
        system: `${BASE_RULES}\n\n${JSON_RULES}\nPrices are rough planning estimates, not market research — keep ranges conservative.`,
        user: `Analyse this PLR product and suggest 5–8 distinct ways to repurpose it into new digital products.\nTitle: ${i.title}\nNiche: ${i.niche}\nAudience: ${i.audience}${briefBlock(i.brief)}\n\nChapters:\n${i.chapters.map((c, n) => `${n + 1}. ${c.title} — ${c.summary}`).join("\n")}\n\nReturn a JSON array. Each item: {"format": one of ["ebook","short-guide","workbook","checklist","mini-course","email-course","challenge","membership-module","toolkit","action-plan","cheat-sheet","quick-start-guide","short-report"], "name": string, "sourceChapters": string[] (chapter titles used), "complexity": "low"|"medium"|"high", "positioning": string, "funnelRole": "lead-magnet"|"front-end"|"order-bump"|"upsell"|"downsell"|"bonus"|"membership", "priceLow": number, "priceHigh": number, "rationale": string}`,
        maxTokens: cap(4000),
        temperature: 0.7,
      };
    }
    case "research.niche": {
      const i = raw as AITaskParsed<"research.niche">;
      const shapes: Record<string, string> = {
        needs: `[{"text": string (an audience need), "why": string}]`,
        problems: `[{"text": string (a problem the audience has), "severity": "low"|"medium"|"high", "why": string}]`,
        ideas: `[{"name": string (a digital product idea), "format": string, "angle": string}]`,
        personas: `[{"name": string (a fictional persona name), "summary": string, "goals": string[], "pains": string[], "objections": string[], "channels": string[]}]`,
        content: `[{"title": string (a content idea), "format": string, "angle": string}]`,
      };
      return {
        system: `${BASE_RULES}\n\n${JSON_RULES}\nEverything you produce is a hypothesis for the user to validate. Do not state numbers, market sizes, search volumes or trends as facts.`,
        user: `Niche: ${i.niche}\nAudience: ${i.audience || "unspecified"}${i.notes ? `\nResearch notes so far: ${i.notes}` : ""}${i.existing.length ? `\nAlready listed (do not repeat): ${i.existing.join("; ")}` : ""}\n\nGenerate ${i.count} ${i.kind === "personas" ? "customer personas (fictional, for planning)" : i.kind} for this niche.\nReturn JSON: ${shapes[i.kind]}`,
        maxTokens: cap(3000),
        temperature: 0.8,
      };
    }
    case "research.keywords": {
      const i = raw as AITaskParsed<"research.keywords">;
      return {
        system: `${BASE_RULES}\n\n${JSON_RULES}\nYou do not have search data. Never include search volume, difficulty, competition or CPC numbers.`,
        user: `Suggest ${i.count} keyword ideas for seed "${i.seed}".\nNiche: ${i.niche || "unspecified"}\nAudience: ${i.audience || "unspecified"}\nInclude these kinds: ${i.kinds.join(", ")}.${i.existing.length ? `\nAlready listed (do not repeat): ${i.existing.slice(0, 200).join("; ")}` : ""}\n\nReturn JSON array: [{"keyword": string, "type": "long-tail"|"question"|"product"|"topic", "intent": "informational"|"commercial"|"transactional"|"navigational", "cluster": string (a short topic group name)}]`,
        maxTokens: cap(3000),
        temperature: 0.7,
      };
    }
    case "marketing.sales": {
      const i = raw as AITaskParsed<"marketing.sales">;
      const guide: Record<string, string> = {
        headline: "3 headline options focused on the main promise. Put them in items[].title; leave body empty.",
        subheadline: "3 subheadline options that expand on the promise. Put them in items[].title.",
        problem: "A problem-and-solution section: heading, 2–3 short paragraphs naming the reader's frustration and introducing the solution (body), plus 3–5 pain-point bullets.",
        introduction: "A product introduction: heading, a short paragraph introducing the product and who it's for (body), plus a one-line subheading.",
        benefits: "A benefits section: heading and 5–8 benefit bullets that describe outcomes in the reader's terms (no guaranteed results).",
        features: "A features section: heading and 4–8 items, each a feature (title) with the benefit it gives (text).",
        included: "A 'What's included' section: heading and one item per included component (title) with a one-sentence description (text). Use the included list provided; do not invent components.",
        bonuses: "A bonuses section: heading and one item per bonus provided (title + one-sentence description). Do not invent bonuses or dollar values.",
        pricing: "A pricing section: heading, a short value-framing paragraph (body) and 3–5 bullets summarising what the buyer gets. Do not invent discounts, deadlines or 'valued at' figures.",
        faq: "An FAQ section: heading and 5–8 items, each a question (title) and a clear honest answer (text). Do not promise results.",
        cta: "A call to action section: heading, one persuasive sentence (body), and button text options in bullets.",
        guarantee: "Guarantee wording: a heading and body describing a refund policy in plain language using placeholders like [X days] for terms the seller must set. Do not assert a specific policy.",
      };
      return {
        system: `${BASE_RULES}\n\n${JSON_RULES}`,
        user: `Write the ${i.section} section of a sales page. ${guide[i.section]}${briefBlock(i.brief)}${i.included.length ? `\nIncluded components: ${i.included.join("; ")}` : ""}${i.bonuses.length ? `\nBonuses: ${i.bonuses.join("; ")}` : ""}${i.current ? `\nCurrent draft (improve on it): ${i.current}` : ""}${i.extra ? `\nAdditional instructions: ${i.extra}` : ""}\n\nReturn JSON: {"heading": string, "subheading": string, "body": string, "bullets": string[], "items": [{"title": string, "text": string}]}`,
        maxTokens: cap(2500),
        temperature: 0.7,
      };
    }
    case "marketing.emails": {
      const i = raw as AITaskParsed<"marketing.emails">;
      return {
        system: `${BASE_RULES}\n\n${JSON_RULES}\nNo fake urgency (no invented deadlines or scarcity). Use [placeholders] for anything the sender must fill in, such as dates, links or prices not given.`,
        user: `Write a ${i.count}-email ${i.sequence.replace(/-/g, " ")} sequence.${briefBlock(i.brief)}${i.ctaUrl ? `\nCall-to-action link: ${i.ctaUrl}` : ""}${i.extra ? `\nAdditional instructions: ${i.extra}` : ""}\n\nReturn a JSON array in send order: [{"day": number (days after the sequence starts), "subject": string, "altSubjects": string[] (2 alternatives), "preview": string (preview text, under 90 characters), "body": string (plain text with blank lines between paragraphs), "ctaText": string}]`,
        maxTokens: cap(7000),
        temperature: 0.7,
      };
    }
    case "marketing.social": {
      const i = raw as AITaskParsed<"marketing.social">;
      return {
        system: `${BASE_RULES}\n\n${JSON_RULES}`,
        user: `Create ${i.count} social media pieces (${i.kind}) for these platforms: ${i.platforms.join(", ")}. Spread them across the platforms. Match each platform's style: Facebook conversational, Instagram caption with line breaks and up to 8 relevant hashtags, LinkedIn professional and insight-led, video-script as a 30–60 second script with [HOOK], [BODY], [CTA] markers.${briefBlock(i.brief)}${source("Source content to repurpose", i.sourceText)}${i.extra ? `\nAdditional instructions: ${i.extra}` : ""}\n\nReturn JSON array: [{"platform": one of ${JSON.stringify(i.platforms)}, "type": "educational"|"promotional"|"announcement"|"engagement", "text": string, "hashtags": string[]}]`,
        maxTokens: cap(5000),
        temperature: 0.8,
      };
    }
    case "marketing.names": {
      const i = raw as AITaskParsed<"marketing.names">;
      return {
        system: `${BASE_RULES}\n\n${JSON_RULES}\nAvoid names that copy well-known trademarks or bestselling titles.`,
        user: `Generate ${i.count} ${i.category.replace(/-/g, " ")} ideas.\nTopic: ${i.topic}\nAudience: ${i.audience || "unspecified"}\nOutcome / promise: ${i.outcome || "unspecified"}\nFormat: ${i.format || "digital product"}\nStyle: ${i.style || "clear and benefit-led"}${i.avoid.length ? `\nAvoid repeating: ${i.avoid.slice(0, 100).join("; ")}` : ""}\n\nReturn JSON array: [{"name": string, "note": string (why it works, one short sentence)}]`,
        maxTokens: cap(2000),
        temperature: 0.9,
      };
    }
    case "test.ping":
      return { system: "Reply with the single word OK.", user: "Connection test.", maxTokens: 16, temperature: 0 };
    default:
      throw new Error(`Unknown task: ${String(task)}`);
  }
}
