import { test, expect } from '../fixtures';
import { clearAuth } from '../utils/authHelper';

const ADMIN = { username: 'admin', password: '123456' };

test('view completed task → visualization → export PDF report', async ({
  loginPage,
  page,
}) => {
  // ── 1. Login as admin ──────────────────────────────────────────────────
  await loginPage.goto();
  await clearAuth(page);
  await loginPage.waitForLoad();
  await loginPage.usernameInput.fill(ADMIN.username);
  await loginPage.passwordInput.fill(ADMIN.password);
  await loginPage.submitButton.click();
  await expect(page).toHaveURL('/admin', { timeout: 10_000 });

  // ── 2. Switch to Tasks tab ─────────────────────────────────────────────
  await page.getByRole('tab', { name: /Tasks|任务管理/ }).click();

  // ── 3. Find a completed task and click "View Result" ───────────────────
  // Look for a row that has a "Completed" tag, then click its View Result button
  const completedRow = page.locator('tr').filter({ has: page.locator('.ant-tag') }).filter({ hasText: /Completed|已完成/ }).first();
  await expect(completedRow).toBeVisible({ timeout: 5000 });
  await completedRow.getByRole('button', { name: /View Result|查看结果/ }).click();

  // Redirected to /tasks/{id}
  await expect(page).toHaveURL(/\/tasks\/\d+/, { timeout: 10_000 });

  // ── 4. Click "Visualization / Report" ──────────────────────────────────
  await page.getByRole('button', { name: /Visualization|可视化/ }).click();
  await expect(page).toHaveURL(/\/tasks\/\d+\/visualization/, { timeout: 10_000 });

  // ── 5. Verify statistics are displayed ─────────────────────────────────
  await expect(page.getByText(/Total Issues|问题总数/)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.viz-kpi-row')).toBeVisible();

  // ── 6. Export PDF report ───────────────────────────────────────────────
  // Listen for the download event (jsPDF triggers a save)
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: /Export PDF|导出 PDF/ }).click();
  const download = await downloadPromise;

  // Verify the downloaded file is a PDF
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
});
