import type { RightCheck, RightsReviewData, RightStatus } from "@/lib/models/research";
import { RIGHT_STATUS_LABELS } from "@/lib/models/research";

/**
 * Licence clause finder. It only points at wording that MAY be relevant to each right so the user can read it in
 * context. It never decides whether something is allowed — the user records that themselves.
 */
const TERMS: Record<string, RegExp[]> = {
  "sell-digital": [/\bsell\b/i, /\bresell\b/i, /\bcharge\b/i, /\bcommercial\b/i, /\bdigital\b/i],
  "lead-magnet": [/lead magnet/i, /opt-?in/i, /list[- ]building/i, /\bsubscribers?\b/i, /\bgive ?away\b/i],
  membership: [/membership/i, /subscription/i, /members?\b/i],
  bundle: [/\bbundle/i, /\bbonus/i, /package/i, /\bpackaged\b/i],
  "blog-email": [/\bblog/i, /articles?/i, /e-?mails?/i, /newsletter/i, /autorespond/i],
  "course-video": [/\bcourse/i, /\bvideo/i, /\baudio/i, /podcast/i, /\bmedia\b/i],
  print: [/\bprint/i, /paperback/i, /physical/i, /print[- ]on[- ]demand/i, /\bpod\b/i],
  marketplaces: [/amazon/i, /kindle/i, /\bkdp\b/i, /etsy/i, /marketplace/i, /ebay/i, /clickbank/i, /warrior/i],
  "client-work": [/client/i, /ghostwrit/i, /done[- ]for[- ]you/i],
  edit: [/\bedit/i, /\bmodif/i, /\bchange/i, /\balter/i, /rewrite/i],
  "title-cover": [/\btitle/i, /\bcover/i, /\brename/i, /graphics?/i],
  "own-name": [/your (own )?name/i, /\bauthor/i, /\bclaim\b/i, /authorship/i, /\bbyline/i],
  translate: [/translat/i, /language/i],
  "pass-plr": [/private label/i, /\bplr\b/i, /sell licens/i],
  "pass-mrr": [/master resell/i, /master resale/i, /\bmrr\b/i, /\bmaster\b/i],
  "pass-rr": [/resell rights/i, /resale rights/i, /\b(rr)\b/i],
  "own-price": [/\bprice\b/i, /\bpricing\b/i],
  "min-price": [/minimum/i, /\bat least \$/i, /no less than/i, /\bfree\b/i, /\$\s?\d/i],
  "free-giveaway": [/\bfree\b/i, /give ?away/i, /distribut/i],
  "giveaway-events": [/giveaway/i, /\bjv\b/i, /joint venture/i],
  auction: [/auction/i, /ebay/i],
  unedited: [/as[- ]is/i, /unedited/i, /original form/i, /without (any )?changes/i, /substantial/i],
  "sell-licence": [/transfer/i, /the licen[cs]e itself/i, /sub-?licen/i],
  credit: [/credit/i, /attribut/i, /acknowledg/i],
  images: [/image/i, /graphic/i, /photo/i, /picture/i, /stock/i, /fonts?/i],
};

