import { describe, expect, it } from "vitest";
import { shortTitle } from "@/lib/doc/chapter-title";

describe("shortTitle", () => {
  it("drops a leading chapter number the navigator already shows", () => {
    expect(shortTitle("Chapter 3: Finish Strong")).toBe("Finish Strong");
    expect(shortTitle("Module 12 – Traffic")).toBe("Traffic");
    expect(shortTitle("Part IV. The Plan")).toBe("The Plan");
    expect(shortTitle("lesson 2 - Setup")).toBe("Setup");
  });

  it("keeps titles that are only a number, or have no number prefix", () => {
    expect(shortTitle("Chapter 1")).toBe("Chapter 1");
    expect(shortTitle("Chapter 1:")).toBe("Chapter 1:");
    expect(shortTitle("Why Focus Matters")).toBe("Why Focus Matters");
    expect(shortTitle("Daydreaming: a guide")).toBe("Daydreaming: a guide");
    expect(shortTitle("  ")).toBe("Untitled");
  });
});
