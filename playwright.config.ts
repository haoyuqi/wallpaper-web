import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.results/test-results",
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  globalTimeout: process.env.CI ? 5 * 60 * 1000 : undefined,
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { outputFolder: "./tests/e2e/.results/playwright-report", open: "never" }],
      ]
    : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npx vp preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    // Always build and serve this run: reusing a listener could test a stale bundle.
    reuseExistingServer: false,
    timeout: 60000,
  },
});
