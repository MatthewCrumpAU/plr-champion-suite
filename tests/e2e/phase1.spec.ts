import { test, expect } from "@playwright/test";
import { confirmDialog, exportVia, fixture, isZip, login, waitSaved } from "./helpers";

/** Phase 1 acceptance: the core PLR Editor & Profit Studio workflows end to end. */
test.describe("Phase 1 — core editor workflows", () => {
  test("Rebrand Assistant: new brand, rule proposals, accept, save as a separate rebranded document", async ({ page }) => {
    await login(page);
    await page.goto("/rebrand");
    await page.getByTestId("create-asset").click();
    // Step 1: source document (the sample product is preselected).
    await expect(page.getByText(/chapters/).first()).toBeVisible();
    await page.getByRole("button", { name: /Next: new brand/ }).click();
    // Step 2: describe the new brand.
    await page.getByTestId("rb-new-name").fill("The Focus Reset Method");
    await page.fill("#rb-au", "Matthew Crump");
    await page.getByRole("button", { name: /Next: replacements/ }).click();
    // Step 3: replacement rules are suggested from the brand details.
    await expect(page.locator("input[aria-label=Replace]").first()).toHaveValue(/Focus Reset Method|Matthew Crump/);
    await page.getByRole("button", { name: /Next: proposals|Next: review/ }).click();
    // Step 4: generate rule-based proposals and accept them all.
    await page.getByTestId("rb-generate-rules").click();
    await expect(page.locator("[data-testid=rb-proposals] li").first()).toBeVisible();
    await page.getByTestId("rb-accept-all").click();
    await page.getByRole("button", { name: /Next: save/ }).click();
    // Step 5: save as a separate document; the original stays untouched.
    await page.getByTestId("rb-save").click();
    await expect(page.getByText("Open the rebranded document")).toBeVisible({ timeout: 20_000 });
    await page.getByText("Open the rebranded document").click();
    await expect(page.getByTestId("doc-editor")).toBeVisible();
    await expect(page.getByTestId("doc-editor")).toContainText("The Focus Reset Method");
  });

  test("Editor: AI rewrite of a chapter needs approval and saves a version first", async ({ page }) => {
    await login(page);
    await page.goto("/editor");
    await page.locator("a[aria-label^='Open The Calm']").click();
    await expect(page.getByTestId("doc-editor")).toBeVisible();
    await page.getByTestId("tab-ai").click();
    await page.getByRole("button", { name: "Improve clarity", exact: true }).first().click();
    await page.getByTestId("ai-run").click();
    await expect(page.getByTestId("ai-replace")).toBeVisible({ timeout: 30_000 });
    // Nothing changes until the suggestion is approved.
    await expect(page.getByTestId("doc-editor")).not.toContainText("[TEST OUTPUT]");
    await page.getByTestId("ai-replace").click();
    await confirmDialog(page);
    await expect(page.getByTestId("doc-editor")).toContainText("[TEST OUTPUT]");
    await waitSaved(page);
    await page.getByTestId("open-history").click();
    await expect(page.getByRole("dialog").getByText("Before AI").first()).toBeVisible();
  });

  test("Editor: chapter add, rename, find & replace rule, and persistence", async ({ page }) => {
    await login(page);
    await page.goto("/editor");
    await page.getByTestId("open-import").click();
    await page.setInputFiles("[data-testid=import-drop] input[type=file]", fixture("focus-freedom.docx"));
    await page.getByTestId("confirm-import").click();
    await expect(page.getByTestId("chapter-row")).toHaveCount(3);
    await page.getByTestId("add-chapter").click();
    await expect(page.getByTestId("chapter-row")).toHaveCount(4);
    await page.getByTestId("chapter-title").fill("Bonus: Weekly Review");
    await page.getByTestId("tab-tools").click();
    await page.getByTestId("add-rule").click();
    await page.locator("input[placeholder='Find']").last().fill("focus");
    await page.locator("input[aria-label='Replace with']").last().fill("attention");
    await page.getByTestId("apply-rules").click();
    await confirmDialog(page);
    // A version is saved before the replacements are applied; wait for them to be applied, then saved.
    await expect(page.getByText(/^Applied \d+ replacements? to all chapters$/)).toBeVisible();
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId("chapter-row")).toHaveCount(4);
    await expect(page.getByTestId("chapter-row").filter({ hasText: "Bonus: Weekly Review" })).toHaveCount(1);
    await page.getByTestId("chapter-row").first().click();
    await expect(page.getByTestId("doc-editor")).toContainText("attention");
  });

  test("Product Builder: creates an ebook from the PLR chapters and exports it", async ({ page }) => {
    await login(page);
    await page.goto("/product-builder");
    await page.getByTestId("format-ebook").click();
    await page.getByTestId("builder-template").click();
    const parts = page.locator("[data-testid=draft-chapters] li");
    await expect(parts.first()).toBeVisible();
    expect(await parts.count()).toBeGreaterThanOrEqual(3);
    await page.getByTestId("builder-save").click();
    await expect(page.getByTestId("builder-open")).toBeVisible();
    const docx = await exportVia(page, "docx");
    expect(isZip(docx.bytes)).toBe(true);
  });
});
