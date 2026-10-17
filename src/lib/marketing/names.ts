import type { NameCategory, NameIdea, NameIdeasData } from "@/lib/models/marketing";
import { NAME_CATEGORY_LABELS } from "@/lib/models/marketing";
import { nowIso, uid } from "@/lib/utils";

/**
 * Manual naming templates. Each pattern is filled from the topic, audience, outcome and format the user entered,
 * so results are specific to their product. Patterns are deliberately generic phrasing, not copies of known titles.
 */
export interface NameInputs {
  topic: string;
  audience: string;
  outcome: string;
  format: string;
}

const tc = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w, i) => (i > 0 && /^(a|an|and|the|of|for|to|in|on|at|by|or|with|from)$/i.test(w) ? w.toLowerCase() : w[0] ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

const PATTERNS: Record<NameCategory, string[]> = {
  "product-title": [
    "The {Topic} Blueprint",
    "{Topic} Made Simple",
    "The Practical Guide to {Topic}",
    "{Outcome}: A Step-by-Step Plan",
    "The {Audience}'s Guide to {Topic}",
    "{Topic} Without the Overwhelm",
    "The Simple {Topic} Plan",
    "{Topic} Essentials",
    "From Stuck to {OutcomeShort}",
    "The {Topic} Playbook",
    "{Topic}, Simplified",
    "The Everyday {Topic} Handbook",
  ],
  subtitle: [
    "A step-by-step plan to {outcome}",
    "How {audience} can {outcome} — without the overwhelm",
    "Simple, practical ways to {outcome}",
    "Everything you need to {outcome}, in one place",
    "A practical {format} for {audience}",
    "Practical steps to {outcome} that fit a busy day",
    "The no-fluff guide to {topic} for {audience}",
    "Small daily habits that help you {outcome}",
  ],
  tagline: ["{Outcome}, made simple.", "Less overwhelm. More {topicShort}.", "Your shortcut to {outcome}.", "Practical {topic} for real life.", "Start small. {OutcomeShort}.", "Clear steps for {audience}.", "{Topic} that fits your day."],
  "offer-name": ["The {Topic} Starter Kit", "The Complete {Topic} Package", "{Topic} Fast-Start Offer", "The {Topic} Toolkit", "{Topic} Essentials Pack", "The {OutcomeShort} Kit"],
  "bundle-name": ["The Ultimate {Topic} Bundle", "{Topic} Mega Pack", "The {Topic} Collection", "The Complete {Topic} Library", "{Topic} All-in-One Bundle", "The {Audience} Bundle"],
  "course-name": ["{Topic} Masterclass", "The {Topic} Academy", "{Topic} in 30 Days", "The {Topic} Workshop", "{OutcomeShort}: The Course", "{Topic} Bootcamp", "The 7-Day {Topic} Challenge"],
  "lead-magnet-name": ["The {Topic} Checklist", "7 {Topic} Mistakes to Avoid", "The {Topic} Cheat Sheet", "Free {Topic} Starter Guide", "The 5-Minute {Topic} Plan", "{Topic} Quick-Start Worksheet", "The {Topic} Resource Guide"],
};

export function templateNames(category: NameCategory, i: NameInputs, existing: string[] = []): NameIdea[] {
  const topic = i.topic.trim() || "Your Topic";
  const outcome = i.outcome.trim() || `get results with ${topic.toLowerCase()}`;
  const audience = i.audience.trim().replace(/\s+who\s+.*$/i, "") || "beginners";
  const vars: Record<string, string> = {
    "{Topic}": tc(topic),
    "{topic}": topic.toLowerCase(),
    "{topicShort}": topic.toLowerCase().split(/\s+/).slice(-1)[0] ?? topic.toLowerCase(),
    "{Outcome}": tc(outcome),
    "{outcome}": outcome.charAt(0).toLowerCase() + outcome.slice(1),
    "{OutcomeShort}": tc(outcome.split(/\s+/).slice(0, 4).join(" ")),
    "{Audience}": tc(audience.split(/\s+/).slice(0, 3).join(" ")),
    "{audience}": audience.charAt(0).toLowerCase() + audience.slice(1),
    "{format}": i.format.trim() || "guide",
  };
  const seen = new Set(existing.map((e) => e.toLowerCase()));
  const out: NameIdea[] = [];
  for (const p of PATTERNS[category]) {
    let name = p;
    for (const [k, v] of Object.entries(vars)) name = name.split(k).join(v);
    name = name.replace(/\s+/g, " ").trim();
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ id: uid("nm"), category, name, note: "From a naming template", favourite: false, source: "template", appliedTo: null, createdAt: nowIso() });
  }
  return out;
}

export function namesText(d: NameIdeasData): string {
  return (Object.keys(NAME_CATEGORY_LABELS) as NameCategory[])
    .map((c) => {
      const xs = d.ideas.filter((i) => i.category === c);
      return xs.length ? `${NAME_CATEGORY_LABELS[c]}\n${xs.map((i) => `${i.favourite ? "★ " : "- "}${i.name}`).join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}
