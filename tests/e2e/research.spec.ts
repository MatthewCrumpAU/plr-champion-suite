import { test, expect } from "@playwright/test";
import { exportVia, fixture, isPdf, login, openFirstAsset, confirmDialog } from "./helpers";

test.describe("Research Studio", () => {
  test("Keyword Finder: patterns, CSV metrics with source, clustering and CSV export", async ({ page }) => {
    await login(page);
    await page.goto("/keywords");
    await page.getByTestId("create-asset").click();
    await page.fill("[data-testid=kw-seed]", "remote work focus");
    await page.getByTestId("kw-patterns").click();
    await expect(page.locator("[data-testid=kw-table] tbody tr").first()).toBeVisible();
    // No metrics are invented for pattern keywords.
    await expect(page.locator("[data-testid=kw-table] tbody tr").first().getByLabel("Volume")).toHaveValue("");
    await page.setInputFiles("[data-testid=kw-csv-input]", fixture("keywords.csv"));
    await page.getByTestId("csv-import-confirm").click();
    await page.getByTestId("kw-cluster").click();
    const csv = await exportVia(page, "csv");
    expect(csv.text).toContain("focus tips for remote workers");
    expect(csv.text).toContain("CSV: keywords.csv");
    expect(csv.text).toMatch(/home office setup ideas,[^\n]*8100/);
  });

  test("Rights Review: licence import, clause finder, MRR warning and reviewed state", async ({ page }) => {
    await login(page);
    await openFirstAsset(page, "/rights");
    await page.setInputFiles("input[type=file]", fixture("licence.txt"));
    await confirmDialog(page);
    await expect(page.getByTestId("licence-text")).toHaveValue(/PRIVATE LABEL RIGHTS/);
    await expect(page.getByTestId("auto-warnings")).toContainText("Master Resell Rights are not automatically included");
    await page.getByRole("tab", { name: /Rights/ }).click();
    const mrr = page.getByTestId("right-pass-mrr");
    await mrr.getByRole("button", { name: /Find possibly relevant wording/ }).click();
    await expect(mrr.getByText("contains a restriction word")).toBeVisible();
    await mrr.locator("select").selectOption("not-allowed");
    await expect(page.getByTestId("restricted-uses")).toContainText("Pass on Master Resell Rights");
    const boxes = page.locator("[data-testid=presale-checklist] button[role=checkbox]");
    for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).click();
    await page.getByTestId("mark-reviewed").click();
    await expect(page.getByText(/^Reviewed /).first()).toBeVisible();
    const pdf = await exportVia(page, "pdf");
    expect(isPdf(pdf.bytes)).toBe(true);
  });

  test("Niche Research keeps AI suggestions labelled as hypotheses", async ({ page }) => {
    await login(page);
    await page.goto("/niche-research");
    await page.getByTestId("create-asset").click();
    await page.fill("[data-testid=needs-input]", "Finish work on time");
    await page.keyboard.press("Enter");
    await page.getByTestId("niche-ai-needs").click();
    await expect(page.getByText("AI hypothesis — unverified").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Your note").first()).toBeVisible();
    const md = await exportVia(page, "md");
    expect(md.text).toContain("Finish work on time");
    expect(md.text).toContain("AI hypothesis");
  });
});
