import { expect, test } from "@playwright/test";

/**
 * The whole origin is admin-only, so "signed out gets turned away" is the most
 * load-bearing assertion in this suite. It needs no credentials, which means it
 * runs everywhere, including a fresh checkout and CI.
 */
test.describe("signed-out visitors", () => {
  // No sign-out hook. Playwright gives every test a fresh context and the config
  // sets no storageState, so signed-out is already the default. Calling
  // clerk.signOut() here would hang: it polls for window.Clerk with no timeout,
  // and on a page that hasn't navigated yet that global never appears.

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
