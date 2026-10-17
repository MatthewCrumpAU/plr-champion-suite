import Papa from "papaparse";
import type { EmailCampaignData, EmailItem, EmailSequenceType } from "@/lib/models/marketing";
import { EMAIL_SEQUENCE_LABELS } from "@/lib/models/marketing";
import { uid } from "@/lib/utils";

/**
 * Email sequence templates. Copy uses the user's product details plus [placeholders] for anything only the sender
 * knows (dates, links, prices, policies). No invented deadlines, scarcity, testimonials or results.
 */
export interface EmailContext {
  productName: string;
  audience: string;
  outcome: string;
  fromName: string;
  topics: string[];
  price: string;
}

type T = Omit<EmailItem, "id" | "ctaUrl" | "notes">;

const sign = (c: EmailContext) => `\n\nTalk soon,\n${c.fromName || "[Your name]"}`;
const topic = (c: EmailContext, i: number) => c.topics[i] || `[Topic ${i + 1}]`;

export function emailTemplates(type: EmailSequenceType, c: EmailContext): T[] {
  const p = c.productName || "[Product name]";
  const who = c.audience || "[your readers]";
  const out = c.outcome || "[the result they want]";
  switch (type) {
    case "welcome":
      return [
        { day: 0, subject: "Welcome! Here's what to expect", altSubjects: ["You're in — start here", "Thanks for joining"], preview: "Your download and a quick hello.", body: `Hi [First name],\n\nThanks for joining! Here's the [free gift] you asked for: [link].\n\nOver the next few days I'll send you a few short emails with practical ideas to help you ${out}.\n\nOne quick question: what's your biggest challenge with this right now? Just hit reply — I read every message.${sign(c)}`, ctaText: "Get your download" },
        { day: 1, subject: `The first thing I'd do about ${topic(c, 0).toLowerCase()}`, altSubjects: ["A simple place to start", "Start with this"], preview: "One small step you can take today.", body: `Hi [First name],\n\nIf you only do one thing this week, make it this: [one practical tip about ${topic(c, 0)}].\n\nWhy it works: [short explanation].\n\nTry it today and let me know how it goes.${sign(c)}`, ctaText: "" },
        { day: 3, subject: "The mistake most people make", altSubjects: [`Why ${out} feels so hard`, "Avoid this one"], preview: "And what to do instead.", body: `Hi [First name],\n\nA lot of ${who} [describe a common mistake].\n\nIt's understandable — [why people fall into it]. But it usually leads to [consequence].\n\nInstead, try [better approach].${sign(c)}`, ctaText: "" },
        { day: 5, subject: `A closer look at ${topic(c, 1).toLowerCase()}`, altSubjects: ["Quick win for this week", "Here's a simple framework"], preview: "A practical framework you can use.", body: `Hi [First name],\n\nToday: ${topic(c, 1)}.\n\n1. [Step one]\n2. [Step two]\n3. [Step three]\n\nIf you'd like the complete step-by-step version, it's all in ${p}: [link].${sign(c)}`, ctaText: `Take a look at ${p}` },
        { day: 7, subject: "Want the complete plan?", altSubjects: [`Everything in one place: ${p}`, "Ready for the next step?"], preview: `What's inside ${p}.`, body: `Hi [First name],\n\nOver the past week we've covered [recap].\n\nIf you want everything in one place, ${p} walks you through it step by step. It includes:\n\n- [Component 1]\n- [Component 2]\n- [Component 3]\n\nIt's [price/offer details].${sign(c)}`, ctaText: `Get ${p}` },
      ];
    case "launch":
      return [
        { day: -3, subject: "Something new is coming", altSubjects: ["A heads-up", "I've been working on something"], preview: "A quick heads-up before it's available.", body: `Hi [First name],\n\nI've been working on something for ${who}: ${p}.\n\nIt's designed to help you ${out} — [one-line description].\n\nIt will be available on [launch date]. I'll send you the details then.${sign(c)}`, ctaText: "" },
        { day: -1, subject: `Why I created ${p}`, altSubjects: ["The story behind it", "Here's what it's for"], preview: "The problem it solves.", body: `Hi [First name],\n\n[Share the honest reason you created this — the problem you kept seeing.]\n\n${p} is my answer to that. Tomorrow you'll be able to get it.${sign(c)}`, ctaText: "" },
        { day: 0, subject: `${p} is available now`, altSubjects: ["It's here", "Doors are open"], preview: "Here's everything that's included.", body: `Hi [First name],\n\n${p} is now available.\n\nInside you'll find:\n\n- [Component 1]\n- [Component 2]\n- [Bonus, if any]\n\nPrice: [price].\n\n[Link]${sign(c)}`, ctaText: `Get ${p}` },
        { day: 1, subject: "Your questions, answered", altSubjects: ["Is it right for you?", "A few quick answers"], preview: "Who it's for (and who it isn't for).", body: `Hi [First name],\n\nA few people have asked:\n\nWho is it for? ${who}.\nWhat format is it? [Format and how it's delivered.]\nWhat if it's not right for me? [Your refund policy.]\n\nAny other questions? Just reply.${sign(c)}`, ctaText: "See the details" },
        { day: 3, subject: "A practical example from inside", altSubjects: ["Here's a sneak peek", "What one section looks like"], preview: "A sample of what's inside.", body: `Hi [First name],\n\nHere's one idea from ${p}: [short, genuinely useful excerpt].\n\nThere's more like this in [number] sections.\n\n[Link]${sign(c)}`, ctaText: `Get ${p}` },
        { day: 5, subject: "[Only if true] Launch pricing ends [date]", altSubjects: ["Last reminder", "A final note"], preview: "Only send this if you really have a deadline.", body: `Hi [First name],\n\n[Only use this email if your launch price genuinely ends on a set date.]\n\nThe launch price for ${p} ends on [date and time]. After that it will be [new price].\n\n[Link]${sign(c)}`, ctaText: `Get ${p}` },
      ];
    case "sales":
      return [
        { day: 0, subject: `Struggling to ${out}?`, altSubjects: ["Does this sound familiar?", "If this is you…"], preview: "You're not the only one.", body: `Hi [First name],\n\n[Describe the reader's frustration in their own words.]\n\nYou're not doing anything wrong — [reframe].\n\n${p} helps by [how it helps].${sign(c)}`, ctaText: "Learn more" },
        { day: 2, subject: "What changes when you get this right", altSubjects: ["Picture this", "The difference it makes"], preview: "What life looks like on the other side.", body: `Hi [First name],\n\nImagine [describe the realistic positive outcome — no exaggerated promises].\n\nThat's what ${p} is designed to help with.${sign(c)}`, ctaText: `See ${p}` },
        { day: 4, subject: `What's inside ${p}`, altSubjects: ["Here's what you get", "A look inside"], preview: "Everything that's included.", body: `Hi [First name],\n\nHere's exactly what you get:\n\n- [Component 1]: [what it helps with]\n- [Component 2]: [what it helps with]\n- [Component 3]: [what it helps with]\n\n[Link]${sign(c)}`, ctaText: `Get ${p}` },
        { day: 6, subject: "Is it right for you?", altSubjects: ["Who this is (and isn't) for", "An honest answer"], preview: "Who will get the most from it.", body: `Hi [First name],\n\n${p} is a good fit if [fit criteria]. It's probably not for you if [not a fit].\n\n[Refund policy, if any.]${sign(c)}`, ctaText: "Get access" },
      ];
    case "follow-up":
      return [
        { day: 0, subject: `Thanks for getting ${p}!`, altSubjects: ["Your access details", "You're in"], preview: "How to get started.", body: `Hi [First name],\n\nThank you for your purchase! You can access ${p} here: [link].\n\nBest place to start: [section].${sign(c)}`, ctaText: "Access your product" },
        { day: 2, subject: "Quick tip to get the most from it", altSubjects: ["Start here", "One small step"], preview: "Make your first win easy.", body: `Hi [First name],\n\nA quick tip: [how to get a first result quickly].\n\nHave you had a chance to start yet?${sign(c)}`, ctaText: "" },
        { day: 5, subject: "How's it going?", altSubjects: ["Checking in", "Any questions?"], preview: "I'd love to hear from you.", body: `Hi [First name],\n\nJust checking in. How are you finding ${p}?\n\nIf anything's unclear, reply and I'll help.${sign(c)}`, ctaText: "" },
        { day: 10, subject: "Would you share your experience?", altSubjects: ["A small favour", "Your feedback"], preview: "Only if you found it useful.", body: `Hi [First name],\n\nIf ${p} has been useful, would you tell me what's changed for you? With your permission, I may share your words with others.\n\nJust hit reply.${sign(c)}`, ctaText: "" },
      ];
    case "broadcast":
      return [{ day: 0, subject: `[Offer] ${p}`, altSubjects: [`A note about ${p}`, "Something you might find useful"], preview: "[One-line summary of the offer].", body: `Hi [First name],\n\n[Why you're writing today — keep it genuine.]\n\n${p} helps ${who} ${out}. [Offer details — price, any bonus, and any real end date.]\n\n[Link]${sign(c)}`, ctaText: `Get ${p}` }];
    case "abandoned-checkout":
      return [
        { day: 0, subject: "Did something go wrong?", altSubjects: ["Your order isn't complete", "Can I help?"], preview: "Your checkout wasn't finished.", body: `Hi [First name],\n\nI noticed you started checking out for ${p} but didn't finish. If something went wrong, you can pick up where you left off here: [checkout link].\n\nAny questions? Just reply.${sign(c)}`, ctaText: "Complete your order" },
        { day: 1, subject: `Questions about ${p}?`, altSubjects: ["Anything I can answer?", "Still deciding?"], preview: "Happy to help you decide.", body: `Hi [First name],\n\nIf you're still deciding, here's what's included: [summary].\n\n[Refund policy, if any.]\n\n[Checkout link]${sign(c)}`, ctaText: "Return to checkout" },
      ];
  }
}

