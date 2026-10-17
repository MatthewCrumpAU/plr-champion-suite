import { expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

export const PASSWORD = "e2e-owner-password";
export const fixture = (name: string) => path.join(__dirname, "fixtures", name);

export async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
  // First run seeds the sample project.
  await expect(page.getByText("SAMPLE — Calm Productivity Blueprint").first()).toBeVisible({ timeout: 20_000 });
}

/** Opens the export menu, clicks an option and returns the downloaded file's name, bytes and text. */
export async function exportVia(page: Page, optionId: string, menuTestId = "export-menu") {
  const trigger = page.getByTestId(menuTestId).first();
  const option = page.getByTestId(`export-${optionId}`);
  // Let a previous export finish (the button shows a spinner while busy) and its menu fully close —
  // a closing menu stays in the page briefly while it animates out, and clicks on it do nothing.
  await expect(trigger).not.toHaveAttribute("aria-busy", "true", { timeout: 60_000 });
  await expect(page.locator("[role=menu]")).toHaveCount(0);
  await trigger.click();
  await expect(option).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), option.click()]);
  const p = await dl.path();
  const bytes = readFileSync(p!);
  return { name: dl.suggestedFilename(), bytes, text: bytes.toString("utf8") };
}

/** Opens a dropdown menu once any previous menu has finished closing (closing menus linger briefly while animating). */
export async function openMenu(page: Page, trigger: Locator) {
  await expect(page.locator("[role=menu]")).toHaveCount(0);
  await trigger.click();
  await expect(page.locator("[role=menu]")).toHaveCount(1);
}

export async function confirmDialog(page: Page, typed?: string) {
  const dlg = page.getByRole("alertdialog");
  await expect(dlg).toBeVisible();
  if (typed) await dlg.locator("input").fill(typed);
  await dlg.getByRole("button").last().click();
}

export async function openFirstAsset(page: Page, route: string) {
  await page.goto(route);
  await page.locator("[data-testid=asset-list] button[aria-label^='Open']").first().click();
}

export const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
export const isPdf = (b: Buffer) => b.subarray(0, 5).toString() === "%PDF-";
export const isZip = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b;

/** Waits until the asset editor reports everything saved. */
export async function waitSaved(page: Page) {
  await expect(page.getByTestId("save-status").first()).toHaveAttribute("data-state", "saved", { timeout: 15_000 });
}
