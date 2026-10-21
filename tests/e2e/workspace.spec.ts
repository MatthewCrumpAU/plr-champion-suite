import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { confirmDialog, isZip, login, openMenu } from "./helpers";

test.describe("Workspace", () => {
  test("project lifecycle: create, edit, duplicate, archive, trash and restore", async ({ page }) => {
    await login(page);
    await page.goto("/projects?new=1");
    await page.getByRole("dialog").getByLabel(/name/i).first().fill("E2E Project");
    await page.getByRole("dialog").getByRole("button", { name: /Create/ }).click();
    await page.waitForURL(/projects\/view/);
    await page.fill("#pd-niche", "Testing");
    await page.waitForTimeout(1200);
    await page.reload();
    await expect(page.locator("#pd-niche")).toHaveValue("Testing");

    await page.goto("/projects");
    const card = page.getByTestId("project-card").filter({ hasText: "E2E Project" });
    await openMenu(page, card.getByTestId("project-menu"));
    await page.getByTestId("project-duplicate").click();
    await expect(page.getByTestId("project-card").filter({ hasText: "E2E Project (copy)" })).toHaveCount(1);
    await openMenu(page, page.getByTestId("project-card").filter({ hasText: "(copy)" }).getByTestId("project-menu"));
    await page.getByTestId("project-archive").click();
    await page.getByTestId("tab-archived").click();
    await expect(page.getByTestId("project-card")).toHaveCount(1);
    await page.getByRole("tab", { name: /Active/ }).click();
    await openMenu(page, card.getByTestId("project-menu"));
    await page.getByTestId("project-trash").click();
    await confirmDialog(page);
    await page.getByTestId("tab-trash").click();
    await expect(page.getByTestId("trash-project")).toHaveCount(1);
    await page.getByTestId("restore-project").click();
    await expect(page.getByTestId("trash-project")).toHaveCount(0);
  });

  test("snapshots restore a whole project", async ({ page }) => {
    await login(page);
    await page.goto("/projects");
    await page.getByTestId("project-card").first().locator("button").first().click();
    await page.waitForURL(/projects\/view/);
    await page.fill("[data-testid=snapshot-label]", "Before change");
    await page.getByTestId("snapshot-create").click();
    await expect(page.getByTestId("snapshot-row")).toHaveCount(1);
    await page.fill("#pd-niche", "Changed niche");
    await page.waitForTimeout(1200);
    await page.getByTestId("snapshot-row").filter({ hasText: "Before change" }).getByTestId("snapshot-restore").click();
    await confirmDialog(page);
    await expect(page.getByText("Snapshot restored")).toBeVisible();
    // The open form refreshes straight away, and the restore survives a reload.
    await expect(page.locator("#pd-niche")).toHaveValue("Remote work productivity");
    await expect(page.getByTestId("snapshot-row")).toHaveCount(2);
    await page.reload();
    await expect(page.locator("#pd-niche")).toHaveValue("Remote work productivity");
  });

  test("Export Centre builds a ZIP package and a backup that restores", async ({ page }) => {
    await login(page);
    await page.goto("/export");
    await expect(page.getByTestId("package-item").first()).toBeVisible();
    const [zip] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), page.getByTestId("export-zip").click()]);
    const zipBytes = readFileSync((await zip.path())!);
    expect(isZip(zipBytes)).toBe(true);
    expect(zipBytes.toString("latin1")).toContain("README.txt");
    expect(zipBytes.toString("latin1")).toContain("03-design/");

    const [bk] = await Promise.all([page.waitForEvent("download"), page.getByTestId("workspace-backup").click()]);
    const backupPath = (await bk.path())!;
    const json = JSON.parse(readFileSync(backupPath, "utf8"));
    expect(json.format).toBe("plr-champion-backup");
    await expect(page.locator("[data-testid=export-history] tbody tr")).toHaveCount(2);

    await page.setInputFiles("[data-testid=restore-input]", backupPath);
    await page.getByText("Import as copies").click();
    await page.getByTestId("restore-confirm").click();
    await expect(page.getByText(/Restored 1 project/)).toBeVisible();
    await page.goto("/projects");
    await expect(page.getByTestId("project-card")).toHaveCount(2);
  });

  test("Settings: AI connection test, preferences persist, storage report", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.getByTestId("ai-test").click();
    await expect(page.getByTestId("ai-test-result")).toContainText("Replied");
    await page.getByTestId("autosave-delay").selectOption("1500");
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByTestId("autosave-delay")).toHaveValue("1500");
    await expect(page.getByTestId("storage-counts")).toContainText("projects");

    // Password change helper builds a real PBKDF2 hash in the browser.
    await page.fill("#new-owner-pw", "a-brand-new-password");
    await page.fill("#new-owner-pw2", "a-brand-new-password");
    await page.getByTestId("generate-hash").click();
    await expect(page.getByTestId("generated-hash")).toContainText(/^pbkdf2\$sha256\$310000\$/, { timeout: 30_000 });
  });

  test("Start clean: one click removes every sample and they don't come back", async ({ page }) => {
    await login(page);
    // A project of your own, plus the membership sample library.
    await page.goto("/m/plr-champion/library");
    await expect(page.getByTestId("result-count")).toHaveText("12 results", { timeout: 90_000 });
    await page.goto("/settings");
    await page.getByTestId("remove-all-samples").click();
    await confirmDialog(page);
    await expect(page.getByText("Sample content removed")).toBeVisible({ timeout: 30_000 });

    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Projects" }).first()).toBeVisible();
    await expect(page.getByText("SAMPLE — Calm Productivity Blueprint")).toHaveCount(0);
    await page.goto("/m/plr-champion/library");
    await expect(page.getByTestId("result-count")).toHaveText("0 results", { timeout: 60_000 });
    await page.goto("/m/plrforim/library");
    await expect(page.getByTestId("result-count")).toHaveText("0 results", { timeout: 60_000 });
    // Reloading doesn't bring them back.
    await page.reload();
    await expect(page.getByTestId("result-count")).toHaveText("0 results", { timeout: 60_000 });
    await page.goto("/projects");
    await expect(page.getByText("SAMPLE — Calm Productivity Blueprint")).toHaveCount(0);
  });

  test("dashboard shows the real workflow for the active project", async ({ page }) => {
    await login(page);
    await page.goto("/");
    await expect(page.getByTestId("dashboard-project")).toContainText("SAMPLE — Calm Productivity Blueprint");
    await expect(page.locator("[data-testid=workflow-steps] li")).toHaveCount(12);
    await expect(page.getByTestId("dashboard-next")).toContainText("Review licence");
  });
});
