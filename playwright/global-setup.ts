import { request } from '@playwright/test';

/**
 * Global setup — runs once before any tests start.
 *
 * Polls the frontend dev server to confirm it is reachable.
 * If the server isn't up, tests would all fail with opaque network
 * errors. This check gives a clear, actionable error message instead.
 */

const BASE_URL = 'http://localhost:5173';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

async function globalSetup(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const context = await request.newContext({ baseURL: BASE_URL });
      const response = await context.get('/');
      if (response.ok()) {
        console.log(
          `[global-setup] Dev server reachable at ${BASE_URL}`,
        );
        return;
      }
    } catch {
      if (attempt < MAX_RETRIES) {
        console.log(
          `[global-setup] Server not ready (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS / 1000}s…`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw new Error(
    `Cannot reach the frontend dev server at ${BASE_URL}.\n` +
      'Make sure `npm run dev` is running in the frontend/ directory.',
  );
}

export default globalSetup;
