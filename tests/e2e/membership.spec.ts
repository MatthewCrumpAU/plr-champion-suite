import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { fixture, isZip, login, waitSaved } from "./helpers";

/**
 * Phase 2 — PLR Champion membership: member journeys (library, search, product pages, downloads,
 * the PLR Editor bridge, training, preview-as access rules) and admin workflows (categories,
 * products, releases, backup and restore).
 */

const BASE = "/m/plr-champion";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function openMembership(page: Page, path = "") {
  await login(page);
  await page.goto(BASE + path);
  // First visit seeds the sample library (real DOCX/PDF files are generated in the browser).
  await expect(page.getByTestId("member-sidebar")).toBeVisible({ timeout: 60_000 });
}

async function download(page: Page, click: () => Promise<unknown>) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), click()]);
  const bytes = readFileSync((await dl.path())!);
  return { name: dl.suggestedFilename(), bytes };
}

test.describe("PLR Champion membership", () => {
  test("dashboard, library search, product page download and My Downloads", async ({ page }) => {
    await openMembership(page);
    await expect(page.getByRole("heading", { name: "Welcome back, Owner" })).toBeVisible();
    await expect(page.getByTestId("admin-snapshot")).toContainText("12 products");
    await expect(page.getByText("This month's drop")).toBeVisible();

    await page.getByRole("link", { name: "PLR Product Library" }).click();
    await expect(page.getByTestId("result-count")).toHaveText("12 results");
    await page.getByTestId("library-search").fill("declutter");
    await expect(page.getByTestId("result-count")).toHaveText("1 result");
    await expect(page).toHaveURL(/q=declutter/);
    await page.getByTestId("product-card").getByRole("link", { name: /Declutter Your Home/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Declutter Your Home Room by Room" })).toBeVisible();
    await expect(page.getByTestId("licence-rights")).toContainText("Edit and rebrand the content");

    const file = await download(page, () => page.getByTestId("download-declutter-your-home-room-by-room.docx").click());
    expect(file.name).toBe("declutter-your-home-room-by-room.docx");
    expect(isZip(file.bytes)).toBe(true);

    const all = await download(page, () => page.getByTestId("download-all").click());
    expect(all.name).toBe("declutter-your-home-room-by-room.zip");
    const zip = await JSZip.loadAsync(all.bytes);
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(["declutter-your-home-room-by-room/LICENCE-SUMMARY.txt", "declutter-your-home-room-by-room/declutter-your-home-room-by-room-checklist.pdf"]));

    await page.getByRole("link", { name: "My Downloads" }).click();
    const history = page.getByTestId("download-history");
    await expect(history).toContainText("declutter-your-home-room-by-room.docx");
    await expect(history).toContainText("declutter-your-home-room-by-room.zip");
    // Download again from history.
    const again = await download(page, () => history.getByRole("button", { name: "Again" }).last().click());
    expect(again.name).toBe("declutter-your-home-room-by-room.docx");
  });

  test("advanced search filters by licence rights and category and survives a reload", async ({ page }) => {
    await openMembership(page, "/search");
    await expect(page.getByTestId("result-count")).toHaveText("12 results");
    await page.getByTestId("filter-panel").getByRole("checkbox", { name: "Can edit & rebrand" }).click();
    // The MRR product doesn't allow editing.
    await expect(page.getByTestId("result-count")).toHaveText("11 results");
    await page.getByTestId("filter-panel").getByRole("checkbox", { name: "Relationships & Family" }).click();
    await expect(page.getByTestId("result-count")).toHaveText("1 result");
    await expect(page.getByTestId("result-row")).toContainText("Simple Meal Prep for Busy Families");
    await expect(page).toHaveURL(/rights=edit/);
    await page.reload();
    await expect(page.getByTestId("result-count")).toHaveText("1 result", { timeout: 30_000 });
    await page.getByTestId("library-search").fill('"room by room"');
    await expect(page.getByTestId("result-count")).toHaveText("0 results");
  });

  test("Download Manager bundles selected products into one ZIP with licence summaries", async ({ page }) => {
    await openMembership(page, "/downloads");
    await page.getByRole("checkbox", { name: "Select Sleep Better Tonight" }).click();
    await page.getByRole("checkbox", { name: "Select Budget Reset in 30 Days" }).click();
    await expect(page.getByTestId("download-bar")).toContainText("2 products selected");
    const z = await download(page, () => page.getByTestId("download-selected").click());
    expect(z.name).toMatch(/^plr-champion-bundle-\d{4}-\d{2}-\d{2}\.zip$/);
    const zip = await JSZip.loadAsync(z.bytes);
    const names = Object.keys(zip.files);
    expect(names).toEqual(expect.arrayContaining(["sleep-better-tonight/LICENCE-SUMMARY.txt", "sleep-better-tonight/sleep-better-tonight.pdf", "budget-reset-in-30-days/budget-reset-in-30-days-workbook.docx"]));
    const pdf = await zip.file("sleep-better-tonight/sleep-better-tonight.pdf")!.async("nodebuffer");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const licence = await zip.file("budget-reset-in-30-days/LICENCE-SUMMARY.txt")!.async("string");
    expect(licence).toContain("Private Label Rights");
    await page.getByRole("link", { name: "My Downloads" }).click();
    await expect(page.getByTestId("download-history")).toContainText("2 products");
  });

  test("Edit in PLR Editor opens a library product as a new editor project inside the member area", async ({ page }) => {
    await openMembership(page, "/library/budget-reset-in-30-days");
    await page.getByTestId("edit-budget-reset-in-30-days.docx").click();
    await expect(page).toHaveURL(/\/m\/plr-champion\/tools\/editor\?id=/, { timeout: 30_000 });
    await expect(page.getByText("Week 1: See Where Your Money Goes").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("member-sidebar")).toBeVisible();
    await expect(page.getByTestId("project-switcher")).toContainText("Budget Reset in 30 Days");
    // The MRR product can't be edited.
    await page.goto(`${BASE}/library/mindful-parenting-basics`);
    await expect(page.getByTestId("licence-rights")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("edit-mindful-parenting-basics.pdf")).toBeDisabled();
  });

  test("previewing as a free member hides drafts, locks member content and hides admin", async ({ page }) => {
    await openMembership(page, "/library");
    await page.getByTestId("preview-as").click();
    await page.getByTestId("preview-free").click();
    await expect(page.getByTestId("preview-banner")).toContainText("Free member");
    await expect(page.getByTestId("preview-banner")).toHaveAttribute("data-saved", "true");
    // Draft and scheduled products are hidden from members.
    await expect(page.getByTestId("result-count")).toHaveText("10 results");
    await expect(page.getByRole("link", { name: "Admin overview" })).toHaveCount(0);

    await page.goto(`${BASE}/library/budget-reset-in-30-days`);
    await expect(page.getByRole("status").getByText("Member access required")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("download-all")).toBeDisabled();

    await page.goto(`${BASE}/library/declutter-your-home-room-by-room`);
    await expect(page.getByTestId("download-all")).toBeEnabled({ timeout: 30_000 });

    await page.goto(`${BASE}/admin/products`);
    await expect(page.getByText("Admin is hidden while you preview")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Exit preview" }).first().click();
    await expect(page.getByTestId("admin-products")).toBeVisible();
    await expect(page.getByTestId("preview-banner")).toHaveCount(0);
  });

  test("admin creates a category and a product with cover, file and licence, then publishes it", async ({ page }) => {
    await openMembership(page, "/admin/categories");
    await page.getByTestId("new-category").click();
    await page.locator("#cat-name").fill("Gardening");
    await page.getByTestId("save-category").click();
    await expect(page.getByTestId("admin-categories")).toContainText("Gardening");

    await page.getByRole("link", { name: "Products", exact: true }).click();
    await page.getByTestId("new-product").click();
    await expect(page).toHaveURL(/\/admin\/products\/prod_/);
    await page.getByTestId("pe-title").fill("Container Gardening Basics");
    await page.getByTestId("pe-description").fill("Grow vegetables on a **balcony** or patio.");
    await page.getByRole("checkbox", { name: "Gardening" }).click();
    await page.getByTestId("pe-access").selectOption("free");
    await waitSaved(page);

    await page.locator("[data-testid=pe-cover] input[type=file]").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG });
    await page.locator("[data-testid=pe-files] input[type=file]").setInputFiles(fixture("focus-freedom.docx"));
    await expect(page.getByTestId("pe-file-list")).toContainText("focus-freedom.docx");
    await expect(page.getByText(/words · about/)).toBeVisible({ timeout: 30_000 });
    await page.locator("input[aria-label='Upload licence document']").setInputFiles(fixture("licence.txt"));
    await expect(page.getByText("Licence document attached")).toBeVisible();

    await page.getByTestId("publish-now").click();
    await waitSaved(page);
    await expect(page.getByTestId("pe-status")).toHaveValue("published");

    await page.goto(`${BASE}/library?q=container`);
    await expect(page.getByTestId("result-count")).toHaveText("1 result", { timeout: 30_000 });
    await page.getByTestId("product-card").getByRole("link").first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Container Gardening Basics" })).toBeVisible();
    await expect(page.getByTestId("product-files")).toContainText("focus-freedom.docx");
    await expect(page.getByTestId("product-files")).toContainText("licence.txt");
    await expect(page.locator("strong", { hasText: "balcony" })).toBeVisible();

    // Free product: visible and usable when previewing as a free member.
    await page.getByTestId("preview-as").click();
    await page.getByTestId("preview-free").click();
    await expect(page.getByTestId("download-all")).toBeEnabled();
  });

  test("admin creates and schedules a monthly release", async ({ page }) => {
    await openMembership(page, "/admin/releases");
    await page.locator("#rel-month").fill("2031-03");
    await page.getByTestId("new-release").click();
    await expect(page).toHaveURL(/\/admin\/releases\/rel_/);
    await page.getByTestId("re-theme").fill("Spring Growth");
    await page.getByTestId("release-products").getByRole("checkbox", { name: "Sleep Better Tonight" }).click();
    await waitSaved(page);
    await page.getByTestId("publish-release").click();
    await expect(page.getByText(/Scheduled for/).first()).toBeVisible();

    await page.goto(`${BASE}/drops`);
    const card = page.getByTestId("drop-card").filter({ hasText: "Spring Growth" });
    await expect(card).toContainText("Scheduled");
    await expect(card).toContainText("1 product");
    // The product moved out of its previous drop.
    await expect(page.getByTestId("drop-card").filter({ hasText: "Healthy Home" })).toContainText("2 products");
  });

  test("training progress and checklist ticks are saved", async ({ page }) => {
    await openMembership(page, "/courses");
    await page.getByTestId("course-card").filter({ hasText: "PLR Profit Fundamentals" }).click();
    await expect(page.getByTestId("lesson-title")).toHaveText("What PLR is (and isn't)");
    await page.getByTestId("lesson-complete").click();
    await expect(page.getByTestId("lesson-title")).toHaveText("Reading a PLR licence");
    await page.getByRole("button", { name: /Licence check — practice/ }).click();
    await page.getByTestId("lesson-checklist").getByRole("checkbox").first().click();
    // The tick shows once it's stored (the list re-renders from the database).
    await expect(page.getByTestId("lesson-checklist").getByRole("checkbox").first()).toBeChecked();
    await page.reload();
    await expect(page.getByTestId("lesson-checklist").getByRole("checkbox").first()).toBeChecked({ timeout: 30_000 });
    await page.goto(`${BASE}/training`);
    await expect(page.getByText("Lessons completed").locator("..")).toContainText("1");
    await expect(page.getByText("Continue where you left off")).toBeVisible();
  });

  test("membership backup can be downloaded and restored", async ({ page }) => {
    await openMembership(page, "/admin/data");
    const b = await download(page, () => page.getByTestId("membership-backup").click());
    expect(b.name).toMatch(/^plr-champion-membership-backup-.*\.zip$/);
    const zip = await JSZip.loadAsync(b.bytes);
    expect(zip.file("membership.json")).toBeTruthy();

    await page.getByTestId("remove-samples").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove samples" }).click();
    await expect(page.getByText("0 sample products in the library")).toBeVisible({ timeout: 30_000 });

    await page.locator("[data-testid=membership-restore] input[type=file]").setInputFiles({ name: b.name, mimeType: "application/zip", buffer: b.bytes });
    await page.getByTestId("restore-merge").click();
    await expect(page.getByText("12 sample products in the library")).toBeVisible({ timeout: 30_000 });
    await page.goto(`${BASE}/library`);
    await expect(page.getByTestId("result-count")).toHaveText("12 results", { timeout: 30_000 });
  });

  test("member pages fit a phone screen without sideways scrolling", async ({ page }) => {
    await openMembership(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const paths = ["", "/library", "/search", "/categories", "/library/the-calm-morning-method", "/drops", "/downloads", "/my-downloads", "/training", "/courses", "/resources", "/admin", "/admin/products", "/admin/releases", "/admin/data"];
    for (const p of paths) {
      await page.goto(BASE + p);
      await expect(page.locator("main#main")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => {
        const main = document.querySelector("main#main") as HTMLElement;
        return { main: main.scrollWidth - main.clientWidth, doc: document.documentElement.scrollWidth - window.innerWidth };
      });
      expect(overflow, `sideways scroll on ${p || "/"}`).toEqual({ main: 0, doc: 0 });
    }
  });

  test("studio links to the membership area", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "PLR Champion Members" }).first().click();
    await expect(page.getByTestId("member-sidebar")).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/m\/plr-champion$/);
    // Unknown brands don't exist.
    const res = await page.goto("/m/not-a-brand");
    expect(res?.status()).toBe(404);
  });
});
