import type { IdeaScores, ItemSource, NicheResearchData, ResearchItem } from "@/lib/models/research";

export const NICHE_SOURCE_TEXT: Record<ItemSource, string> = { manual: "Your note", "ai-hypothesis": "AI hypothesis — unverified", pattern: "Pattern", csv: "Imported" };
const SCORE_KEYS: (keyof IdeaScores)[] = ["demand", "competition", "fit", "effort", "profit"];

export function weightedScore(scores: IdeaScores, weights: IdeaScores): number {
  const keys = SCORE_KEYS;
  const wsum = keys.reduce((n, k) => n + weights[k], 0);
  if (!wsum) return 0;
  return keys.reduce((n, k) => n + scores[k] * weights[k], 0) / wsum;
}


export function researchMarkdown(d: NicheResearchData, title: string) {
  const out: string[] = [`# ${title}`, "", `**Niche:** ${d.niche || "—"}  `, `**Audience:** ${d.audience || "—"}  `, d.subNiches.length ? `**Sub-niches:** ${d.subNiches.join(", ")}` : "", "", "_Items marked “AI hypothesis” are unverified ideas, not market facts._", ""];
  const items = (h: string, list: ResearchItem[]) => {
    if (!list.length) return;
    out.push(`## ${h}`, "");
    for (const i of list) out.push(`- ${i.text}${i.severity ? ` (${i.severity} impact)` : ""}${i.why ? ` — ${i.why}` : ""} _[${NICHE_SOURCE_TEXT[i.source]}${i.validated ? `; validated${i.evidence ? `: ${i.evidence}` : ""}` : ""}]_`);
    out.push("");
  };
  items("Audience needs", d.needs);
  items("Problems", d.problems);
  if (d.ideas.length) {
    out.push("## Product ideas (your scores)", "", "| Idea | Format | Score | Angle |", "| --- | --- | --- | --- |");
    for (const i of [...d.ideas].sort((a, b) => weightedScore(b.scores, d.weights) - weightedScore(a.scores, d.weights))) out.push(`| ${i.name} | ${i.format} | ${weightedScore(i.scores, d.weights).toFixed(1)} | ${i.angle} |`);
    out.push("");
  }
  for (const p of d.personas) {
    out.push(`## Persona: ${p.name}${p.source === "ai-hypothesis" ? " (fictional, AI hypothesis)" : ""}`, "", p.summary, "");
    for (const [k, l] of [["goals", "Goals"], ["pains", "Pains"], ["objections", "Objections"], ["channels", "Channels"]] as const) if (p[k].length) out.push(`**${l}:** ${p[k].join("; ")}`, "");
  }
  if (d.content.length) {
    out.push("## Content opportunities", "");
    for (const c of d.content) out.push(`- ${c.title} (${c.format}, ${c.status})${c.angle ? ` — ${c.angle}` : ""}`);
    out.push("");
  }
  if (d.notes.trim()) out.push("## Notes", "", d.notes, "");
  if (d.references.length) {
    out.push("## Sources", "");
    for (const r of d.references) out.push(`- ${r.url ? `[${r.title || r.url}](${r.url})` : r.title}${r.notes ? ` — ${r.notes}` : ""}`);
  }
  return out.join("\n");
}

