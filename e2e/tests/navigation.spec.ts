import { expect, test } from "@playwright/test";
import { requireAdminCredentials, signInAsAdmin } from "./utils/auth";

/**
 * This spec exists specifically to catch a stale `/train` href.
 *
 * The tracker moved from aaroncurtisyoga.com/train to its own origin, which
 * meant de-prefixing nine hardcoded navigation targets. Those are string
 * literals, so neither tsc nor eslint can see a missed one — it degrades
 * quietly into a 404 on a subpage, which you find out about mid-workout.
 */
test.describe("navigation", () => {
  test.beforeEach(async ({ page }) => {
    requireAdminCredentials();
    await signInAsAdmin(page);
  });

  test("home renders at the origin root", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByLabel("Trends")).toBeVisible();
  });

  test("home to trends and back, with no /train anywhere", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Trends").click();

    await expect(page).toHaveURL(/\/trends$/);
    expect(page.url()).not.toContain("/train");

    await page.getByLabel("Back to today").click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("no link on the home page points at the old /train prefix", async ({
    page,
  }) => {
    await page.goto("/");
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs.filter((h) => h.startsWith("/train"))).toEqual([]);
  });
});
