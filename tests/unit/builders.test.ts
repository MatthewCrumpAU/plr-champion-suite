import { describe, expect, it } from "vitest";
import { B } from "@/lib/doc/build";
import { docText } from "@/lib/doc/text";
import { BUILDER_FORMATS, buildFromTemplate, kindForFormat, partition, toAction, type BuilderKind } from "@/lib/content/builders";

const sources = [
  {
    id: "c1",
    title: "Chapter 1: Set Up Your Workspace",
    content: B.doc(
      B.p("A calm workspace makes focus easier. You should clear your desk before you start each morning."),
      B.h(2, "Choose one spot"),
      B.p("Pick a single place you use only for work. It trains your brain to switch on."),
      B.h(2, "Remove distractions"),
      B.ul(["Turn off phone notifications", "Close unused browser tabs", "Keep a notepad nearby"]),
    ),
  },
  {
    id: "c2",
    title: "Chapter 2: Plan Tomorrow Tonight",
    content: B.doc(B.p("Evening planning reduces morning stress. Write your top three tasks before you finish work."), B.p("Make sure to block time for deep work in your calendar.")),
  },
  { id: "c3", title: "Chapter 3: The Shutdown Routine", content: B.doc(B.p("End the day on purpose. Review what you finished and schedule anything left over."), B.ol(["Review your list", "Schedule leftovers", "Close your laptop"])) },
];

describe("template builders", () => {
  it("detects verb-first actions", () => {
    expect(toAction("You should clear your desk before you start.")).toBe("Clear your desk before you start");
    expect(toAction("Turn off phone notifications")).toBe("Turn off phone notifications");
    expect(toAction("A calm workspace makes focus easier.")).toBeNull();
  });

  it("partitions by chapter or sub-section", () => {
    expect(partition(sources, 2)).toHaveLength(2);
    expect(partition(sources, 3).map((s) => s.title)).toEqual(sources.map((s) => s.title));
    // More parts than chapters → split chapter 1 at its H2s.
    expect(partition(sources, 6).length).toBeGreaterThan(3);
  });

  for (const kind of Object.keys(BUILDER_FORMATS) as BuilderKind[]) {
    for (const f of BUILDER_FORMATS[kind]) {
      it(`builds ${kind} → ${f.format}`, () => {
        const out = buildFromTemplate({ kind, format: f.format, title: "Calm Productivity", audience: "remote workers", units: 3, sources });
        expect(out.chapters.length).toBeGreaterThanOrEqual(3);
        for (const c of out.chapters) {
          expect(c.title.length).toBeGreaterThan(0);
          expect(c.content.type).toBe("doc");
        }
        expect(out.chapters.map((c) => docText(c.content)).join(" ").length).toBeGreaterThan(80);
      });
    }
  }

  it("checklists use real actions from the source", () => {
    const out = buildFromTemplate({ kind: "product", format: "checklist", title: "Calm", audience: "", units: 3, sources });
    const text = out.chapters.map((c) => docText(c.content)).join("\n");
    expect(text).toContain("Turn off phone notifications");
    expect(text).toContain("Write your top three tasks before you finish work");
  });

  it("maps opportunity formats to builders", () => {
    expect(kindForFormat("checklist", "lead-magnet")).toBe("lead-magnet");
    expect(kindForFormat("workbook")).toBe("product");
    expect(kindForFormat("cheat-sheet")).toBe("bonus");
    expect(kindForFormat("short-report")).toBe("lead-magnet");
  });

  it("refuses to build without sources", () => {
    expect(() => buildFromTemplate({ kind: "product", format: "ebook", title: "X", audience: "", units: 3, sources: [] })).toThrow();
  });
});
