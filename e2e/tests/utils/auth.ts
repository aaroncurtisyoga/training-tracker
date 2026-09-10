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
 * session would be turned away before a page ever rendered — a fallback would
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

export async function ensureSignedOut(page: Page): Promise<void> {
  try {
    await clerk.signOut({ page });
  } catch {
    // Already signed out, which is the state we wanted.
  }
}
