import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { fixture, isZip, login, openMenu } from "./helpers";

/**
 * Phase 4 — PLR Profit Lab: a third branded membership with the 90-Day Profit Path, Monthly Profit
 * Campaign Drops (Campaign Drop Creator + member preview) and PLR Profit Build Days. Everything is
 * stored in the browser; no hosted database, payments or external services.
 */

const BASE = "/m/plr-profit-lab";

async function open(page: Page, path = "") {
  await login(page);
  await page.goto(BASE + path);
  // First visit seeds the Profit Lab samples (campaign files are generated in the browser).
  await expect(page.getByTestId("member-sidebar")).toBeVisible({ timeout: 90_000 });
}

async function download(page: Page, click: () => Promise<unknown>) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), click()]);
  const bytes = readFileSync((await dl.path())!);
  return { name: dl.suggestedFilename(), bytes, text: bytes.toString("utf8") };
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const primary = (page: Page) => page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"));

/** Answers the five Profit Path questions: starts today, works every day, lead-magnet funnel, two launches. */
async function buildPlan(page: Page, hours = "6") {
  await expect(page.getByTestId("setup-step")).toHaveText("Experience", { timeout: 30_000 });
  await page.getByTestId("exp-new").click();
  await page.getByTestId("setup-next").click();
  await expect(page.getByTestId("setup-step")).toHaveText("Working hours");
  await page.locator("#pp-hours").fill(hours);
  await page.getByTestId("workday-6").click();
  await page.getByTestId("workday-0").click();
  await page.locator("#pp-start").fill(today());
  await page.getByTestId("setup-next").click();
  await page.locator("#pp-niche").fill("Busy parents");
  await page.locator("#pp-idea").fill("Calm Family Mornings");
  await page.getByTestId("setup-next").click();
  await page.getByTestId("model-lead-magnet-funnel").click();
  await page.getByTestId("setup-next").click();
  await page.getByTestId("launches-2").click();
  await expect(page.getByTestId("goal-math")).toContainText("sales-page visitors");
  await page.getByTestId("build-plan").click();
  await expect(page.getByTestId("path-stats")).toBeVisible({ timeout: 30_000 });
}

const progressCount = async (page: Page) => Number(((await page.getByTestId("path-progress").textContent()) ?? "").match(/^(\d+)/)?.[1]);

