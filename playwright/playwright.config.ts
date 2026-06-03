import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for VulnSeeker E2E tests.
 *
 * Prerequisites:
 * - Frontend dev server running on http://localhost:5173
 * - Backend API server running on http://localhost:8000
 *
 * The Vite dev server proxies /api requests to the backend,
 * so all browser requests go through http://localhost:5173.
 */

/** True when running in a CI environment (GitHub Actions, etc.) */
const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests',

  /* Run tests sequentially — one worker, no parallelism */
  fullyParallel: false,
  workers: 1,

  /* Fail the build on CI if test.only is left in the code */
  forbidOnly: isCI,

  /* Retry once on CI to absorb flaky timing */
  retries: isCI ? 1 : 0,

  /* Reporter configuration */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  /* Global timeout per test */
  timeout: 30_000,

  /* Shared settings for all tests */
  use: {
    /* Base URL — all page.goto('/login') calls resolve relative to this */
    baseURL: 'http://localhost:5173',

    /* Collect trace on first retry for debugging CI failures */
    trace: 'on-first-retry',

    /* Screenshot only on failure to keep runs fast */
    screenshot: 'only-on-failure',

    /* Video on failure for CI debugging */
    video: 'on-first-retry',

    /* Reasonable default for UI interactions */
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /* Lock locale to English so button/label text is deterministic */
        locale: 'en-US',
      },
    },
  ],

  /* Global setup verifies the dev server is reachable */
  globalSetup: './global-setup.ts',
});
