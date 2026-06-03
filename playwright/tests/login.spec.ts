import { test, expect } from '../fixtures';
import { randomCredentials, randomUsername } from '../utils/randomData';
import {
  clearAuth,
  registerUserViaApi,
} from '../utils/authHelper';

/**
 * Login E2E tests.
 *
 * Covers:
 *   - Admin login → redirect to /admin
 *   - Regular user login → redirect to /
 *   - Wrong password → error toast
 *   - Nonexistent user → error toast
 *   - Navigation to register page via link
 */

// ── Admin credentials (auto-created by the app on first startup) ───────────
const ADMIN = { username: 'admin', password: '123456' };

test.describe('User Login', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    await loginPage.goto();
    await clearAuth(page);
    await loginPage.waitForLoad();
    await loginPage.clearToasts();
  });

  test('should login as admin and redirect to /admin', async ({
    loginPage,
    page,
  }) => {
    await loginPage.usernameInput.fill(ADMIN.username);
    await loginPage.passwordInput.fill(ADMIN.password);
    await loginPage.submitButton.click();

    // Admin users are redirected to /admin
    await expect(page).toHaveURL('/admin', { timeout: 10_000 });

    // Verify auth state persisted
    const token = await page.evaluate(() =>
      localStorage.getItem('vulnseeker_token'),
    );
    expect(token).toBeTruthy();

    const userStr = await page.evaluate(() =>
      localStorage.getItem('vulnseeker_user'),
    );
    const user = JSON.parse(userStr!);
    expect(user.username).toBe(ADMIN.username);
    expect(user.role).toBe('admin');
  });

  test('should login as a newly registered regular user and redirect to dashboard', async ({
    loginPage,
    page,
  }) => {
    // Arrange: create a fresh user via API (fast setup)
    const creds = randomCredentials();
    const registerResp = await registerUserViaApi(
      page,
      creds.username,
      creds.email,
      creds.password,
    );
    expect(registerResp.user.username).toBe(creds.username);

    // Clear the auto-login state from registration
    await clearAuth(page);
    await loginPage.goto();
    await loginPage.waitForLoad();

    // Act: log in via UI
    await loginPage.login(creds.username, creds.password);

    // Assert: regular users land on /
    await expect(page).toHaveURL('/', { timeout: 10_000 });
    const signedInUser = await page.evaluate(() => {
      const u = localStorage.getItem('vulnseeker_user');
      return u ? JSON.parse(u).username : null;
    });
    expect(signedInUser).toBe(creds.username);
  });

  test('should show error toast for wrong password', async ({
    loginPage,
    page,
  }) => {
    // Arrange: create a known user
    const creds = randomCredentials();
    await registerUserViaApi(
      page,
      creds.username,
      creds.email,
      creds.password,
    );
    await clearAuth(page);
    await loginPage.goto();
    await loginPage.waitForLoad();

    // Act: login with wrong password
    const toast = await loginPage.login(creds.username, 'wrong_password');

    // Assert
    expect(toast).toContain('Invalid username or password');
    // Still on login page
    expect(page.url()).toContain('/login');
  });

  test('should show error toast for nonexistent user', async ({
    loginPage,
  }) => {
    const fakeUser = randomUsername();
    const toast = await loginPage.login(fakeUser, 'some_password');
    expect(toast).toContain('Invalid username or password');
  });

  test('should navigate to register page via link', async ({
    loginPage,
    page,
  }) => {
    await loginPage.registerLink.click();
    await expect(page).toHaveURL('/register', { timeout: 5_000 });
  });

});
