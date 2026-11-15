import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (#6). They run against a production build, not the dev
// server, so they catch what only the build does (cacheComponents, the proxy,
// Secure cookies). The server reads DATABASE_URL and AUTH_SECRET from .env
// locally and from the job's env in CI.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // One worker: the tests share one database, and the local `prisma dev`
  // server mixes up queries from parallel connections (see vitest.config.mts).
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // localhost, not 127.0.0.1: Chromium accepts the Secure session cookie
    // over plain http only on localhost.
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // The production build runs first, so give it time.
    timeout: 5 * 60 * 1000,
  },
});
