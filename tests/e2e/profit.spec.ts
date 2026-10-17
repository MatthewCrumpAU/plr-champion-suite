import { test, expect } from "@playwright/test";
import { exportVia, login, openFirstAsset, waitSaved } from "./helpers";

test.describe("Profit Studio", () => {
  test("Profit Calculator does real arithmetic and keeps actuals separate", async ({ page }) => {
    await login(page);
    await openFirstAsset(page, "/profit");
    await page.fill("[data-testid=pc-price]", "20");
    await page.fill("[data-testid=pc-traffic]", "1000");
    await page.fill("[data-testid=pc-conv]", "2");
    await page.fill("[data-testid=pc-ads]", "0");
    // 1000 × 2% = 20 sales × $20 = $400 revenue.
    await expect(page.getByTestId("profit-kpis")).toContainText("$400");
    await expect(page.getByText("Projections, not promises")).toBeVisible();
    await page.getByTestId("tab-actuals").click();
    await page.locator("label:has-text('Units sold') input").fill("2");
    await page.locator("label:has-text('Gross revenue') input").fill("40");
    await page.getByTestId("actual-add").click();
    await expect(page.getByTestId("actuals-summary")).toContainText("$40");
    await waitSaved(page);
    await page.reload();
    await page.getByTestId("tab-actuals").click();
    await expect(page.locator("[data-testid=actuals-table] tbody tr")).toHaveCount(1);
    const md = await exportVia(page, "md");
    expect(md.text).toContain("not forecasts or guaranteed earnings");
    expect(md.text).toContain("Actual recorded sales");
  });

  test("Funnel Planner projects hypothetical revenue and keeps versions", async ({ page }) => {
    await login(page);
    await openFirstAsset(page, "/funnels");
    await expect(page.getByTestId("funnel-node")).toHaveCount(4);
    const before = await page.getByTestId("funnel-total").textContent();
    await page.fill("[data-testid=funnel-traffic]", "2000");
    await expect(page.getByTestId("funnel-total")).not.toHaveText(before ?? "");
    await page.getByTestId("add-premium").click();
    await expect(page.getByTestId("funnel-node")).toHaveCount(5);
    await page.getByTestId("node-label").fill("VIP coaching");
    await page.locator(".react-flow__pane").click({ position: { x: 30, y: 30 } });
    await page.getByTestId("funnel-save-version").click();
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId("funnel-node")).toHaveCount(5);
    await expect(page.getByText("VIP coaching")).toBeVisible();
    await expect(page.getByText(/not a forecast or guaranteed earnings/)).toBeVisible();
  });

  test("Launch Planner tracks progress, auto-checks assets and exports a calendar", async ({ page }) => {
    await login(page);
    await openFirstAsset(page, "/launch");
    await expect(page.getByTestId("launch-progress")).toHaveText("0%");
    await page.locator("[data-testid=launch-task] button[role=checkbox]").first().click();
    await expect(page.getByTestId("launch-progress")).not.toHaveText("0%");
    await page.getByRole("tab", { name: "Checklists" }).click();
    await expect(page.getByText("Found in project").first()).toBeVisible();
    const ics = await exportVia(page, "ics");
    expect(ics.text.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });

  test("Product Portfolio lists products and exports CSV", async ({ page }) => {
    await login(page);
    await page.goto("/portfolio");
    await expect(page.getByTestId("portfolio-row")).toHaveCount(1);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("portfolio-csv").click()]);
    expect(dl.suggestedFilename()).toMatch(/portfolio.*\.csv$/);
  });
});
