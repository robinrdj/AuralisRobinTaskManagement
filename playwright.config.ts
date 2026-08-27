import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the real stack: the Hono API on an in-memory
 * PGlite database, and the Vite dev server proxying `/api` to it. Nothing is
 * mocked, and each run starts from an empty database — so a test that passes
 * here exercised real HTTP, real cookies and real SQL.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Tests share one API process and therefore one database, so they must not
  // race each other over the same board. Each test creates its own guest.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: [
    {
      command: "npm run dev:api",
      port: 4000,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        JWT_SECRET: "e2e-secret-long-enough-to-satisfy-validation",
      },
    },
    {
      command: "npm run dev:web",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
