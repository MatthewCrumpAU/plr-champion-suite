import { describe, expect, it } from "vitest";
import type { Asset, Project } from "@/lib/data/types";
import { WORKFLOW, workflowStatus } from "@/lib/workflow";

const project = { id: "p1", stage: "idea" } as unknown as Project;
const asset = (type: string, data: Record<string, unknown> = {}, extra: Partial<Asset> = {}) => ({ id: `${type}-${Math.random()}`, projectId: "p1", type, data, status: "draft", deletedAt: null, ...extra }) as unknown as Asset;

describe("project workflow", () => {
  it("starts with nothing done and points at the import step", () => {
    const s = workflowStatus([], project);
    expect(s.total).toBe(WORKFLOW.length);
    expect(s.done).toBe(0);
    expect(s.next?.id).toBe("import");
  });

  it("only counts real work, ignores trashed items and needs a reviewed licence", () => {
    const assets = [
      asset("document", { role: "source" }),
      asset("rights-review", { reviewedAt: null }),
      asset("cover", {}, { deletedAt: "2026-01-01T00:00:00.000Z" }),
      asset("email-campaign", { emails: [] }),
    ];
    const s = workflowStatus(assets, project);
    expect(s.steps.find((x) => x.id === "import")?.isDone).toBe(true);
    expect(s.steps.find((x) => x.id === "rights")?.isDone).toBe(false);
    expect(s.steps.find((x) => x.id === "cover")?.isDone).toBe(false);
    expect(s.steps.find((x) => x.id === "emails")?.isDone).toBe(false);
    expect(s.next?.id).toBe("rights");
  });

  it("marks the export step from a recorded package export", () => {
    expect(workflowStatus([], project, true).steps.find((x) => x.id === "export")?.isDone).toBe(true);
  });
});
