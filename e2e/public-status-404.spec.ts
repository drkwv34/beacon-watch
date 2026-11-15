import { expect, test, type Page } from '@playwright/test';

const targetUrl = process.env.E2E_TARGET_URL ?? 'http://mock-target:8080/health';
const MISSING_SLUG = 'definitely-missing-public-status';

async function createPrivateSlug(page: Page, slug: string): Promise<void> {
  const stamp = Date.now().toString(36);
  const email = `priv-${stamp}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password12');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.waitForURL('**/dashboard');

  await page.getByRole('link', { name: 'Add your first monitor.' }).click();
  await page.getByLabel('Name').fill(`Private ${stamp}`);
  await page.getByLabel('URL').fill(targetUrl);
  await page.getByLabel('Public slug').fill(slug);
  await expect(page.getByLabel('Public status page')).not.toBeChecked();
  await page.getByRole('button', { name: 'Create monitor' }).click();
  await page.waitForURL(/\/dashboard\/targets\//);
}

test('missing public slug is HTTP 404', async ({ request }) => {
  const res = await request.get(`/s/${MISSING_SLUG}`, { maxRedirects: 0 });
  expect(res.status()).toBe(404);
  const body = await res.text();
  expect(body).toMatch(/This page does not exist/i);
  expect(body).not.toMatch(/example\.com|user_id|owner/i);
});

test('private slug is the same HTTP 404 as missing', async ({ page, request }) => {
  test.setTimeout(120_000);
  const slug = `priv-${Date.now().toString(36)}`;
  await createPrivateSlug(page, slug);

  const privateRes = await request.get(`/s/${slug}`, { maxRedirects: 0 });
  const missingRes = await request.get(`/s/${MISSING_SLUG}`, { maxRedirects: 0 });
  expect(privateRes.status()).toBe(404);
  expect(missingRes.status()).toBe(404);
  const privateBody = await privateRes.text();
  const missingBody = await missingRes.text();
  expect(privateBody).toMatch(/This page does not exist/i);
  expect(missingBody).toMatch(/This page does not exist/i);
  expect(privateBody).not.toMatch(/example\.com|user_id|owner/i);
  expect(privateBody.replace(/request[_-]?id[^<]*/gi, '')).toContain('This page does not exist');
});