test.describe("PLR Profit Lab", () => {
  test("is its own branded area with Profit Lab navigation, and keeps other brands' areas out", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { name: "Welcome back, Owner" })).toBeVisible();
    await expect(page).toHaveTitle(/PLR Profit Lab/);
    expect(await primary(page)).toBe("#15803d");
    const nav = page.getByTestId("member-sidebar");
    for (const item of ["90-Day Profit Path", "Campaign Drops", "Build Days", "Campaign Drop Creator", "Build Day Planner", "Profit Path profiles"]) await expect(nav).toContainText(item);
    await expect(nav).not.toContainText("PLR Product Library");
    await expect(page.getByTestId("member-search")).toHaveCount(0);
    await expect(page.getByTestId("module-campaign")).toContainText("Campaign Drop");
    await expect(page.getByTestId("module-build-day")).toContainText("days to go");

    // Library areas belong to the other brands, and Profit Lab areas to Profit Lab.
    await page.goto(`${BASE}/library`);
    await expect(page.getByTestId("not-in-membership")).toBeVisible({ timeout: 30_000 });
    await page.goto("/m/plr-champion/profit-path");
    await expect(page.getByTestId("not-in-membership")).toContainText("part of PLR Profit Lab", { timeout: 60_000 });

    // Switching brands from a Profit Lab area lands on the other brand's dashboard.
    await page.goto(`${BASE}/campaigns`);
    await expect(page.getByTestId("campaign-card").first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("brand-switcher").click();
    await page.getByTestId("switch-plr-champion").click();
    await expect(page).toHaveURL(/\/m\/plr-champion$/);

    // The studio links to the new area.
    await page.goto("/");
    await expect(page.getByRole("link", { name: "PLR Profit Lab" }).first()).toBeVisible({ timeout: 30_000 });
  });

  test("90-Day Profit Path: questions, plan, progress, custom and skipped tasks, re-planning and exports", async ({ page }) => {
    await open(page, "/profit-path");
    await buildPlan(page);
    await expect(page.getByRole("heading", { name: "Your 90-day plan" })).toBeVisible();
    await expect(page.getByTestId("path-status")).toHaveText("On track");
    await expect(page.getByTestId("path-progress")).toContainText("0 of");
    const total = Number(((await page.getByTestId("path-progress").textContent()) ?? "").match(/of (\d+)/)?.[1]);
    expect(total).toBeGreaterThan(40);

    // Tick today's first task; it survives a reload.
    const first = page.getByTestId("today-tasks").getByTestId("path-task").first();
    await first.getByRole("checkbox").click();
    await expect(first).toHaveAttribute("data-done", "true");
    await expect(page.getByTestId("path-progress")).toContainText(`1 of ${total}`);
    await page.reload();
    await expect(page.getByTestId("path-progress")).toContainText(`1 of ${total}`, { timeout: 30_000 });

    // Add a task of my own for today.
    await page.getByTestId("add-task").click();
    await page.getByTestId("custom-title").fill("Record a podcast intro");
    await page.getByTestId("save-custom-task").click();
    await expect(page.getByTestId("today-tasks")).toContainText("Record a podcast intro");
    await expect(page.getByTestId("path-progress")).toContainText(`1 of ${total + 1}`);

    // Skip a task that doesn't apply: the week re-plans and it moves to "Skipped".
    await page.getByTestId("tab-week").click();
    await expect(page.getByTestId("week-title")).toContainText("Week 1");
    const second = page.getByTestId("week-tasks").getByTestId("path-task").filter({ hasNot: page.getByText("Record a podcast intro") }).nth(1);
    const skippedTitle = (await second.locator("label").first().textContent())!;
    await second.getByRole("button", { name: /^More for/ }).click();
    await page.getByTestId("skip-task").click();
    await expect(page.getByTestId("skipped-tasks")).toContainText(skippedTitle);

    // Weekly reflection is saved on blur.
    await page.getByTestId("week-reflection").fill("Mornings worked best this week.");
    await page.getByTestId("week-title").click();
    await expect(page.getByText("Reflection saved")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("week-reflection")).toHaveValue("Mornings worked best this week.", { timeout: 30_000 });

    // 13 weeks and two launch checklists.
    await page.getByTestId("tab-weeks").click();
    await expect(page.getByTestId("week-card")).toHaveCount(13);
    await page.getByTestId("tab-launches").click();
    await expect(page.getByTestId("launch-checklist")).toHaveCount(2);
    await page.getByTestId("launch-checklist").first().getByRole("checkbox").first().click();
    await expect(page.getByTestId("launch-checklist").first()).toContainText("1 of");

    // Change an answer: the plan re-builds and ticks are kept.
    await page.getByTestId("tab-answers").click();
    await page.locator("#pp-hours").fill("12");
    await page.getByTestId("save-answers").click();
    await expect(page.getByText("12 h/week").first()).toBeVisible();
    expect(await progressCount(page)).toBe(1);

    // Exports.
    await page.getByTestId("tab-today").click();
    await openMenu(page, page.getByTestId("path-export"));
    const md = await download(page, () => page.getByTestId("export-path-md").click());
    expect(md.name).toBe("my-90-day-profit-path.md");
    expect(md.text).toContain("# 90-Day Profit Path");
    expect(md.text).toContain("- [x]");
    expect(md.text).toContain("Mornings worked best this week.");
    expect(md.text).toContain("Your real numbers will differ.");
    await openMenu(page, page.getByTestId("path-export"));
    const csv = await download(page, () => page.getByTestId("export-path-csv").click());
    expect(csv.text.split(/\r?\n/)[0]).toBe("week,date,task,category,priority,minutes,scheduled,tool,done");
    await openMenu(page, page.getByTestId("path-export"));
    const ics = await download(page, () => page.getByTestId("export-path-ics").click());
    expect(ics.text).toContain("BEGIN:VCALENDAR");
    expect(ics.text).toContain("Launch 1");
  });

  test("the owner sets up and checks a test member's plan with View as", async ({ page }) => {
    await open(page, "/admin/profit-paths");
    const jordan = page.getByTestId("profile-row").filter({ hasText: "jordan@sample.profitlab.test" });
    await expect(jordan).toContainText("Lead magnet + email funnel", { timeout: 30_000 });
    await page.getByTestId("open-path-jordan@sample.profitlab.test").click();
    await expect(page.getByTestId("preview-banner")).toContainText("Jordan");
    await expect(page.getByRole("heading", { name: /Jordan.*90-day plan/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("member-sidebar")).not.toContainText("Campaign Drop Creator");

    // Ticks while previewing are saved for Jordan, not the owner.
    await page.getByTestId("tab-weeks").click();
    await page.getByTestId("week-card").first().click();
    const task = page.getByTestId("week-tasks").getByTestId("path-task").first();
    await task.getByRole("checkbox").click();
    await expect(task).toHaveAttribute("data-done", "true");
    await page.getByRole("button", { name: "Exit preview" }).first().click();
    await expect(page.getByTestId("preview-banner")).toHaveCount(0);
    await expect(page.locator("main#main")).toHaveAttribute("data-preview-saved", "true");
    // The owner has no plan of their own yet.
    await page.goto(`${BASE}/profit-path`);
    await expect(page.getByTestId("setup-step")).toBeVisible({ timeout: 30_000 });
    await page.goto(`${BASE}/admin/profit-paths`);
    await expect(page.getByTestId("profile-row").filter({ hasText: "jordan@sample.profitlab.test" })).toContainText("1/");
  });

  test("Campaign Drop Creator: build from a PLR Editor project, release, and members get everything", async ({ page }) => {
    await open(page, "/admin/campaigns");
    await expect(page.getByTestId("admin-campaigns")).toContainText("The Weekend Side Hustle Launch", { timeout: 30_000 });
    await page.getByTestId("new-campaign-month").fill("2027-01");
    const label = await page.getByTestId("from-project-select").evaluate((s: HTMLSelectElement) => [...s.options].find((o) => o.text.includes("Calm Productivity"))?.text);
    expect(label).toBeTruthy();
    await page.getByTestId("from-project-select").selectOption({ label: label! });
    await page.getByTestId("from-project").click();
    await expect(page.getByTestId("campaign-editor-title")).toBeVisible({ timeout: 60_000 });

    // The project's document is now the featured product file.
    await page.getByTestId("edit-featured").click();
    await expect(page.getByTestId("fp-title")).toHaveValue(/Calm Productivity/);
    await expect(page.getByTestId("campaign-files")).toContainText(".docx");
    await page.getByTestId("edit-details").click();
    await page.getByTestId("cd-theme").fill("The Calm Productivity Launch");
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 15_000 });

    // A manual calendar entry survives rebuilding the calendar.
    await page.getByTestId("edit-calendar").click();
    await page.getByTestId("add-calendar-entry").click();
    await page.getByTestId("calendar-editor").getByRole("textbox", { name: "Entry" }).fill("Podcast interview");
    await page.getByTestId("rebuild-calendar").click();
    await expect(page.getByTestId("calendar-editor").getByRole("textbox", { name: "Entry" })).toHaveValue("Podcast interview");

    // BYLDITY handoffs are prepared but nothing is sent.
    await page.getByTestId("byldity-panel").getByRole("button", { name: "Send to ByldSend" }).click();
    await expect(page.getByText("ByldSend isn't connected yet")).toBeVisible();

    // Release it now.
    await page.locator("#cmp-when").fill("2026-10-01T09:00");
    await page.getByTestId("publish-campaign").click();
    await expect(page.getByText("Released to members")).toBeVisible();

    // Member preview: all ten parts, a checklist, and the whole kit.
    await page.getByTestId("member-preview").click();
    await expect(page.getByTestId("campaign-title")).toHaveText("The Calm Productivity Launch", { timeout: 30_000 });
    await expect(page.getByTestId("included-grid").locator("a")).toHaveCount(10);
    await expect(page.getByTestId("section-emails")).toBeVisible();
    await expect(page.getByTestId("promo-calendar")).toContainText("Podcast interview");
    await page.getByTestId("checklist-prepare").getByRole("checkbox").first().click();
    await expect(page.getByTestId("campaign-progress")).toContainText("1 of");
    const kit = await download(page, () => page.getByTestId("download-kit").click());
    expect(kit.name).toMatch(/campaign-kit\.zip$/);
    const zip = await JSZip.loadAsync(kit.bytes);
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.endsWith("README.md"))).toBe(true);
    expect(names.some((n) => /01-featured-product\/.+\.docx$/.test(n))).toBe(true);
    expect(names.some((n) => n.endsWith("10-promotional-calendar/calendar.ics"))).toBe(true);
    const docx = await zip.file(names.find((n) => /01-featured-product\/.+\.docx$/.test(n))!)!.async("nodebuffer");
    expect(isZip(docx)).toBe(true);

    // Free members see what's included but can't open it.
    await page.getByTestId("preview-as").click();
    await page.getByTestId("preview-free").click();
    await expect(page.getByTestId("preview-banner")).toHaveAttribute("data-saved", "true");
    await expect(page.getByRole("status").getByText("Member access required")).toBeVisible();
    await expect(page.getByTestId("included-grid").locator("a")).toHaveCount(10);
    await expect(page.getByTestId("download-kit")).toBeDisabled();
    await expect(page.getByTestId("section-emails")).toHaveCount(0);
  });

  test("a member starts a campaign in the studio and lands in the PLR Editor", async ({ page }) => {
    await open(page, "/campaigns");
    await page.getByTestId("campaign-card").filter({ hasText: "The Sleep Better Launch" }).click();
    await expect(page.getByTestId("included-grid")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("start-in-studio").click();
    await expect(page.getByText("Project created in your studio")).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/m\/plr-profit-lab\/tools\/editor/);
    await page.goto("/projects");
    await expect(page.getByText("Sleep Better Tonight").first()).toBeVisible({ timeout: 30_000 });
  });

  test("Build Day Planner: plan, announce and run a Build Day; members RSVP and track progress", async ({ page }) => {
    await open(page, "/admin/build-days");
    await page.getByTestId("new-build-day").click();
    await expect(page.getByTestId("build-day-editor-title")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("bd-title").fill("Sales Page Sprint");
    await page.getByTestId("tab-agenda").click();
    const sessions = await page.getByTestId("session-editor").count();
    await page.getByTestId("add-session").click();
    await expect(page.getByTestId("session-editor")).toHaveCount(sessions + 1);
    await page.getByRole("tab", { name: "Materials" }).click();
    await page.locator("[data-testid=materials-upload] input[type=file]").setInputFiles(fixture("focus-freedom.docx"));
    await expect(page.getByText("Added 1 file")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("tab", { name: "Links & community" }).click();
    await page.getByTestId("bd-join").fill("https://meet.example.com/abc");
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 15_000 });
    await page.getByTestId("publish-build-day").click();
    await expect(page.getByText("Announced to members")).toBeVisible();
    const sheet = await download(page, () => page.getByTestId("run-sheet").click());
    expect(sheet.text).toContain("## Agenda");
    expect(sheet.text).toContain("https://meet.example.com/abc");

    await page.getByRole("link", { name: "Member view" }).click();
    await expect(page.getByTestId("build-day-title")).toHaveText("Sales Page Sprint", { timeout: 30_000 });
    await expect(page.getByTestId("countdown")).toBeVisible();
    await expect(page.getByTestId("agenda-session")).toHaveCount(sessions + 1);
    await expect(page.getByTestId("join-link")).toHaveAttribute("href", "https://meet.example.com/abc");
    await page.getByTestId("rsvp-going").click();
    await expect(page.getByTestId("rsvp-going")).toHaveAttribute("aria-pressed", "true");
    await page.getByText("Download the workbook and materials").click();
    await page.getByTestId("own-action-input").fill("Email three past customers");
    await page.getByTestId("own-action-input").press("Enter");
    await expect(page.getByTestId("own-action")).toContainText("Email three past customers");
    await page.getByTestId("journal").fill("Finished the headline and the FAQ.");
    await page.getByTestId("build-day-title").click();
    await expect(page.getByTestId("build-day-progress")).toContainText("1 of");
    await page.reload();
    await expect(page.getByTestId("rsvp-going")).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
    await expect(page.getByTestId("own-action")).toHaveCount(1);
    await expect(page.getByTestId("journal")).toHaveValue("Finished the headline and the FAQ.");
    const pack = await download(page, () => page.getByTestId("build-day-pack").click());
    const zip = await JSZip.loadAsync(pack.bytes);
    expect(Object.keys(zip.files).some((n) => n.endsWith("materials/focus-freedom.docx"))).toBe(true);
    const ics = await download(page, () => page.getByTestId("build-day-ics").click());
    expect(ics.text).toContain("URL:https://meet.example.com/abc");

    // The planner shows the RSVP and plans next month from this one.
    await page.goto(`${BASE}/admin/build-days`);
    const row = page.getByTestId("admin-build-days").locator("> *").filter({ hasText: "Sales Page Sprint" });
    await expect(row).toContainText("1 going", { timeout: 30_000 });
    await row.getByTestId("plan-next-month").click();
    await expect(page.getByTestId("build-day-editor-title")).toHaveText("Sales Page Sprint", { timeout: 30_000 });
    await expect(page.getByText("Planned for")).toBeVisible();
  });

  test("backups carry campaigns, Build Days and plans, and restore after removing samples", async ({ page }) => {
    await open(page, "/admin/data");
    await expect(page.getByText("5 sample campaigns and Build Days")).toBeVisible({ timeout: 30_000 });
    const b = await download(page, () => page.getByTestId("membership-backup").click());
    expect(b.name).toMatch(/^plr-profit-lab-membership-backup-.*\.zip$/);
    const manifest = JSON.parse(await (await JSZip.loadAsync(b.bytes)).file("membership.json")!.async("string"));
    expect(manifest.version).toBe(2);
    expect(manifest.campaigns).toHaveLength(3);
    expect(manifest.buildDays).toHaveLength(2);

    await page.getByTestId("remove-samples").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove samples" }).click();
    await expect(page.getByText("0 sample campaigns and Build Days")).toBeVisible({ timeout: 30_000 });
    await page.goto(`${BASE}/campaigns`);
    await expect(page.getByText("No campaigns yet")).toBeVisible({ timeout: 30_000 });

    await page.goto(`${BASE}/admin/data`);
    await page.locator("[data-testid=membership-restore] input[type=file]").setInputFiles({ name: b.name, mimeType: "application/zip", buffer: b.bytes });
    await page.getByTestId("restore-merge").click();
    await expect(page.getByText("5 sample campaigns and Build Days")).toBeVisible({ timeout: 30_000 });
    await page.goto(`${BASE}/campaigns`);
    await expect(page.getByTestId("campaign-card")).toHaveCount(3, { timeout: 30_000 });
  });

  test("Profit Lab pages fit a phone screen without sideways scrolling", async ({ page }) => {
    await open(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/campaigns`);
    const campaign = await page.getByTestId("campaign-card").first().getAttribute("href", { timeout: 30_000 });
    await page.goto(`${BASE}/build-days`);
    const buildDay = await page.getByTestId("next-build-day").getByRole("link", { name: "Open Build Day" }).getAttribute("href", { timeout: 30_000 });
    const paths = ["", "/profit-path", "/campaigns", campaign!.replace(BASE, ""), "/build-days", buildDay!.replace(BASE, ""), "/admin", "/admin/campaigns", "/admin/build-days", "/admin/profit-paths", "/admin/data"];
    for (const p of paths) {
      await page.goto(BASE + p);
      await expect(page.locator("main#main")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => {
        const main = document.querySelector("main#main") as HTMLElement;
        return { main: main.scrollWidth - main.clientWidth, doc: document.documentElement.scrollWidth - window.innerWidth };
      });
      expect(overflow, `sideways scroll on ${p || "/"}`).toEqual({ main: 0, doc: 0 });
    }
  });
});
