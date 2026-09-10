import { expect, test } from "@playwright/test";
import { ensureSignedOut } from "./utils/auth";

/**
 * The whole origin is admin-only, so "signed out gets turned away" is the most
 * load-bearing assertion in this suite. It needs no credentials, which means it
 * runs everywhere, including a fresh checkout and CI.
 */
test.describe("signed-out visitors", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSignedOut(page);
  });

  for (const path of ["/", "/trends", "/log/does-not-exist"]) {
    test(`${path} redirects to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in/);
    });
  }

  test("the redirect carries the path back", async ({ page }) => {
    await page.goto("/trends");
    await expect(page).toHaveURL(/redirect_url=.*trends/);
  });
});
