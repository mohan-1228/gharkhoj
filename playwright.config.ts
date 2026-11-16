import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a real Next.js server with the docker-compose stack and
 * seeded demo data (AUTH_MODE=dev). Critical paths from CLAUDE.md §9:
 *  - visitor: search → view listing → (renter) request tour
 *  - landlord: create listing → submit; admin approves
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: process.env.CI ? `pnpm start -p ${PORT}` : `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // Production build with dev sign-in: E2E tests need to act as several users without Cognito.
    env: { APP_URL: `http://localhost:${PORT}`, ALLOW_DEV_AUTH: "true" },
  },
});