const NEGATION = /\b(not|no|never|cannot|can't|may not|must not|prohibited|forbidden|without permission|strictly)\b/i;

export interface ClauseMatch {
  text: string;
  negative: boolean;
}

/** Splits licence text into short clauses (lines / bullet items / sentences). */
export function licenceClauses(text: string): string[] {
  return text
    .split(/\n+|(?<=[.;!?])\s+(?=[A-Z[(])/)
    .map((s) => s.replace(/^[\s\-–•*\[\]]+(?:\[\s?[x ]?\s?\])?\s*/i, "").trim())
    .filter((s) => s.length > 4 && s.length < 600);
}

export function findClauses(text: string, key: string, max = 4): ClauseMatch[] {
  const terms = TERMS[key];
  if (!terms || !text.trim()) return [];
  const out: ClauseMatch[] = [];
  for (const c of licenceClauses(text)) {
    if (terms.some((t) => t.test(c))) out.push({ text: c, negative: NEGATION.test(c) });
    if (out.length >= max) break;
  }
  return out;
}

export interface RightsSummary {
  counts: Record<RightStatus, number>;
  reviewed: number;
  total: number;
  byStatus: Record<RightStatus, RightCheck[]>;
}

export function rightsSummary(d: RightsReviewData): RightsSummary {
  const counts = { "not-reviewed": 0, allowed: 0, "not-allowed": 0, conditional: 0, unclear: 0 } as Record<RightStatus, number>;
  const byStatus = { "not-reviewed": [], allowed: [], "not-allowed": [], conditional: [], unclear: [] } as Record<RightStatus, RightCheck[]>;
  for (const c of d.checks) {
    counts[c.status]++;
    byStatus[c.status].push(c);
  }
  return { counts, reviewed: d.checks.length - counts["not-reviewed"], total: d.checks.length, byStatus };
}

/** Automatic reminders based on what has (not) been recorded. These are prompts to check, not conclusions. */
export function automaticWarnings(d: RightsReviewData): string[] {
  const w: string[] = [];
  const get = (k: string) => d.checks.find((c) => c.key === k);
  if (!d.licenceText.trim()) w.push("No licence text saved yet. Paste or import the vendor's licence so you can check each right against it.");
  if (d.licenceType === "unknown") w.push("Licence type not recorded. Use the type the licence itself states.");
  const mrr = get("pass-mrr");
  if (mrr && mrr.status !== "allowed" && mrr.status !== "not-allowed") w.push("Master Resell Rights are not automatically included with PLR. Don't offer MRR to buyers unless the licence explicitly grants it.");
  if (mrr?.status === "allowed" && !mrr.evidence.trim()) w.push("You marked “Pass on Master Resell Rights” as allowed without quoting the licence wording. Add the exact clause as evidence.");
  const unclear = d.checks.filter((c) => c.status === "unclear");
  if (unclear.length) w.push(`${unclear.length} right${unclear.length === 1 ? " is" : "s are"} marked unclear — confirm with the seller before relying on ${unclear.length === 1 ? "it" : "them"}.`);
  const allowedNoEvidence = d.checks.filter((c) => c.status === "allowed" && !c.evidence.trim()).length;
  if (allowedNoEvidence) w.push(`${allowedNoEvidence} “allowed” right${allowedNoEvidence === 1 ? " has" : "s have"} no quoted evidence. Quoting the clause makes your record easier to check later.`);
  const mp = get("marketplaces");
  if (mp?.status === "allowed") w.push("Marketplaces such as Amazon KDP have their own content rules for PLR — check the marketplace's policy as well as the licence.");
  if (get("images")?.status === "not-reviewed") w.push("Images and graphics often have separate terms. Check them before reusing any graphics.");
  return w;
}

export function rightsReport(d: RightsReviewData, title: string): string {
  const s = rightsSummary(d);
  const lines: string[] = [`# ${title}`, "", `_Your own record of the licence terms — not legal advice._`, ""];
  lines.push(`**Licence:** ${d.licenceName || "—"} (${d.licenceType})`, `**Product:** ${d.source.productName || "—"}`, `**Vendor:** ${d.source.vendor || "—"}`, `**Purchased:** ${d.source.purchaseDate || "—"} ${d.source.orderRef ? `· Order ${d.source.orderRef}` : ""}`, `**Reviewed:** ${d.reviewedAt ? new Date(d.reviewedAt).toLocaleDateString() : "Not marked as reviewed"}`, "");
  if (d.summary) lines.push("## Summary", "", d.summary, "");
  for (const st of ["allowed", "conditional", "not-allowed", "unclear", "not-reviewed"] as RightStatus[]) {
    if (!s.byStatus[st].length) continue;
    lines.push(`## ${RIGHT_STATUS_LABELS[st]}`, "");
    for (const c of s.byStatus[st]) lines.push(`- **${c.label}**${c.evidence ? ` — “${c.evidence}”` : ""}${c.notes ? ` (${c.notes})` : ""}`);
    lines.push("");
  }
  const notes: [string, string][] = [
    ["Attribution", d.attribution],
    ["Resale rights", d.resaleNotes],
    ["Modification rights", d.modificationNotes],
    ["Distribution restrictions", d.distributionNotes],
  ];
  for (const [h, t] of notes) if (t.trim()) lines.push(`## ${h}`, "", t, "");
  const warnings = [...d.warnings, ...automaticWarnings(d)];
  if (warnings.length) lines.push("## Warnings", "", ...warnings.map((x) => `- ${x}`), "");
  lines.push("## Pre-sale checklist", "", ...d.checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.label}`), "");
  if (d.licenceText.trim()) lines.push("## Licence text", "", ...d.licenceText.split("\n").map((l) => `> ${l}`), "");
  return lines.join("\n");
}
