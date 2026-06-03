import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * DashboardPage — POM for the main dashboard (/).
 *
 * This is the landing page after a regular user logs in.
 * It shows a hero section, quick-action cards, and a task history table.
 */
export class DashboardPage extends BasePage {
  /* ── Key elements ───────────────────────────────────────────────────────── */
  readonly heroTitle: Locator;
  readonly taskTable: Locator;
  readonly createTaskCard: Locator;

  constructor(page: Page) {
    super(page);

    this.heroTitle = page.locator('.hero-title');
    this.taskTable = page.locator('.ant-table');
    this.createTaskCard = page.locator('.nav-card').first();
  }

  /** Navigate to the dashboard */
  async goto(): Promise<void> {
    await super.goto('/');
  }

  /** Verify the dashboard has loaded (hero title visible) */
  async waitForLoad(): Promise<void> {
    await expect(this.heroTitle).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Read the currently signed-in username from localStorage.
   * The frontend auth store persists the User object under this key.
   */
  async getSignedInUsername(): Promise<string | null> {
    const userStr = await this.page.evaluate(() =>
      localStorage.getItem('vulnseeker_user'),
    );
    if (!userStr) return null;
    return JSON.parse(userStr).username;
  }

  /** Assert that the dashboard is currently visible (user is authenticated) */
  async assertIsLoaded(): Promise<void> {
    await expect(this.heroTitle).toBeVisible();
    await expect(this.taskTable).toBeVisible();
  }
}
