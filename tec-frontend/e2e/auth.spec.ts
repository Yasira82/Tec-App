import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {

  test('login page loads and shows Pi login button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should show login/connect with Pi button
    const piButton = page.locator('button, [role="button"]').filter({
      hasText: /pi|connect|login|sign in/i,
    }).first();

    await expect(piButton).toBeVisible({ timeout: 10000 });
  });

  test('unauthenticated users are redirected from hub', async ({ page }) => {
    await page.goto('/hub');
    await page.waitForLoadState('networkidle');

    // Should redirect to login page
    await expect(page).not.toHaveURL('/hub');
  });

  test('unauthenticated users are redirected from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should redirect to login page
    await expect(page).not.toHaveURL('/dashboard');
  });

  test('unauthenticated users cannot access wallet', async ({ page }) => {
    await page.goto('/dashboard/wallet');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL('/dashboard/wallet');
  });

  test('unauthenticated users cannot access assets', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL('/dashboard/assets');
  });

});
