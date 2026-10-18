import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const screenshotDir = process.env.SCREENSHOT_DIR ?? '/opt/cursor/artifacts/screenshots';
const mockTarget = process.env.MOCK_TARGET_URL ?? 'http://127.0.0.1:8080';
const targetUrl = process.env.E2E_TARGET_URL ?? 'http://mock-target:8080/health';

async function shot(page: Page, name: string): Promise<void> {
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`), fullPage: true });
}

async function waitForBadge(page: Page, label: 'Up' | 'Down'): Promise<void> {
  await expect(async () => {
    await page.reload();
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }).toPass({ timeout: 45_000, intervals: [1_000] });
}

test('owner can create a mock-target monitor and open its public page', async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const email = `e2e-${stamp}@example.com`;
  const slug = `e2e-${stamp}`;
  const name = `Mock health ${stamp}`;

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password12');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Add your first monitor.' })).toBeVisible();

  await page.getByRole('link', { name: 'Add your first monitor.' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('URL').fill(targetUrl);
  await page.getByLabel('Grace threshold').fill('1');
  await page.getByLabel('Public status page').check();
  await page.getByLabel('Public slug').fill(slug);
  await page.getByRole('button', { name: 'Create monitor' }).click();
  await page.waitForURL(/\/dashboard\/targets\//);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await waitForBadge(page, 'Up');
  await expect(page.getByRole('heading', { name: 'Recent checks' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Incidents' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit monitor' })).toBeVisible();
  await shot(page, 'target-detail');

  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name })).toBeVisible();
  await expect(page.getByRole('table').getByText('Up', { exact: true }).first()).toBeVisible();
  await shot(page, 'dashboard-list');

  await page.goto(`/s/${slug}`);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Up', { exact: true }).first()).toBeVisible();
  await shot(page, 'status-green');

  const fail = await fetch(`${mockTarget}/admin/fail`, { method: 'POST' });
  expect(fail.ok).toBe(true);

  await page.goto('/dashboard');
  await page.getByRole('link', { name }).click();
  await page.getByRole('button', { name: 'Check now' }).click();
  await waitForBadge(page, 'Down');

  await page.goto(`/s/${slug}`);
  await expect(async () => {
    await page.reload();
    await expect(page.getByText('Down', { exact: true }).first()).toBeVisible();
  }).toPass({ timeout: 45_000, intervals: [1_000] });
  await shot(page, 'status-red');
});
