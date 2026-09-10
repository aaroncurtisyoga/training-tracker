import { expect, test } from "@playwright/test";
import { requireAdminCredentials, signInAsAdmin } from "./utils/auth";

/**
 * Smoke coverage for the logger. It deliberately does not assert on specific
 * movements or weights: the home page shows whatever the Hyrox plan and the
 * CrossFit WOD feed prescribe for the real current date, so anything harder
 * than "a session opens and its own URL holds" would be date-dependent and
 * flaky by next week.
 */
test.describe("logger", () => {
  test.beforeEach(async ({ page }) => {
    requireAdminCredentials();
    await signInAsAdmin(page);
    await page.goto("/");
  });

  test("opening a logged session lands on its own /log/[id] URL", async ({
    page,
  }) => {
    const sessionLink = page.locator('a[href^="/log/"]').first();
    test.skip(
      (await sessionLink.count()) === 0,
      "No logged sessions on the home page yet",
    );

    await sessionLink.click();
    await expect(page).toHaveURL(/\/log\/[^/]+$/);
    await expect(page.getByLabel("Session date")).toBeVisible();
  });

  test("the back arrow returns to today", async ({ page }) => {
    const sessionLink = page.locator('a[href^="/log/"]').first();
    test.skip(
      (await sessionLink.count()) === 0,
      "No logged sessions on the home page yet",
    );

    await sessionLink.click();
    await page.getByLabel("Back to today").click();
    await expect(page).toHaveURL(/\/$/);
  });
});
