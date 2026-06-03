import type { Page } from '@playwright/test';

/**
 * Programmatic helpers that bypass the UI for faster test setup.
 *
 * Instead of clicking through the login form in every test that needs
 * an authenticated session, these helpers call the API directly and
 * seed localStorage with the same keys the frontend auth store expects.
 */

interface TokenResponse {
  access_token: string;
  token_type: string;
  user: { id: number; username: string; email: string; role: string };
}

/**
 * Register a new user via the API and return the credentials + token.
 *
 * This is useful as a test "arrange" step — quickly create a fresh user
 * without navigating through the registration form.
 */
export async function registerUserViaApi(
  page: Page,
  username: string,
  email: string,
  password: string,
): Promise<TokenResponse> {
  const response = await page.request.post('/api/auth/register', {
    data: { username, email, password },
  });

  if (!response.ok()) {
    throw new Error(
      `Register API failed: ${response.status()} ${await response.text()}`,
    );
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Log in via API and inject the auth state into the browser's localStorage.
 *
 * After calling this, the page behaves as if the user logged in through
 * the UI — JWT is attached to future API requests by the Axios interceptor.
 */
export async function loginViaApi(
  page: Page,
  username: string,
  password: string,
): Promise<TokenResponse> {
  const response = await page.request.post('/api/auth/login', {
    data: { username, password },
  });

  if (!response.ok()) {
    throw new Error(
      `Login API failed: ${response.status()} ${await response.text()}`,
    );
  }

  const body: TokenResponse = await response.json();

  // Seed localStorage exactly as the authStore.login() method does
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('vulnseeker_token', token);
      localStorage.setItem('vulnseeker_user', JSON.stringify(user));
    },
    { token: body.access_token, user: body.user },
  );

  return body;
}

/** Clear all auth-related keys from localStorage (log out) */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('vulnseeker_token');
    localStorage.removeItem('vulnseeker_user');
  });
}
