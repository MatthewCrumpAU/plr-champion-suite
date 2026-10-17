import { test, expect } from "@playwright/test";
import { PASSWORD } from "./helpers";

test.describe("private access", () => {
  test("redirects to login and rejects a wrong password", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await page.fill("#password", "not-the-password");
    await page.click("button[type=submit]");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs in, keeps the session and signs out", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#password", PASSWORD);
    await Promise.all([page.waitForURL("/"), page.click("button[type=submit]")]);
    await page.reload();
    await expect(page).toHaveURL("/");
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name.includes("plrc_session"));
    expect(session?.httpOnly).toBe(true);
    await page.goto("/settings#account");
    await page.getByTestId("sign-out").click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });

  test("API rejects unauthenticated and cross-site requests", async ({ request, page }) => {
    const anon = await request.post("/api/ai/generate", { data: { task: "test.ping", input: {} } });
    expect([401, 403]).toContain(anon.status());
    await page.goto("/login");
    await page.fill("#password", PASSWORD);
    await Promise.all([page.waitForURL("/"), page.click("button[type=submit]")]);
    // Same session cookie but no CSRF header → refused.
    const noCsrf = await page.request.post("/api/ai/generate", { data: { task: "test.ping", input: {} } });
    expect(noCsrf.status()).toBe(403);
    const status = await page.request.get("/api/ai/status");
    expect(status.ok()).toBe(true);
    expect((await status.json()).testMode).toBe(true);
  });
});
