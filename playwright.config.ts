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
        url: "http://localhost:3000",
        reuseExistingServer: true,
      },
  globalSetup: require.resolve("./e2e/global.setup.ts"),
});
