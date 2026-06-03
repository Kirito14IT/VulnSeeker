import { type Page, type Locator } from '@playwright/test';

/**
 * BasePage — shared foundation for all page objects.
 *
 * Provides common locators (e.g. Ant Design message toast)
 * and convenience methods (navigation, toast reading).
 */
export class BasePage {
  readonly page: Page;

  /** Ant Design v5 renders success/error messages inside this container */
  readonly messageToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messageToast = page.locator('.ant-message-notice');
  }

  /**
   * Navigate to a path relative to baseURL.
   * Uses 'domcontentloaded' — fast enough for SPAs, since each page object
   * has its own waitForLoad() that asserts the form elements are visible.
   * (Avoid 'networkidle' because Socket.IO keeps a persistent connection.)
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Wait for the Ant Design message toast to appear and return its text content.
   * The toast auto-dismisses after ~3s, so call this promptly after the action
   * that triggers it.
   */
  async getToastMessage(): Promise<string> {
    await this.messageToast.first().waitFor({
      state: 'visible',
      timeout: 10_000,
    });
    return (await this.messageToast.first().innerText()).trim();
  }

  /**
   * Clear any lingering toasts by removing them from the DOM.
   * Useful in beforeEach to prevent stale toasts from leaking between tests.
   */
  async clearToasts(): Promise<void> {
    await this.page.evaluate(() => {
      document
        .querySelectorAll('.ant-message-notice')
        .forEach((el) => el.remove());
    });
  }
}
