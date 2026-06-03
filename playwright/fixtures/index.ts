import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';

/**
 * Custom Playwright fixtures.
 *
 * Extend the base `test` object so every spec can access page objects
 * without manually constructing them. Import `test` and `expect` from
 * this file instead of `@playwright/test` in all spec files.
 *
 * Usage:
 *   import { test, expect } from '../fixtures';
 *
 *   test('example', async ({ loginPage, dashboardPage }) => {
 *     await loginPage.goto();
 *     // ...
 *   });
 */

type PageFixtures = {
  loginPage: LoginPage;
  registerPage: RegisterPage;
  dashboardPage: DashboardPage;
};

export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
});

export { expect } from '@playwright/test';
