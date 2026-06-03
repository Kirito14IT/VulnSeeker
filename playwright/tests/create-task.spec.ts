import { test, expect } from '../fixtures';
import { clearAuth } from '../utils/authHelper';

const ADMIN = { username: 'admin', password: '123456' };

test.setTimeout(300_000); // 5 min — analysis can take a while

test('full task lifecycle: submit → running → logs → completed', async ({
  loginPage,
  page,
}) => {
  // ── 1. Login ──────────────────────────────────────────────────────────
  await loginPage.goto();
  await clearAuth(page);
  await loginPage.waitForLoad();
  await loginPage.usernameInput.fill(ADMIN.username);
  await loginPage.passwordInput.fill(ADMIN.password);
  await loginPage.submitButton.click();
  await expect(page).toHaveURL('/admin', { timeout: 10_000 });

  // ── 2. Create task ────────────────────────────────────────────────────
  await page.goto('/tasks/new', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#repo_url')).toBeVisible();
  await page.locator('#repo_url').fill('redis/redis');
  await page.locator('button[type="submit"]').click();

  // Redirected to /tasks/{id}
  await expect(page).toHaveURL(/\/tasks\/\d+/, { timeout: 10_000 });

  // ── 3. Start analysis ─────────────────────────────────────────────────
  // Task is created with status "pending", click "Start Analysis"
  await expect(page.locator('.ant-tag')).toContainText('Pending');
  await page.getByRole('button', { name: /Start Analysis|开始分析/ }).click();
  await expect(page.getByText(/started|已启动/)).toBeVisible({ timeout: 5000 });

  // ── 4. Wait for running → logs appear ─────────────────────────────────
  // Status changes to Running, worker pushes real-time logs
  await expect(page.locator('.ant-tag')).toContainText('Running', { timeout: 30_000 });
  // Poll for log lines — they stream in via WebSocket
  await expect(async () => {
    const logText = await page.locator('.log-line').count();
    expect(logText).toBeGreaterThan(0);
  }).toPass({ timeout: 60_000 });

  // ── 5. Wait for completion ────────────────────────────────────────────
  // Worker finishes → status → Completed → frontend auto-refreshes
  await expect(page.locator('.ant-tag')).toContainText('Completed', { timeout: 240_000 });

  // ── 6. "Visualization / Report" button appears ────────────────────────
  await expect(
    page.getByRole('button', { name: /Visualization|可视化/ }),
  ).toBeVisible({ timeout: 10_000 });
});
