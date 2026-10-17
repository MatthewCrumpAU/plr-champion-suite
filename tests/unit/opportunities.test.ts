import { describe, expect, it } from "vitest";
import { B } from "@/lib/doc/build";
import { newChapter } from "@/lib/models/document";
import { analyseOpportunities, coreTopic, opportunityFromAI } from "@/lib/content/opportunities";

const chapters = Array.from({ length: 6 }, (_, i) =>
  newChapter(
    `Chapter ${i + 1}: Topic ${i + 1}`,
    B.doc(
      B.p("Focus matters for remote workers. You should block two hours each morning. Why do we lose focus so easily?"),
      B.h(2, "How to set up a focus block"),
      B.ul(["Turn off notifications", "Close email", "Set a timer for 50 minutes", "Write down distractions"]),
      B.p("Repeat this every day for a week and review the results. ".repeat(20)),
    ),
  ),
);

describe("opportunity analysis", () => {
  it("derives the core topic from a title", () => {
    expect(coreTopic("The Calm Productivity Blueprint")).toBe("Calm Productivity");
    expect(coreTopic("SAMPLE — Work From Home Secrets")).toBe("Work From Home");
  });

  it("computes stats and suggests several labelled opportunities", () => {
    const { stats, opportunities } = analyseOpportunities({ title: "The Calm Productivity Blueprint", audience: "remote workers", chapters });
    expect(stats.chapters).toBe(6);
    expect(stats.actionSteps).toBeGreaterThan(5);
    expect(stats.howToHeadings).toBe(6);
    const formats = opportunities.map((o) => o.format);
    expect(formats).toEqual(expect.arrayContaining(["checklist", "workbook", "email-course", "cheat-sheet", "ebook"]));
    for (const o of opportunities) {
      expect(o.rating).toBeGreaterThanOrEqual(1);
      expect(o.rating).toBeLessThanOrEqual(5);
      expect(o.priceHigh).toBeGreaterThanOrEqual(o.priceLow);
      expect(o.sourceChapterIds.length).toBeGreaterThan(0);
      expect(o.rationale.length).toBeGreaterThan(10);
    }
  });

  it("maps AI ideas to chapters and never invents a score", () => {
    const o = opportunityFromAI({ format: "workbook", name: "Focus Workbook", sourceChapters: ["Chapter 2: Topic 2"], complexity: "low", funnelRole: "upsell", priceLow: 9, priceHigh: 5 }, chapters);
    expect(o?.sourceChapterIds).toEqual([chapters[1].id]);
    expect(o?.rating).toBe(0);
    expect(o?.priceHigh).toBe(9);
    expect(opportunityFromAI({ name: "" }, chapters)).toBeNull();
  });
});
