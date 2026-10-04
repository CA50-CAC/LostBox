/**
 * End-to-end tests (`pnpm test:e2e`): a real browser against a production
 * build, with a fresh demo database in .data-e2e/ (your .data/ is untouched).
 *
 * Browsers: CI installs Chromium with `playwright install`. Locally you can
 * point at an existing Chromium with PLAYWRIGHT_CHROMIUM_PATH.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } }],
  webServer: {
    command: `rm -rf ../../.data-e2e && pnpm seed:demo && pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      LOSTBOX_DATA_DIR: ".data-e2e",
      DATA_ADAPTER: "pglite",
      DEMO_MODE: "true",
      SESSION_SECRET: "e2e-only-session-secret-0123456789abcdef",
      APP_URL: `http://localhost:${PORT}`,
      PLATFORM_ADMIN_EMAILS: "platform@lostbox.test",
      CRON_SECRET: "e2e-only-cron-secret-0123456789",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
