import { test, expect } from "@playwright/test";
import { exportVia, isZip, login } from "./helpers";

test.describe("Product Studio", () => {
  test("builds a workbook from source chapters, saves it and exports it", async ({ page }) => {
    await login(page);
    await page.goto("/product-builder");
    await page.getByTestId("format-workbook").click();
    await page.getByTestId("builder-template").click();
    await expect(page.locator("[data-testid=draft-chapters] li").first()).toBeVisible();
    await page.getByTestId("builder-save").click();
    await expect(page.getByTestId("builder-open")).toBeVisible();
    await expect(page.locator("[data-testid=built-list] > *")).toHaveCount(1);
    const docx = await exportVia(page, "docx");
    expect(isZip(docx.bytes)).toBe(true);
  });

  test("AI draft in the Bonus Builder (test provider) is split into parts", async ({ page }) => {
    await login(page);
    await page.goto("/bonus-builder");
    await page.getByTestId("format-checklist").click();
    await page.getByTestId("builder-ai").click();
    await expect(page.getByTestId("draft-chapters")).toContainText("[TEST OUTPUT]", { timeout: 30_000 });
    expect(await page.locator("[data-testid=draft-chapters] li").count()).toBe(3);
  });

  test("Opportunity Scanner labels estimates and hands off to a builder", async ({ page }) => {
    await login(page);
    await page.goto("/opportunities");
    await page.getByTestId("create-asset").click();
    await expect(page.getByTestId("opportunity").first()).toBeVisible();
    await expect(page.getByText("Estimates, not market research")).toBeVisible();
    await expect(page.getByText("Price idea (estimate)").first()).toBeVisible();
    await page.getByTestId("build-this").first().click();
    await expect(page.getByTestId("draft-chapters")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/From the Opportunity Scanner/)).toBeVisible();
    await page.getByTestId("builder-save").click();
    await expect(page.getByTestId("builder-open")).toBeVisible();
  });

  test("Lead Magnet Creator can create a matching cover", async ({ page }) => {
    await login(page);
    await page.goto("/lead-magnets");
    await page.getByTestId("format-checklist").click();
    await page.getByTestId("builder-template").click();
    await page.getByTestId("builder-save").click();
    await page.getByRole("button", { name: /^Cover$/ }).first().click();
    await expect(page.locator("[data-testid=cover-stage] canvas").first()).toBeVisible({ timeout: 30_000 });
  });
});
