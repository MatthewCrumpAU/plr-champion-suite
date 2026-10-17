import { test, expect } from "@playwright/test";
import { exportVia, fixture, isPdf, isZip, login } from "./helpers";

test.describe("Content Studio", () => {
  test("imports a DOCX, edits with autosave and exports DOCX, PDF and Markdown", async ({ page }) => {
    await login(page);
    await page.goto("/editor");
    await page.getByTestId("open-import").click();
    await page.setInputFiles("[data-testid=import-drop] input[type=file]", fixture("focus-freedom.docx"));
    await expect(page.locator("[data-testid=import-chapters] li")).toHaveCount(3);
    await page.getByTestId("confirm-import").click();
    await expect(page.getByTestId("doc-editor")).toBeVisible();
    await expect(page.getByTestId("chapter-row")).toHaveCount(3);

    // Type, wait for autosave, reload and check it persisted.
    await page.getByTestId("doc-editor").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Persisted by the end-to-end test.");
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "unsaved");
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId("doc-editor")).toContainText("Persisted by the end-to-end test.");

    // Original is preserved for comparison.
    await page.getByTestId("toggle-compare").click();
    await expect(page.getByTestId("compare-view")).toBeVisible();
    await page.getByTestId("toggle-compare").click();

    const docx = await exportVia(page, "docx");
    expect(docx.name).toMatch(/\.docx$/);
    expect(isZip(docx.bytes)).toBe(true);
    const pdf = await exportVia(page, "pdf");
    expect(isPdf(pdf.bytes)).toBe(true);
    const md = await exportVia(page, "md");
    expect(md.text).toContain("Why Focus Matters");
    expect(md.text).toContain("Persisted by the end-to-end test.");
  });

  test("AI Writer works with templates and the AI provider", async ({ page }) => {
    await login(page);
    await page.goto("/ai-writer");
    await page.fill("[data-testid=writer-topic]", "Calm mornings");
    await page.getByTestId("writer-template").click();
    await expect(page.getByTestId("writer-output")).toContainText("Calm mornings");
    await page.getByTestId("writer-generate").click();
    await expect(page.getByTestId("writer-output")).toContainText("[TEST OUTPUT]", { timeout: 30_000 });
    await expect(page.getByTestId("ai-usage")).toBeVisible();
  });

  test("Outline Generator creates an outline and turns it into a document", async ({ page }) => {
    await login(page);
    await page.goto("/outlines");
    await page.getByTestId("create-asset").click();
    await page.fill("[data-testid=outline-topic]", "Remote focus");
    await page.getByTestId("outline-from-template").click();
    await expect(page.getByTestId("outline-item").first()).toBeVisible();
    await page.getByTestId("outline-to-doc").click();
    await expect(page.getByTestId("doc-editor")).toBeVisible();
    expect(await page.getByTestId("chapter-row").count()).toBeGreaterThan(2);
  });

  test("sample document opens with chapters", async ({ page }) => {
    await login(page);
    await page.goto("/editor");
    await page.locator("a[aria-label^='Open The Calm']").click();
    await expect(page.getByTestId("doc-editor")).toBeVisible();
    expect(await page.getByTestId("chapter-row").count()).toBeGreaterThanOrEqual(5);
  });
});
