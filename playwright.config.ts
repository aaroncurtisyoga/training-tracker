import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { outputFolder: "./e2e/playwright-report" }]],
  outputDir: "./e2e/test-results",
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Phone-first app, so the mobile viewport is the one that matters. Desktop
  // Chrome is kept because the trends charts only get real width there.
  projects: [
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        // Probe robots.txt, not "/". Playwright only treats 200-403 as ready,
        // and "/" needs Clerk plus the database to render, so a bare checkout
        // times out at startup before a single test runs. robots.txt is static
        // and excluded from the proxy, so it answers 200 regardless.
        url: "http://localhost:3000/robots.txt",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  globalSetup: require.resolve("./e2e/global.setup.ts"),
});
