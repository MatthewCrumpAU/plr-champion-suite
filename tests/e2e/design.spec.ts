import { test, expect } from "@playwright/test";
import { exportVia, isPdf, isPng, login, openFirstAsset } from "./helpers";

test.describe("Design Studio", () => {
  test("creates a cover from a template, edits it, undoes and exports PNG and PDF", async ({ page }) => {
    await login(page);
    await page.goto("/covers");
    await page.getByTestId("create-asset").click();
    await expect(page.locator("[data-testid=cover-templates] img").first()).toBeVisible({ timeout: 30_000 });
    await page.locator("[data-testid=cover-templates] > button").first().click();
    await expect(page.locator("[data-testid=cover-stage] canvas").first()).toBeVisible({ timeout: 30_000 });
    const layers = page.locator("[data-testid=cover-layers] li");
    const before = await layers.count();
    await page.getByTestId("add-heading").click();
    await expect(layers).toHaveCount(before + 1);
    await page.getByTestId("cover-undo").click();
    await expect(layers).toHaveCount(before);
    const png = await exportVia(page, "png");
    expect(isPng(png.bytes)).toBe(true);
    // 1600×2560 ebook: width/height live in the IHDR chunk.
    expect(png.bytes.readUInt32BE(16)).toBe(1600);
    expect(png.bytes.readUInt32BE(20)).toBe(2560);
    const pdf = await exportVia(page, "pdf");
    expect(isPdf(pdf.bytes)).toBe(true);
  });

  test("renders mockups from the sample cover and exports a real PNG", async ({ page }) => {
    await login(page);
    await openFirstAsset(page, "/mockups");
    await expect(page.getByTestId("mockup-preview")).toBeVisible({ timeout: 30_000 });
    for (const k of ["paperback", "tablet", "bundle"]) {
      await page.getByTestId(`kind-${k}`).click();
      await expect(page.getByTestId("mockup-preview")).toBeVisible();
    }
    const png = await exportVia(page, "png");
    expect(isPng(png.bytes)).toBe(true);
    expect(png.bytes.readUInt32BE(16)).toBe(1600);
    expect(png.bytes.length).toBeGreaterThan(50_000);
  });

  test("creates a brand kit and links it to the project", async ({ page }) => {
    await login(page);
    await page.goto("/brand-kits");
    await page.getByTestId("create-kit").click();
    await page.fill("[data-testid=kit-name]", "E2E Brand");
    await page.getByLabel("Primary hex").fill("#d9480f");
    await page.getByLabel("Primary hex").blur();
    await page.getByRole("button", { name: /Use in active project/ }).click();
    await expect(page.getByRole("button", { name: /Used by active project/ })).toBeVisible();
    await page.waitForTimeout(1200);
    await page.reload();
    await expect(page.getByTestId("kit-name")).toHaveValue("E2E Brand");
    await expect(page.getByLabel("Primary hex")).toHaveValue("#d9480f");
  });
});