export function templateEmails(type: EmailSequenceType, c: EmailContext, ctaUrl: string): EmailItem[] {
  return emailTemplates(type, c).map((t) => ({ ...t, id: uid("em"), ctaUrl: t.ctaText ? ctaUrl : "", notes: "" }));
}

export function sortEmails(list: EmailItem[]): EmailItem[] {
  return [...list].sort((a, b) => a.day - b.day);
}

export function dayLabel(day: number): string {
  if (day === 0) return "Day 0";
  return day < 0 ? `${Math.abs(day)} day${Math.abs(day) === 1 ? "" : "s"} before` : `Day ${day}`;
}

export function campaignText(d: EmailCampaignData, title: string): string {
  const lines = [`${title}`, `${EMAIL_SEQUENCE_LABELS[d.sequenceType]}${d.goal ? ` — ${d.goal}` : ""}`, ""];
  sortEmails(d.emails).forEach((e, i) => {
    lines.push(`==== Email ${i + 1} · ${dayLabel(e.day)} ====`, `Subject: ${e.subject}`);
    if (e.altSubjects.length) lines.push(`Alternative subjects: ${e.altSubjects.join(" | ")}`);
    lines.push(`Preview: ${e.preview}`, "", e.body, "");
    if (e.ctaText) lines.push(`Button: ${e.ctaText}${e.ctaUrl ? ` → ${e.ctaUrl}` : ""}`, "");
  });
  return lines.join("\n");
}

export function campaignMarkdown(d: EmailCampaignData, title: string): string {
  const lines = [`# ${title}`, "", `**${EMAIL_SEQUENCE_LABELS[d.sequenceType]}**${d.goal ? ` — ${d.goal}` : ""}`, ""];
  sortEmails(d.emails).forEach((e, i) => {
    lines.push(`## Email ${i + 1} (${dayLabel(e.day)}): ${e.subject}`, "", `**Preview text:** ${e.preview}`, "");
    if (e.altSubjects.length) lines.push(`**Alternative subjects:** ${e.altSubjects.join(" · ")}`, "");
    lines.push(e.body, "");
    if (e.ctaText) lines.push(`**Button:** ${e.ctaText}${e.ctaUrl ? ` (${e.ctaUrl})` : ""}`, "");
  });
  return lines.join("\n");
}

export function campaignCsv(d: EmailCampaignData): string {
  return Papa.unparse(sortEmails(d.emails).map((e, i) => ({ order: i + 1, day: e.day, subject: e.subject, alternative_subjects: e.altSubjects.join(" | "), preview_text: e.preview, body: e.body, button_text: e.ctaText, button_url: e.ctaUrl, notes: e.notes })));
}
