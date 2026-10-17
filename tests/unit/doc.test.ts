import { describe, expect, it } from "vitest";
import { B } from "@/lib/doc/build";
import { splitIntoChapters, promotePseudoHeadings, mergeChapterContent, splitChapterContent, isChapterLikeText } from "@/lib/doc/chapters";
import { replaceInDoc, countMatches, applyRules, replaceInText } from "@/lib/doc/replace";
import { docToMarkdown, docToPlainText } from "@/lib/doc/markdown";
import { docToHtml } from "@/lib/doc/html";
import { docWords, docText, countWords } from "@/lib/doc/text";
import { diffText } from "@/lib/doc/diff";
import type { PMDoc } from "@/lib/doc/types";

describe("chapter detection", () => {
  it("splits by H1 and keeps preface as Introduction", () => {
    const doc = B.doc(B.p("Preface text"), B.h(1, "Chapter 1: Start"), B.p("one"), B.h(1, "Chapter 2: Next"), B.p("two"));
    const r = splitIntoChapters(doc);
    expect(r.strategyUsed).toBe("h1");
    expect(r.chapters.map((c) => c.title)).toEqual(["Introduction", "Chapter 1: Start", "Chapter 2: Next"]);
    expect(docText(r.chapters[2].content)).toBe("two");
  });

  it("treats a single top H1 as the document title when splitting by H2", () => {
    const doc = B.doc(B.h(1, "My Book"), B.h(2, "First"), B.p("a"), B.h(2, "Second"), B.p("b"));
    const r = splitIntoChapters(doc);
    expect(r.documentTitle).toBe("My Book");
    expect(r.chapters.map((c) => c.title)).toEqual(["First", "Second"]);
  });

  it("detects chapter-like paragraphs and promotes bold-only lines", () => {
    expect(isChapterLikeText("Chapter 3 – Planning")).toBe(true);
    expect(isChapterLikeText("Introduction")).toBe(true);
    expect(isChapterLikeText("This is a normal sentence that happens to be long.")).toBe(false);
    const doc: PMDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Getting Organised", marks: [{ type: "bold" }] }] }, B.p("Body text here.")] };
    const promoted = promotePseudoHeadings(doc);
    expect(promoted.content[0].type).toBe("heading");
  });

  it("merges and splits chapter content", () => {
    const merged = mergeChapterContent(B.doc(B.p("a")), "Part B", B.doc(B.p("b")));
    expect(merged.content.map((n) => n.type)).toEqual(["paragraph", "heading", "paragraph"]);
    const { before, after, afterTitle } = splitChapterContent(merged, 1, "Original");
    expect(afterTitle).toBe("Part B");
    expect(docText(before)).toBe("a");
    expect(docText(after)).toBe("b");
  });
});

describe("find and replace", () => {
  it("replaces across differently formatted text nodes and keeps case", () => {
    const doc: PMDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Work From " }, { type: "text", text: "Home", marks: [{ type: "bold" }] }, { type: "text", text: " secrets. work from home tips." }] }] };
    const r = replaceInDoc(doc, "work from home", "remote work");
    expect(r.count).toBe(2);
    expect(docText(r.doc)).toBe("Remote work secrets. remote work tips.");
  });

  it("supports whole word and case-sensitive matching", () => {
    const doc = B.doc(B.p("The cat scattered. Cat!"));
    expect(countMatches(doc, "cat", { wholeWord: true })).toBe(2);
    expect(countMatches(doc, "cat", { wholeWord: true, caseSensitive: true })).toBe(1);
    expect(countMatches(doc, "cat")).toBe(3);
  });

  it("applies rules in order, including removal of filler phrases", () => {
    const doc = B.doc(B.p("In today's fast-paced world, focus matters."));
    const r = applyRules(doc, [{ find: "In today's fast-paced world, ", replace: "", caseSensitive: false, wholeWord: false, enabled: true }]);
    expect(docText(r.doc)).toBe("focus matters.");
    expect(replaceInText("Old Name and old name", "old name", "New Name").text).toBe("New Name and New Name");
  });
});

describe("serialisers", () => {
  const doc = B.doc(B.h(2, "Steps"), B.p("Use **bold** and *italic*."), B.ol(["First", "Second"]), B.tasks(["Do it"]), B.table(["A", "B"], [["1", "2"]]), B.callout("tip", B.p("Tip text")));

  it("produces markdown", () => {
    const md = docToMarkdown(doc);
    expect(md).toContain("## Steps");
    expect(md).toContain("**bold**");
    expect(md).toContain("1. First");
    expect(md).toContain("- [ ] Do it");
    expect(md).toContain("| A | B |");
    expect(docToPlainText(doc)).toContain("Use bold and italic.");
  });

  it("produces safe html", () => {
    const html = docToHtml(B.doc(B.p("<script>alert(1)</script>"), { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
    expect(docToHtml(doc)).toContain('class="plr-callout"');
  });

  it("counts words", () => {
    expect(countWords("Don't stop — it's well-known 2024 data.")).toBe(6);
    expect(docWords(B.doc(B.p("one two"), B.ul(["three four"])))).toBe(4);
  });
});

describe("diff", () => {
  it("reports change percentage", () => {
    const d = diffText("The quick brown fox", "The quick red fox jumps");
    expect(d.addedWords).toBeGreaterThan(0);
    expect(d.removedWords).toBe(1);
    expect(d.changePercent).toBeGreaterThan(0);
    expect(diffText("same text", "same text").changePercent).toBe(0);
  });
});

describe("title styled as Heading 1", () => {
  it("treats an empty leading H1 as the document title", () => {
    const doc = B.doc(B.h(1, "Focus Freedom Fast"), B.h(1, "Chapter 1: Why"), B.p("a"), B.h(1, "Chapter 2: How"), B.p("b"), B.h(1, "Chapter 3: Next"), B.p("c"));
    const r = splitIntoChapters(doc);
    expect(r.documentTitle).toBe("Focus Freedom Fast");
    expect(r.chapters.map((c) => c.title)).toEqual(["Chapter 1: Why", "Chapter 2: How", "Chapter 3: Next"]);
  });
});
