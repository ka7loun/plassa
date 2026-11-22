import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// Locally we drive the installed Microsoft Edge (no browser download); CI installs Chromium.
const channel = process.env.CI ? undefined : "msedge";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "docs/tests/playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "fr-FR",
    timezoneId: "Africa/Tunis",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? `npm run start -- -p ${PORT}` : "npm run dev",
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
