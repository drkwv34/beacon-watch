import { expect, test } from '@playwright/test';

test('owner can create a token once and revoke it', async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const email = `tokens-${stamp}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password12');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.waitForURL('**/dashboard');

  await page.goto('/dashboard/tokens');
  await expect(page.getByRole('heading', { name: 'API tokens' })).toBeVisible();

  await page.getByLabel('Label').fill('playwright');
  await page.getByRole('button', { name: 'Create token' }).click();
  const secret = page.getByTestId('token-secret');
  await expect(secret).toBeVisible();
  const value = (await secret.innerText()).trim();
  expect(value.startsWith('bw_')).toBe(true);
  await expect(page.getByText('Copy this token now. It will not be shown again.')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('token-secret')).toHaveCount(0);
  await expect(page.getByText('playwright')).toBeVisible();

  await page.getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('button', { name: 'Confirm revoke' }).click();
  await expect(page.getByText('playwright')).toHaveCount(0);
});
