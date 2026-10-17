import { countWords } from "./text";
import { FILLER_PHRASES } from "./replace";

export interface TextStats {
  words: number;
  sentences: number;
  paragraphs: number;
  avgSentenceLength: number;
  longSentences: number;
  /** Flesch Reading Ease (0–100+, higher = easier). */
  readingEase: number;
  readingLevel: string;
  readingMinutes: number;
  passiveHints: number;
  fillers: { phrase: string; count: number }[];
}

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = cleaned.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function readingLevelLabel(ease: number): string {
  if (ease >= 80) return "Very easy";
  if (ease >= 70) return "Easy";
  if (ease >= 60) return "Plain English";
  if (ease >= 50) return "Fairly difficult";
  if (ease >= 30) return "Difficult";
  return "Very difficult";
}

export function analyseText(text: string): TextStats {
  const clean = text.replace(/\s+/g, " ").trim();
  const words = countWords(clean);
  const sentenceList = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9"“'‘(])/).filter((s) => countWords(s) > 0);
  const sentences = Math.max(1, sentenceList.length);
  const paragraphs = text.split(/\n+/).filter((p) => p.trim()).length;
  const wordList = clean.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  const syl = wordList.reduce((n, w) => n + syllables(w), 0);
  const avg = words / sentences;
  const ease = words ? 206.835 - 1.015 * avg - 84.6 * (syl / Math.max(1, wordList.length)) : 0;
  const longSentences = sentenceList.filter((s) => countWords(s) > 28).length;
  const passiveHints = (clean.match(/\b(am|is|are|was|were|be|been|being)\s+(\w+ly\s+)?\w+(ed|en)\b/gi) ?? []).length;
  const lower = text.toLowerCase();
  const fillers = FILLER_PHRASES.map((p) => {
    const needle = p.trim().replace(/,$/, "").toLowerCase();
    let count = 0;
    let i = lower.indexOf(needle);
    while (i >= 0) {
      count++;
      i = lower.indexOf(needle, i + needle.length);
    }
    return { phrase: p, count };
  }).filter((f) => f.count > 0);
  const readingEase = Math.round(Math.max(0, Math.min(121, ease)));
  return {
    words,
    sentences: sentenceList.length,
    paragraphs,
    avgSentenceLength: Math.round(avg * 10) / 10,
    longSentences,
    readingEase,
    readingLevel: words ? readingLevelLabel(readingEase) : "—",
    readingMinutes: Math.max(words ? 1 : 0, Math.round(words / 230)),
    passiveHints,
    fillers,
  };
}
