import { test, expect, type Page } from "@playwright/test";
import { dismissToasts, fixture, login, waitSaved } from "./helpers";

/** Imports the three-chapter test PDF and opens it in the editor. */
async function importPdf(page: Page) {
  await login(page);
  await page.goto("/editor");
  await page.getByTestId("open-import").click();
  await page.setInputFiles("[data-testid=import-drop] input[type=file]", fixture("focus-freedom.pdf"));
  await expect(page.locator("[data-testid=import-chapters] li")).toHaveCount(3, { timeout: 30_000 });
  await page.getByTestId("confirm-import").click();
  await expect(page.getByTestId("doc-editor")).toBeVisible({ timeout: 20_000 });
  await dismissToasts(page);
}

const chapters = (page: Page) => page.getByTestId("doc-chapter");
const position = (page: Page) => page.getByTestId("chapter-position");

/** True when the element's top edge is inside the document's scroll area. */
async function inView(page: Page, i: number) {
  return chapters(page)
    .nth(i)
    .evaluate((el) => {
      const root = el.closest("[data-testid=doc-scroll]")!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return r.top >= root.top - 2 && r.top < root.bottom - 40;
    });
}

test.describe("Editor: whole document and chapter navigation on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("after a PDF splits into chapters, every chapter can be read, reached and edited", async ({ page }) => {
    await importPdf(page);

    // The whole document is shown: all three chapters, one after another.
    await expect(chapters(page)).toHaveCount(3);
    await expect(position(page)).toHaveText("1 of 3");
    await expect(page.getByTestId("chapter-current")).toHaveText("Why Focus Matters");
    await expect(chapters(page).nth(2)).toContainText("Finish Strong");
    await expect(chapters(page).nth(2)).toContainText("End the day on purpose");

    // Next / previous jump between chapters, and the navigator follows.
    await page.getByTestId("chapter-next").click();
    await expect(position(page)).toHaveText("2 of 3");
    await expect.poll(() => inView(page, 1)).toBe(true);
    await page.getByTestId("chapter-prev").click();
    await expect(position(page)).toHaveText("1 of 3");

    // Jump straight to the last chapter from the list.
    await page.getByTestId("chapter-picker").click();
    await expect(page.getByTestId("chapter-picker-item")).toHaveCount(3);
    await page.getByTestId("chapter-picker-item").nth(2).click();
    await expect(position(page)).toHaveText("3 of 3");
    await expect.poll(() => inView(page, 2)).toBe(true);
    await expect(page.getByTestId("chapter-next")).toBeDisabled();

    // Scrolling back up updates the navigator too.
    await page.getByTestId("doc-scroll").evaluate((el) => el.scrollTo({ top: 0 }));
    await expect(position(page)).toHaveText("1 of 3");

    // Type straight into chapter 3; it becomes the active chapter and is saved.
    const third = chapters(page).nth(2).locator(".ProseMirror");
    await third.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Kestrel finish.");
    await expect(third).toHaveAttribute("data-testid", "doc-editor");
    await waitSaved(page);
    await expect(page.getByTestId("status-bar")).toContainText("Total: 59 words");

    await page.reload();
    await expect(chapters(page)).toHaveCount(3, { timeout: 20_000 });
    await expect(chapters(page).nth(2)).toContainText("Kestrel finish.");
    await expect(chapters(page).nth(0)).toContainText("protect two hours each morning");
  });

  test("one chapter at a time: previous / next at the end of a chapter, and the choice is remembered", async ({ page }) => {
    await importPdf(page);
    await page.getByTestId("view-one").click();
    await expect(chapters(page)).toHaveCount(0);
    await expect(page.getByTestId("doc-editor")).toContainText("protect two hours each morning");
    await expect(page.getByTestId("pager-prev")).toHaveCount(0);

    await page.getByTestId("pager-next").click();
    await expect(position(page)).toHaveText("2 of 3");
    await expect(page.getByTestId("chapter-title")).toHaveValue(/Plan Your Day/);
    await page.getByTestId("chapter-next").click();
    await expect(page.getByTestId("chapter-title")).toHaveValue(/Finish Strong/);
    await expect(page.getByTestId("pager-all")).toBeVisible();
    await page.getByTestId("pager-prev").click();
    await expect(page.getByTestId("chapter-title")).toHaveValue(/Plan Your Day/);

    // The view is remembered after a reload.
    await page.reload();
    await expect(page.getByTestId("doc-editor")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("view-one")).toHaveAttribute("aria-pressed", "true");
    await expect(chapters(page)).toHaveCount(0);

    // "Whole document" at the end of the last chapter switches back and keeps your place.
    await page.getByTestId("chapter-picker").click();
    await page.getByTestId("chapter-picker-item").nth(2).click();
    await page.getByTestId("pager-all").click();
    await expect(chapters(page)).toHaveCount(3);
    await expect.poll(() => inView(page, 2)).toBe(true);
  });
});

test.describe("Editor: whole document on a computer", () => {
  test("the toolbar works on the chapter you're editing, and chapter tools still work", async ({ page }) => {
    await importPdf(page);
    // Bold a word in chapter 2.
    const second = chapters(page).nth(1).locator(".ProseMirror");
    await second.getByText("Write your top three tasks").dblclick({ position: { x: 15, y: 12 } });
    await expect(second).toHaveAttribute("data-testid", "doc-editor");
    await page.getByTestId("fmt-bold").click();
    await expect(second.locator("strong")).toHaveCount(1);
    await expect(chapters(page).nth(0).locator("strong")).toHaveCount(0);
    await waitSaved(page);

    // Clicking a chapter in the side list brings it into view and makes it the active one.
    await page.getByTestId("chapter-row").nth(2).click();
    await expect.poll(() => inView(page, 2)).toBe(true);
    await expect(chapters(page).nth(2).locator(".ProseMirror")).toHaveAttribute("data-testid", "doc-editor");

    // Adding a chapter shows it, ready to name.
    await page.getByTestId("add-chapter-end").click();
    await expect(chapters(page)).toHaveCount(4);
    await page.getByTestId("chapter-title").fill("Bonus: Weekly Review");
    await expect.poll(() => inView(page, 3)).toBe(true);
    await waitSaved(page);
    await page.reload();
    await expect(chapters(page)).toHaveCount(4, { timeout: 20_000 });
    await expect(page.getByTestId("chapter-row").filter({ hasText: "Bonus: Weekly Review" })).toHaveCount(1);
    await expect(chapters(page).nth(1).locator("strong")).toHaveCount(1);
  });
});
