import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage — POM for the /login route.
 *
 * Form fields use Ant Design's Form.Item which renders
 * <input id="username"> and <input id="password">.
 *
 * On success: admin users are redirected to /admin, regular users to /.
 * On failure: Ant Design message.error toast with "Invalid username or password".
 */
export class LoginPage extends BasePage {
  /* ── Form fields ────────────────────────────────────────────────────────── */
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  /* ── Page chrome ────────────────────────────────────────────────────────── */
  readonly authCardTitle: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    super(page);

    // Ant Design Form.Item name="xxx" renders <input id="xxx">
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');

    // Ant Design primary button with type="submit"
    this.submitButton = page.locator('button[type="submit"]');

    this.authCardTitle = page.locator('.auth-card-title');
    // React Router Link rendered as <a href="/register">
    this.registerLink = page.locator('a[href="/register"]');
  }

  /** Navigate to the login page and wait for it to render */
  async goto(): Promise<void> {
    await super.goto('/login');
  }

  /** Assert the login page has fully loaded */
  async waitForLoad(): Promise<void> {
    await expect(this.authCardTitle).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Fill credentials and submit the form.
   * Returns the toast message text (success or error).
   */
  async login(username: string, password: string): Promise<string> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    return this.getToastMessage();
  }
}
