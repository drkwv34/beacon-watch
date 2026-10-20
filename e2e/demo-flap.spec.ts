import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const screenshotDir = process.env.SCREENSHOT_DIR ?? path.join(process.cwd(), 'docs', 'screenshots');
const mockTarget = process.env.MOCK_TARGET_URL ?? 'http://127.0.0.1:8080';
const demoEmail = 'demo@beacon.local';
const demoPassword = process.env.DEMO_PASSWORD ?? 'demo-password-change-me';

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

async function checkNow(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'mock-target' }).click();
  await page.getByRole('button', { name: 'Check now' }).click();
}

test('seeded demo monitor goes red on 500 and green on restore', async ({ page }) => {
  test.setTimeout(120_000);

  const restore = await fetch(`${mockTarget}/admin/ok`, { method: 'POST' });
  expect(restore.ok).toBe(true);

  await page.goto('/login');
  await page.getByLabel('Email').fill(demoEmail);
  await page.getByLabel('Password').fill(demoPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Monitors' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'mock-target' })).toBeVisible();
  await expect(page.getByText('Paused', { exact: true }).first()).toBeVisible();

  await page.goto('/s/demo');
  await waitForBadge(page, 'Up');
  await expect(page.getByRole('heading', { name: 'mock-target' })).toBeVisible();
  await shot(page, 'status-green');

  await page.goto('/dashboard');
  await expect(page.getByRole('table').getByText('Up', { exact: true }).first()).toBeVisible();
  await shot(page, 'dashboard');

  const fail = await fetch(`${mockTarget}/admin/fail`, { method: 'POST' });
  expect(fail.ok).toBe(true);
  await checkNow(page);
  await waitForBadge(page, 'Down');

  await page.goto('/s/demo');
  await expect(async () => {
    await page.reload();
    await expect(page.getByText('Down', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  }).toPass({ timeout: 45_000, intervals: [1_000] });
  await shot(page, 'status-red');

  const ok = await fetch(`${mockTarget}/admin/ok`, { method: 'POST' });
  expect(ok.ok).toBe(true);
  await checkNow(page);
  await waitForBadge(page, 'Up');

  await page.goto('/s/demo');
  await expect(async () => {
    await page.reload();
    await expect(page.getByText('Up', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible();
  }).toPass({ timeout: 45_000, intervals: [1_000] });
});
