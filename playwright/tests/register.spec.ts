import { test, expect } from '../fixtures';
import { randomCredentials } from '../utils/randomData';
import { clearAuth } from '../utils/authHelper';

/**
 * Data-driven validation cases for registration form fields.
 *
 * Each entry describes a single boundary-value scenario:
 * the field to test, the invalid value, and whether inline
 * validation error is expected.
 */
const validationCases = [
  {
    scenario: 'username too short — 2 characters',
    field: 'username',
    value: 'ab',
    expectedError: true,
  },
  {
    scenario: 'invalid email format — missing @',
    field: 'email',
    value: 'not-an-email',
    expectedError: true,
  },
  {
    scenario: 'password too short — 3 characters',
    field: 'password',
    value: '123',
    expectedError: true,
  },
];

/**
 * Registration E2E tests.
 *
 * Covers:
 *   - Successful registration with auto-login → redirect to /
 *   - Duplicate username → 409 Conflict toast
 *   - Client-side validation: short username, bad email, short password
 *   - Data-driven validation using auth-validation.json
 */

test.describe('User Registration', () => {
  test.beforeEach(async ({ registerPage, page }) => {
    // Navigate to /register first, then clear any lingering auth
    await registerPage.goto();
    await clearAuth(page);
    await registerPage.waitForLoad();
    await registerPage.clearToasts();
  });

  test('should register a new user and auto-redirect to dashboard', async ({
    registerPage,
    page,
  }) => {
    const creds = randomCredentials();

    // Submit the registration form
    await registerPage.register(creds.username, creds.email, creds.password);

    // On success the app calls authStore.login() then navigate('/')
    await expect(page).toHaveURL('/', { timeout: 10_000 });

    // Verify localStorage has the expected auth keys
    const token = await page.evaluate(() =>
      localStorage.getItem('vulnseeker_token'),
    );
    expect(token).toBeTruthy();

    const userStr = await page.evaluate(() =>
      localStorage.getItem('vulnseeker_user'),
    );
    expect(userStr).toBeTruthy();

    const storedUser = JSON.parse(userStr!);
    expect(storedUser.username).toBe(creds.username);
    expect(storedUser.role).toBe('user');
  });

  test('should reject duplicate username with 409 Conflict', async ({
    registerPage,
    page,
  }) => {
    const creds = randomCredentials();

    // First registration — succeeds
    await registerPage.register(creds.username, creds.email, creds.password);
    await expect(page).toHaveURL('/', { timeout: 10_000 });

    // Log out to access /register again
    await clearAuth(page);
    await registerPage.goto();
    await registerPage.waitForLoad();

    // Second registration with same username but different email
    await registerPage.register(
      creds.username,
      `different_${creds.email}`,
      creds.password,
    );

    // Backend returns 409 with detail
    const toast = await registerPage.getToastMessage();
    expect(toast).toContain(`Username '${creds.username}' is already taken`);
  });

  test('should show inline validation error for username < 3 chars', async ({
    registerPage,
  }) => {
    await registerPage.usernameInput.fill('ab');
    // Fill other fields with valid data so only username triggers an error
    await registerPage.emailInput.fill('valid@example.com');
    await registerPage.passwordInput.fill('valid_password');
    await registerPage.submitButton.click();

    const error = await registerPage.getFieldError('username');
    expect(error).toBeTruthy();
  });

  test('should show inline validation error for invalid email', async ({
    registerPage,
  }) => {
    await registerPage.usernameInput.fill('valid_user');
    await registerPage.emailInput.fill('not-an-email');
    await registerPage.passwordInput.fill('valid_password');
    await registerPage.submitButton.click();

    const error = await registerPage.getFieldError('email');
    expect(error).toBeTruthy();
  });

  test('should show inline validation error for password < 6 chars', async ({
    registerPage,
  }) => {
    await registerPage.usernameInput.fill('valid_user');
    await registerPage.emailInput.fill('valid@example.com');
    await registerPage.passwordInput.fill('12345');
    await registerPage.submitButton.click();

    const error = await registerPage.getFieldError('password');
    expect(error).toBeTruthy();
  });

  test('should navigate to login page via sign-in link', async ({
    registerPage,
    page,
  }) => {
    await registerPage.signInLink.click();
    await expect(page).toHaveURL('/login', { timeout: 5_000 });
  });
});

/**
 * Data-driven validation tests.
 *
 * Each entry in auth-validation.json is iterated and tested independently.
 * This makes it trivial to add new boundary cases without changing test logic.
 */
test.describe('Registration validation — data-driven', () => {
  for (const { scenario, field, value } of validationCases) {
    test(scenario, async ({ registerPage, page }) => {
      await registerPage.goto();
      await clearAuth(page);
      await registerPage.waitForLoad();

      // Fill the target field with the invalid value
      const inputs: Record<string, any> = {
        username: registerPage.usernameInput,
        email: registerPage.emailInput,
        password: registerPage.passwordInput,
      };

      // Fill all three fields — invalid value for the target, valid for the others
      for (const f of ['username', 'email', 'password']) {
        if (f === field) {
          await inputs[f].fill(value);
        } else if (f === 'username') {
          await inputs[f].fill('valid_user');
        } else if (f === 'email') {
          await inputs[f].fill('valid@example.com');
        } else {
          await inputs[f].fill('valid_password');
        }
      }

      await registerPage.submitButton.click();

      // Should show inline validation error for the targeted field
      const error = await registerPage.getFieldError(
        field as 'username' | 'email' | 'password',
      );
      expect(error).toBeTruthy();
    });
  }
});
