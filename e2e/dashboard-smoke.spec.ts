import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const screenshotDir = process.env.SCREENSHOT_DIR ?? '/opt/cursor/artifacts/screenshots';
const mockTarget = process.env.MOCK_TARGET_URL ?? 'http://127.0.0.1:8080';
const targetUrl = process.env.E2E_TARGET_URL ?? 'http://mock-target:8080/health';
const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

async function shot(page: Page, name: string): Promise<void> {
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`), fullPage: true });
}

function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main' });
}

async function waitForBadge(page: Page, label: 'Up' | 'Down'): Promise<void> {
  await expect(async () => {
    await page.reload();
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }).toPass({ timeout: 45_000, intervals: [1_000] });
}

async function registerOwner(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password12');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.waitForURL('**/dashboard');
}

test('anonymous and forged sessions cannot open create', async ({ page, context }) => {
  await page.goto('/dashboard/targets/new');
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveCount(0);

  await context.addCookies([{ name: 'beacon_session', value: 'forged-session', url: origin }]);
  await page.goto('/dashboard/targets/new');
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveCount(0);
});

test('owner create stays labelled at 375px with inline errors, and nav follows the session', async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const emailA = `e2e-a-${stamp}@example.com`;
  const emailB = `e2e-b-${stamp}@example.com`;

  await registerOwner(page, emailA);
  await expect(mainNav(page).getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  await expect(mainNav(page).getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(mainNav(page).getByText(emailA)).toBeVisible();
  await shot(page, 'nav-after-login');

  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole('link', { name: 'Add your first monitor.' }).click();
  await expect(page.getByRole('heading', { name: 'Add a monitor' })).toBeVisible();
  await expect(page.getByLabel('Name')).toBeVisible();
  await expect(page.getByLabel('URL')).toBeVisible();
  await page.getByLabel('Name').fill('Bad url');
  await page.getByLabel('URL').fill('not-a-url');
  await page.getByRole('button', { name: 'Create monitor' }).click();
  await expect(page.locator('#url-error')).toBeVisible();
  await expect(page.getByLabel('URL')).toHaveAttribute('aria-invalid', 'true');

  await mainNav(page).getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await expect(mainNav(page).getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(mainNav(page).getByRole('button', { name: 'Sign out' })).toHaveCount(0);

  await registerOwner(page, emailB);
  await expect(mainNav(page).getByText(emailA)).toHaveCount(0);
  await expect(mainNav(page).getByText(emailB)).toBeVisible();
  await expect(mainNav(page).getByRole('link', { name: 'Sign in' })).toHaveCount(0);
});

test('owner can create a mock-target monitor and open its public page', async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const email = `e2e-${stamp}@example.com`;
  const slug = `e2e-${stamp}`;
  const name = `Mock health ${stamp}`;

  await registerOwner(page, email);
  await expect(page.getByRole('heading', { name: 'Add your first monitor.' })).toBeVisible();
  await expect(mainNav(page).getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  await shot(page, 'login');

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

  const ok = await fetch(`${mockTarget}/admin/ok`, { method: 'POST' });
  expect(ok.ok).toBe(true);
});
