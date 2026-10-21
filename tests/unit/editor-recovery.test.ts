// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { clearRecovery, readRecovery, shouldRestore, writeRecovery } from "@/features/editor/recovery";
import { newChapter } from "@/lib/models/document";

const entry = () => ({ assetId: "ast_1", title: "Doc", status: "draft" as const, chapters: [newChapter("One")], meta: null });

describe("PLR Editor unsaved-edit safety copy", () => {
  beforeEach(() => localStorage.clear());

  it("writes, reads and clears a copy per document", () => {
    expect(writeRecovery(entry(), 1_000)).toBe(true);
    const e = readRecovery("ast_1")!;
    expect(e).toMatchObject({ v: 1, assetId: "ast_1", at: 1_000, title: "Doc" });
    expect(readRecovery("ast_2")).toBeNull();
    clearRecovery("ast_1");
    expect(readRecovery("ast_1")).toBeNull();
  });

  it("restores only when the copy is newer than the stored document", () => {
    writeRecovery(entry(), Date.parse("2026-10-21T10:00:05Z"));
    const e = readRecovery("ast_1");
    // The save never landed: the database still has the earlier version.
    expect(shouldRestore(e, "2026-10-21T10:00:00Z")).toBe(true);
    // The save (or a later edit elsewhere) did land: discard the copy.
    expect(shouldRestore(e, "2026-10-21T10:00:06Z")).toBe(false);
    expect(shouldRestore(null, "2026-10-21T10:00:00Z")).toBe(false);
  });

  it("ignores damaged copies", () => {
    localStorage.setItem("plr-editor-unsaved:ast_1", "{not json");
    expect(readRecovery("ast_1")).toBeNull();
    localStorage.setItem("plr-editor-unsaved:ast_1", JSON.stringify({ v: 1, assetId: "other", at: 1, chapters: [] }));
    expect(readRecovery("ast_1")).toBeNull();
  });
});
