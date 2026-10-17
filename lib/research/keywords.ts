import Papa from "papaparse";
import type { Keyword, KeywordIntent, KeywordMetrics, KeywordType, ItemSource } from "@/lib/models/research";
import { nowIso, uid } from "@/lib/utils";

/**
 * Keyword helpers. Nothing here invents search volume, competition or CPC: metrics only ever come from a CSV the
 * user imports, numbers they type in, or (in future) a configured data provider.
 */

export const EMPTY_METRICS: KeywordMetrics = { volume: null, competition: null, cpc: null, metricsSource: null };

export const KEYWORD_TYPE_LABELS: Record<KeywordType, string> = { seed: "Seed", "long-tail": "Long-tail", question: "Question", product: "Product", topic: "Topic / category" };
export const INTENT_LABELS: Record<Exclude<KeywordIntent, "">, string> = { informational: "Informational", commercial: "Commercial", transactional: "Transactional", navigational: "Navigational" };
export const SOURCE_LABELS: Record<ItemSource, string> = { manual: "Added by you", "ai-hypothesis": "AI suggestion", pattern: "Pattern", csv: "CSV import" };

export function cleanKeyword(k: string): string {
  return k.toLowerCase().replace(/[“”"]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
}

export function newKeyword(keyword: string, opts: Partial<Omit<Keyword, "id" | "keyword">> = {}): Keyword {
  return { id: uid("kw"), keyword: cleanKeyword(keyword), type: opts.type ?? guessType(keyword), intent: opts.intent ?? guessIntent(keyword), cluster: opts.cluster ?? "", notes: opts.notes ?? "", source: opts.source ?? "manual", metrics: opts.metrics ?? { ...EMPTY_METRICS }, starred: opts.starred ?? false, createdAt: nowIso() };
}

const QUESTION_RE = /^(how|what|why|when|where|which|who|can|should|is|are|do|does|will|best way)\b/i;
const PRODUCT_RE = /\b(ebook|e-book|course|workbook|planner|template|templates|guide|checklist|toolkit|kit|bundle|pdf|printable|worksheet|journal|program|class|masterclass|book)\b/i;
const COMMERCIAL_RE = /\b(best|top|review|reviews|vs|versus|compare|comparison|alternatives?|cheap|affordable)\b/i;
const TRANSACTIONAL_RE = /\b(buy|price|pricing|discount|coupon|deal|download|order|purchase|for sale)\b/i;

export function guessType(k: string): KeywordType {
  const t = k.trim();
  if (QUESTION_RE.test(t) || t.endsWith("?")) return "question";
  if (PRODUCT_RE.test(t)) return "product";
  if (t.split(/\s+/).length >= 4) return "long-tail";
  return "topic";
}

export function guessIntent(k: string): KeywordIntent {
  if (TRANSACTIONAL_RE.test(k)) return "transactional";
  if (COMMERCIAL_RE.test(k) || PRODUCT_RE.test(k)) return "commercial";
  if (QUESTION_RE.test(k)) return "informational";
  return "informational";
}

/** Deterministic keyword patterns built from the seed — clearly labelled "Pattern" in the UI. */
export function patternKeywords(seed: string, opts: { audience?: string; kinds: KeywordType[] }): Keyword[] {
  const s = cleanKeyword(seed);
  if (!s) return [];
  const aud = cleanKeyword(opts.audience ?? "").split(/,| and | who /)[0]?.trim();
  const out: Keyword[] = [];
  const add = (k: string, type: KeywordType, cluster: string) => out.push(newKeyword(k, { type, cluster, source: "pattern" }));
  if (opts.kinds.includes("long-tail")) {
    for (const m of [`${s} for beginners`, `${s} tips`, `${s} ideas`, `${s} step by step`, `${s} mistakes to avoid`, `${s} at home`, `simple ${s} routine`, `${s} plan`, `${s} examples`, `${s} strategies`]) add(m, "long-tail", "Long-tail");
    if (aud) for (const m of [`${s} for ${aud}`, `${s} tips for ${aud}`]) add(m, "long-tail", "Audience");
  }
  if (opts.kinds.includes("question")) {
    for (const m of [`what is ${s}`, `how to start ${s}`, `how to get better at ${s}`, `why is ${s} important`, `how long does ${s} take`, `what are the benefits of ${s}`, `is ${s} worth it`, `how to stay consistent with ${s}`]) add(m, "question", "Questions");
  }
  if (opts.kinds.includes("product")) {
    for (const m of [`${s} ebook`, `${s} course`, `${s} workbook`, `${s} planner`, `${s} checklist`, `${s} template`, `${s} guide pdf`, `${s} printable`]) add(m, "product", "Products");
  }
  if (opts.kinds.includes("topic")) {
    for (const m of [`${s} tools`, `${s} habits`, `${s} techniques`, `${s} motivation`, `${s} for work`, `${s} and productivity`]) add(m, "topic", "Topics");
  }
  return out;
}

/** Adds keywords that are not already present (case-insensitive). Returns the merged list and how many were added. */
export function mergeKeywords(existing: Keyword[], incoming: Keyword[]): { keywords: Keyword[]; added: number; updated: number } {
  const map = new Map(existing.map((k) => [k.keyword, k]));
  let added = 0;
  let updated = 0;
  for (const k of incoming) {
    if (!k.keyword) continue;
    const cur = map.get(k.keyword);
    if (!cur) {
      map.set(k.keyword, k);
      added++;
    } else if (k.metrics.metricsSource && (k.metrics.volume !== null || k.metrics.cpc !== null || k.metrics.competition !== null)) {
      // A CSV import can fill in metrics for keywords already in the list.
      map.set(k.keyword, { ...cur, metrics: k.metrics, intent: cur.intent || k.intent, cluster: cur.cluster || k.cluster });
      updated++;
    }
  }
  return { keywords: [...map.values()], added, updated };
}

/* ------------------------------------------------------------------ */
/* Clustering                                                           */
/* ------------------------------------------------------------------ */
const STOP = new Set(
  "a an and are as at be best by can do does for from get good how i in into is it its me my of on or should the to top vs was what when where which who why will with without you your ways way tips ideas guide step steps simple easy free beginners beginner examples".split(" "),
);

function stem(w: string): string {
  return w.replace(/(ing|ers|er|ies|es|s)$/i, "").replace(/[^a-z0-9]/g, "");
}

/**
 * Groups keywords by their most specific shared word (ignoring the seed's words and stop words).
 * Deterministic and explainable: each cluster is named after the word its members share.
 */
const FALLBACK_CLUSTER: Record<KeywordType, string> = { seed: "Seed", "long-tail": "Long-tail", question: "Questions", product: "Products", topic: "Topics" };

export function autoCluster(keywords: Keyword[], seed: string, minSize = 2): Map<string, string> {
  const seedWords = new Set(cleanKeyword(seed).split(" ").map(stem));
  const tokens = new Map<string, string[]>();
  const display = new Map<string, string>();
  for (const k of keywords) {
    const words = [...new Set(k.keyword.split(/[^a-z0-9']+/i).filter(Boolean))];
    const ts: string[] = [];
    for (const w of words) {
      const st = stem(w.toLowerCase());
      if (!st || st.length < 3 || STOP.has(w.toLowerCase()) || seedWords.has(st)) continue;
      ts.push(st);
      if (!display.has(st)) display.set(st, w.toLowerCase());
    }
    tokens.set(k.id, ts);
  }
  const freq = new Map<string, number>();
  for (const ts of tokens.values()) for (const t of ts) freq.set(t, (freq.get(t) ?? 0) + 1);
  const result = new Map<string, string>();
  for (const k of keywords) {
    const ts = (tokens.get(k.id) ?? []).filter((t) => (freq.get(t) ?? 0) >= minSize);
    if (!ts.length) {
      result.set(k.id, FALLBACK_CLUSTER[k.type]);
      continue;
    }
    // Prefer the most specific shared word (smallest group of at least `minSize`); ties go to the earlier word.
    ts.sort((a, b) => (freq.get(a) ?? 0) - (freq.get(b) ?? 0));
    const word = display.get(ts[0]) ?? ts[0];
    result.set(k.id, word[0].toUpperCase() + word.slice(1));
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* CSV                                                                  */
/* ------------------------------------------------------------------ */
export interface CsvPreview {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  guess: { keyword: string | null; volume: string | null; competition: string | null; cpc: string | null; intent: string | null; cluster: string | null };
}

const findHeader = (headers: string[], patterns: RegExp[]) => headers.find((h) => patterns.some((p) => p.test(h))) ?? null;

export function parseKeywordCsv(text: string, fileName: string): CsvPreview {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const headers = (parsed.meta.fields ?? []).filter(Boolean);
  if (!headers.length) throw new Error("The CSV has no header row. The first row should contain column names such as “Keyword”.");
  const rows = parsed.data.filter((r) => Object.values(r).some((v) => String(v ?? "").trim()));
  return {
    fileName,
    headers,
    rows,
    guess: {
      keyword: findHeader(headers, [/^keyword/i, /^key ?phrase/i, /^query/i, /^search term/i, /^term$/i]) ?? headers[0],
      volume: findHeader(headers, [/volume/i, /searches/i, /avg\.? monthly/i]),
      competition: findHeader(headers, [/^competition$/i, /competition/i, /difficulty/i, /^kd/i]),
      cpc: findHeader(headers, [/cpc/i, /cost per click/i, /top of page bid/i]),
      intent: findHeader(headers, [/intent/i]),
      cluster: findHeader(headers, [/cluster/i, /group/i, /category/i, /topic/i]),
    },
  };
}

const toNumber = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const t = String(v).replace(/[,$£€\s]/g, "").trim();
  if (!t || t === "-" || /^n\/?a$/i.test(t)) return null;
  // Ranges like "1K–10K": keep the lower bound.
  const m = /^(\d+(?:\.\d+)?)([kKmM]?)/.exec(t);
  if (!m) return null;
  const n = Number(m[1]) * (m[2].toLowerCase() === "k" ? 1000 : m[2].toLowerCase() === "m" ? 1_000_000 : 1);
  return Number.isFinite(n) ? n : null;
};

export function keywordsFromCsv(p: CsvPreview, map: CsvPreview["guess"]): Keyword[] {
  if (!map.keyword) throw new Error("Choose which column contains the keywords.");
  const source = `CSV: ${p.fileName}`;
  const intents = new Set(["informational", "commercial", "transactional", "navigational"]);
  return p.rows
    .map((r) => {
      const kw = cleanKeyword(String(r[map.keyword!] ?? ""));
      if (!kw) return null;
      const volume = map.volume ? toNumber(r[map.volume]) : null;
      const cpc = map.cpc ? toNumber(r[map.cpc]) : null;
      const competition = map.competition ? String(r[map.competition] ?? "").trim() || null : null;
      const hasMetrics = volume !== null || cpc !== null || competition !== null;
      const intentRaw = map.intent ? String(r[map.intent] ?? "").toLowerCase().trim() : "";
      return newKeyword(kw, {
        source: "csv",
        cluster: map.cluster ? String(r[map.cluster] ?? "").trim() : "",
        intent: intents.has(intentRaw) ? (intentRaw as KeywordIntent) : guessIntent(kw),
        metrics: hasMetrics ? { volume, cpc, competition, metricsSource: source } : { ...EMPTY_METRICS },
      });
    })
    .filter((k): k is Keyword => !!k);
}

export function keywordsToCsv(list: Keyword[]): string {
  return Papa.unparse(
    list.map((k) => ({
      keyword: k.keyword,
      type: KEYWORD_TYPE_LABELS[k.type],
      intent: k.intent,
      cluster: k.cluster,
      starred: k.starred ? "yes" : "",
      source: SOURCE_LABELS[k.source],
      volume: k.metrics.volume ?? "",
      competition: k.metrics.competition ?? "",
      cpc: k.metrics.cpc ?? "",
      metrics_source: k.metrics.metricsSource ?? "",
      notes: k.notes,
    })),
  );
}
