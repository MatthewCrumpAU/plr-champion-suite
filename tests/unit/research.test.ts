import { describe, expect, it } from "vitest";
import { autoCluster, guessType, keywordsFromCsv, keywordsToCsv, mergeKeywords, newKeyword, parseKeywordCsv, patternKeywords } from "@/lib/research/keywords";
import { automaticWarnings, findClauses, rightsSummary } from "@/lib/research/rights";
import { defaultRightsReviewData } from "@/lib/models/defaults";

describe("keywords", () => {
  it("generates labelled pattern keywords without metrics", () => {
    const list = patternKeywords("Morning Routine", { audience: "Remote workers", kinds: ["long-tail", "question", "product"] });
    expect(list.length).toBeGreaterThan(20);
    expect(list.every((k) => k.source === "pattern")).toBe(true);
    expect(list.every((k) => k.metrics.volume === null && k.metrics.cpc === null && k.metrics.competition === null && k.metrics.metricsSource === null)).toBe(true);
    expect(list.some((k) => k.keyword === "morning routine for remote workers")).toBe(true);
  });

  it("guesses types", () => {
    expect(guessType("how to start a morning routine")).toBe("question");
    expect(guessType("morning routine planner")).toBe("product");
    expect(guessType("simple morning routine for busy parents")).toBe("long-tail");
  });

  it("merges without duplicates and lets CSV fill metrics", () => {
    const a = [newKeyword("focus tips")];
    const b = [newKeyword("Focus Tips"), newKeyword("deep work")];
    const r = mergeKeywords(a, b);
    expect(r.added).toBe(1);
    expect(r.keywords).toHaveLength(2);
    const withMetrics = newKeyword("focus tips", { source: "csv", metrics: { volume: 1200, cpc: 1.5, competition: "Low", metricsSource: "CSV: x.csv" } });
    const r2 = mergeKeywords(r.keywords, [withMetrics]);
    expect(r2.updated).toBe(1);
    expect(r2.keywords.find((k) => k.keyword === "focus tips")?.metrics.volume).toBe(1200);
  });

  it("clusters by shared distinctive words", () => {
    const ks = ["focus music for work", "best focus music", "deep work timer", "pomodoro timer app", "what is deep work"].map((k) => newKeyword(k));
    const m = autoCluster(ks, "focus");
    expect(m.get(ks[0].id)).toBe("Music");
    expect(m.get(ks[1].id)).toBe("Music");
    expect(m.get(ks[2].id)).toBe("Deep");
    expect(m.get(ks[4].id)).toBe("Deep");
    expect(m.get(ks[3].id)).toBe("Timer");
  });

  it("imports CSV with column mapping and records the metrics source", () => {
    const csv = "Keyword,Avg. monthly searches,Competition,Top of page bid (high range)\nfocus music,\"1,000\",Low,$1.20\ndeep work,10K,Medium,\n";
    const p = parseKeywordCsv(csv, "planner.csv");
    expect(p.guess.keyword).toBe("Keyword");
    expect(p.guess.volume).toBe("Avg. monthly searches");
    const ks = keywordsFromCsv(p, p.guess);
    expect(ks[0].metrics).toEqual({ volume: 1000, competition: "Low", cpc: 1.2, metricsSource: "CSV: planner.csv" });
    expect(ks[1].metrics.volume).toBe(10000);
    expect(keywordsToCsv(ks)).toContain("CSV: planner.csv");
  });
});

describe("rights review helpers", () => {
  const licence = "[YES] Can be edited completely.\n[YES] Can put your name on it as the author.\n[NO] Cannot be given away for free.\n[NO] Can NOT sell Master Resell Rights.\nCan be sold on Amazon Kindle only after substantial changes.";
  it("finds possibly relevant clauses and flags restriction words", () => {
    const m = findClauses(licence, "pass-mrr");
    expect(m[0].text).toContain("Master Resell Rights");
    expect(m[0].negative).toBe(true);
    expect(findClauses(licence, "own-name")[0].text).toContain("your name");
    expect(findClauses(licence, "marketplaces")[0].text).toContain("Amazon");
  });

  it("never assumes MRR and reminds the user", () => {
    const d = defaultRightsReviewData({ licenceText: licence, licenceType: "plr" });
    expect(automaticWarnings(d).some((w) => w.includes("Master Resell Rights are not automatically included"))).toBe(true);
    expect(rightsSummary(d).reviewed).toBe(0);
  });
});
