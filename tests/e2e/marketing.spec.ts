import { test, expect } from "@playwright/test";
import { exportVia, isZip, login } from "./helpers";

test.describe("Marketing Studio", () => {
  test("Sales Page Builder: templates, disable/enable, live preview, approval for AI and HTML export", async ({ page }) => {
    await login(page);
    await page.goto("/sales-pages");
    await page.getByTestId("create-asset").click();
    await expect(page.getByTestId("sales-preview")).toBeVisible();
    await page.getByTestId("sales-fill-empty").click();
    const faq = page.locator("[data-testid=sales-section-row]").filter({ hasText: "FAQ" });
    await faq.getByTestId("sales-section-toggle").click();
    await page.getByTestId("sales-settings").click();
    await page.fill("#sp-price", "27");
    await page.fill("#sp-url", "https://pay.example.com/calm");
    await page.keyboard.press("Escape");
    const frame = page.frameLocator("[data-testid=sales-preview]");
    await expect(frame.locator(".price")).toContainText("27");
    await expect(frame.getByText("Frequently asked questions")).toHaveCount(0);

    // AI output is a proposal until approved.
    await page.locator("[data-testid=sales-section-row]").filter({ hasText: "Benefits" }).locator("button").nth(1).click();
    const heading = await page.getByTestId("sales-heading").inputValue();
    await page.getByTestId("sales-ai").click();
    await expect(page.getByTestId("sales-proposal")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("sales-heading")).toHaveValue(heading);
    await page.getByTestId("sales-proposal-apply").click();
    await expect(page.getByTestId("sales-heading")).toHaveValue(/\[TEST OUTPUT\]/);

    const html = await exportVia(page, "html");
    expect(html.text).toContain("<!doctype html>");
    expect(html.text).toContain("https://pay.example.com/calm");
    expect(html.text.toLowerCase()).not.toContain("testimonial");
    const docx = await exportVia(page, "docx");
    expect(isZip(docx.bytes)).toBe(true);
  });

  test("Email Swipe Builder: template sequence in order and CSV export", async ({ page }) => {
    await login(page);
    await page.goto("/emails");
    await page.getByTestId("create-asset").click();
    await page.getByTestId("email-create").click();
    await page.getByTestId("email-template").click();
    await expect(page.locator("[data-testid=email-list] li")).toHaveCount(6);
    await expect(page.getByTestId("email-subject")).not.toHaveValue("");
    const csv = await exportVia(page, "csv");
    expect(csv.text.split("\n")[0]).toContain("subject");
    expect(csv.text).toMatch(/\n1,-3,/);
  });

  test("Social Content Creator: template posts and calendar scheduling", async ({ page }) => {
    await login(page);
    await page.goto("/social");
    await page.getByTestId("create-asset").click();
    await page.getByTestId("social-template").click();
    await expect(page.getByTestId("social-post")).toHaveCount(6);
    await page.getByTestId("tab-calendar").click();
    await page.getByTestId("auto-schedule").click();
    await expect(page.locator("[data-testid=social-calendar] [data-testid=calendar-chip]")).toHaveCount(6);
    const csv = await exportVia(page, "csv");
    expect(csv.text.split("\n").length).toBeGreaterThan(6);
  });

  test("Product Name Generator: favourites and one-click apply with confirmation", async ({ page }) => {
    await login(page);
    await page.goto("/names");
    await page.getByTestId("create-asset").click();
    await page.fill("[data-testid=name-topic]", "Calm productivity");
    await page.getByTestId("name-template").click();
    const first = page.getByTestId("name-idea").first();
    const name = await first.locator("input").inputValue();
    await first.getByTestId("name-favourite").click();
    await first.getByTestId("name-apply").click();
    await page.getByRole("menuitem", { name: /Project name/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(`Applied to Project name`).first()).toBeVisible();
    await page.goto("/projects");
    await expect(page.getByTestId("project-card").filter({ hasText: name })).toHaveCount(1);
  });
});
