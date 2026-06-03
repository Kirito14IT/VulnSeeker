import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * RegisterPage — POM for the /register route.
 *
 * Form fields: username (min 3), email (valid format), password (min 6).
 *
 * On success: the app auto-logs in and redirects to / (DashboardPage).
 * On duplicate: 409 Conflict with specific detail message in toast.
 * On validation failure: inline .ant-form-item-explain-error text.
 */
export class RegisterPage extends BasePage {
  /* ── Form fields ────────────────────────────────────────────────────────── */
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  /* ── Page chrome ────────────────────────────────────────────────────────── */
  readonly authCardTitle: Locator;
  readonly signInLink: Locator;

  constructor(page: Page) {
    super(page);

    // Ant Design Form.Item name="xxx" renders <input id="xxx">
    this.usernameInput = page.locator('#username');
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');

    this.authCardTitle = page.locator('.auth-card-title');
    this.signInLink = page.locator('a[href="/login"]');
  }

  /** Navigate to the register page and wait for it to render */
  async goto(): Promise<void> {
    await super.goto('/register');
  }

  /** Assert the register page has fully loaded */
  async waitForLoad(): Promise<void> {
    await expect(this.authCardTitle).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Fill all three registration fields and submit.
   * Returns the toast message text after the API call settles.
   */
  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<string> {
    await this.usernameInput.fill(username);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    return this.getToastMessage();
  }

  /**
   * Read the inline Ant Design form validation error for a given field.
   *
   * Ant Design wraps each Form.Item in a .ant-form-item div.
   * The validation error is rendered in .ant-form-item-explain-error.
   */
  async getFieldError(
    fieldName: 'username' | 'email' | 'password',
  ): Promise<string> {
    const formItem = this.page.locator('.ant-form-item').filter({
      has: this.page.locator(`#${fieldName}`),
    });
    const errorEl = formItem.locator('.ant-form-item-explain-error');
    // The error may appear asynchronously after Ant Design validates
    await errorEl.first().waitFor({ state: 'visible', timeout: 5_000 });
    return (await errorEl.first().innerText()).trim();
  }
}
