import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { isZip, login } from "./helpers";

/**
 * Phase 3 — PLRforIM: a separate branded membership that reuses the shared components, keeps its own
 * library and customers, and is ready for bundle buyers through linked accounts (no live sign-in).
 */

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByTestId("member-sidebar")).toBeVisible({ timeout: 60_000 });
}

/** "View as" is stored in the browser database; wait for it before navigating away. */
const previewStored = (page: Page) => expect(page.getByTestId("preview-banner")).toHaveAttribute("data-saved", "true");

const primary = (page: Page) => page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"));

async function createProfile(page: Page, name: string, email: string, setup: () => Promise<void>) {
  await page.getByTestId("new-profile").click();
  await page.locator("#tp-name").fill(name);
  await page.locator("#tp-email").fill(email);
  await setup();
  await page.getByTestId("save-profile").click();
  await expect(page.getByTestId("access-table")).toContainText(email);
}

test.describe("PLRforIM", () => {
  test("has its own branded library, drops and downloads", async ({ page }) => {
    await login(page);
    await open(page, "/m/plrforim");
    await expect(page.getByRole("heading", { name: "Welcome back, Owner" })).toBeVisible();
    await expect(page.getByTestId("member-sidebar")).toContainText("PLRforIM");
    await expect(page.getByTestId("member-sidebar")).toContainText("Monthly IM Drops");
    expect(await primary(page)).toBe("#0f8a7a");
    await expect(page).toHaveTitle(/PLRforIM/);

    await page.getByRole("link", { name: "PLR Product Library" }).click();
    await expect(page.getByTestId("result-count")).toHaveText("11 results");
    // PLR Champion's products are not in this library.
    await page.getByTestId("library-search").fill("budget");
    await expect(page.getByTestId("result-count")).toHaveText("0 results");
    await page.getByTestId("library-search").fill("affiliate");
    await expect(page.getByTestId("result-row").or(page.getByTestId("product-card")).first()).toBeVisible();

    await page.goto("/m/plrforim/library/lead-magnet-mastery");
    await expect(page.getByRole("heading", { level: 1, name: "Lead Magnet Mastery" })).toBeVisible({ timeout: 30_000 });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-all").click()]);
    const zip = await JSZip.loadAsync(readFileSync((await dl.path())!));
    const licence = await zip.file("lead-magnet-mastery/LICENCE-SUMMARY.txt")!.async("string");
    expect(licence).toContain("Supplied by PLRforIM");
    const docx = await zip.file("lead-magnet-mastery/lead-magnet-mastery.docx")!.async("nodebuffer");
    expect(isZip(docx)).toBe(true);

    await page.goto("/m/plrforim/drops");
    await expect(page.getByTestId("drop-card").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("drop-card").filter({ hasText: "Traffic Without Ads" })).toContainText("3 products");
  });

  test("the brand switcher moves between brands and keeps the section", async ({ page }) => {
    await login(page);
    await open(page, "/m/plrforim/library");
    await page.getByTestId("brand-switcher").click();
    await page.getByTestId("switch-plr-champion").click();
    await expect(page).toHaveURL(/\/m\/plr-champion\/library$/);
    await expect(page.getByTestId("result-count")).toHaveText("12 results", { timeout: 60_000 });
    expect(await primary(page)).toBe("#5b4df5");
    await page.goto("/m/plr-champion/admin/products");
    await expect(page.getByTestId("admin-products")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("brand-switcher").click();
    await page.getByTestId("switch-plrforim").click();
    await expect(page).toHaveURL(/\/m\/plrforim\/admin\/products$/);
    await expect(page.getByTestId("admin-products")).toContainText("Lead Magnet Mastery", { timeout: 60_000 });
    await expect(page.getByTestId("admin-products")).not.toContainText("Budget Reset");
  });

  test("test profiles: separate customers per brand, bundles and linked accounts", async ({ page }) => {
    await login(page);
    await open(page, "/m/plrforim/admin/access");
    await expect(page.getByTestId("access-table")).toContainText("Owner");

    await createProfile(page, "IM buyer", "im@example.com", async () => {
      await page.getByRole("combobox", { name: "PLRforIM access" }).selectOption("member");
    });
    await createProfile(page, "Bundle buyer", "bundle@example.com", async () => {
      await page.getByRole("checkbox", { name: "PLR Champion + PLRforIM bundle" }).click();
    });
    const imRow = page.getByTestId("access-row").filter({ hasText: "im@example.com" });
    await expect(imRow).toContainText("No access");
    const bundleRow = page.getByTestId("access-row").filter({ hasText: "bundle@example.com" });
    await expect(bundleRow.getByText("via Bundle")).toHaveCount(2);

    // An IM-only buyer can't open PLR Champion.
    await page.getByTestId("view-as-im@example.com").click();
    await expect(page.getByTestId("preview-banner")).toContainText("IM buyer");
    await previewStored(page);
    await page.goto("/m/plr-champion");
    await expect(page.getByTestId("no-brand-access")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("link", { name: "Open PLRforIM" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back, Owner" })).toBeVisible({ timeout: 30_000 });
    await page.goto("/m/plrforim/library");
    // Members don't see the draft or next month's scheduled product.
    await expect(page.getByTestId("result-count")).toHaveText("9 results", { timeout: 30_000 });
    await page.goto("/m/plrforim/library/short-form-video-traffic");
    await expect(page.getByRole("status").getByText("Premium access required")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("brand-switcher")).toHaveCount(0);

    // Link a PLR Champion account to the same person: access is shared both ways.
    await page.getByRole("button", { name: "Exit preview" }).first().click();
    await expect(page.getByTestId("preview-banner")).toHaveCount(0);
    await expect(page.locator("main#main")).toHaveAttribute("data-preview-saved", "true");
    await page.goto("/m/plrforim/admin/access");
    await createProfile(page, "Champion buyer", "champ@example.com", async () => {
      await page.getByRole("combobox", { name: "PLR Champion access" }).selectOption("premium");
      await page.getByRole("checkbox", { name: "Link to IM buyer" }).click();
    });
    await expect(imRow).toContainText("via Linked account");
    await page.getByTestId("view-as-im@example.com").click();
    await previewStored(page);
    await page.goto("/m/plr-champion/library");
    await expect(page.getByTestId("result-count")).toHaveText("10 results", { timeout: 60_000 });
    await expect(page.getByTestId("no-brand-access")).toHaveCount(0);
    await page.getByTestId("brand-switcher").click();
    await expect(page.getByTestId("switch-plrforim")).toBeVisible();
    await page.keyboard.press("Escape");

    // The bundle buyer gets premium on both brands.
    await page.getByTestId("preview-as").click();
    await page.getByTestId("preview-profile-bundle@example.com").click();
    await expect(page.getByTestId("preview-banner")).toContainText("Bundle buyer");
    await previewStored(page);
    await page.goto("/m/plrforim/library/short-form-video-traffic");
    await expect(page.getByTestId("download-all")).toBeEnabled({ timeout: 30_000 });
    await page.goto("/m/plr-champion/library/confident-public-speaking");
    await expect(page.getByTestId("download-all")).toBeEnabled({ timeout: 30_000 });
  });

  test("a PLRforIM backup can't be restored into PLR Champion", async ({ page }) => {
    await login(page);
    await open(page, "/m/plrforim/admin/data");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("membership-backup").click()]);
    expect(dl.suggestedFilename()).toMatch(/^plrforim-membership-backup-/);
    const bytes = readFileSync((await dl.path())!);
    await open(page, "/m/plr-champion/admin/data");
    await page.locator("[data-testid=membership-restore] input[type=file]").setInputFiles({ name: dl.suggestedFilename(), mimeType: "application/zip", buffer: bytes });
    await expect(page.getByText("That's a plrforim backup")).toBeVisible();
    await expect(page.getByTestId("restore-merge")).toHaveCount(0);
  });
});
