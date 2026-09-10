import { clerk } from "@clerk/testing/playwright";
import { Page, test } from "@playwright/test";

export const adminCredentials = () => ({
  username: process.env.E2E_CLERK_ADMIN_USERNAME,
  password: process.env.E2E_CLERK_ADMIN_PASSWORD,
});

/**
 * Skips the calling test when admin credentials aren't configured.
 *
 * There is no route-mocking fallback here on purpose. proxy.ts gates every
 * route server-side on `sessionClaims.metadata.role`, so a mocked client-side
 * session would be turned away before a page ever rendered: a fallback would
 * only produce tests that pass without exercising anything.
 */
export function requireAdminCredentials() {
  const { username, password } = adminCredentials();
  test.skip(
    !username || !password,
    "Set E2E_CLERK_ADMIN_USERNAME and E2E_CLERK_ADMIN_PASSWORD to run this spec",
  );
}

export async function signInAsAdmin(page: Page): Promise<void> {
  const { username, password } = adminCredentials();
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: username!,
      password: password!,
    },
  });
}

// There is deliberately no ensureSignedOut helper. Playwright gives every test a
// fresh context and the config sets no storageState, so signed-out is already
// the default. clerk.signOut() polls for window.Clerk with no timeout and hangs
// forever on a page that hasn't navigated yet, so a "just to be safe" sign-out
// hook costs the whole test budget and fails the suite it was meant to protect.
