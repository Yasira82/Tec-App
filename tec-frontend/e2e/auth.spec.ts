import { test, expect } from '@playwright/test';

// Block the external Pi SDK script: with it loaded, `window.Pi` exists even in
// plain Chromium, so `isPiBrowser()` is a false positive and usePiAuth's
// C-123 §7 silent re-auth engages — `Pi.authenticate()` then hangs out its
// 45s timeout with no Pi bridge, so no redirect happens inside the 30s test
// window and 'networkidle' never settles. Unauthenticated-redirect semantics
// exist for NON-Pi browsers, which is what blocking the script simulates.
test.beforeEach(async ({ page }) => {
  await page.route('**/pi-sdk.js', route => route.abort());
});

test.describe('Authentication Flow', () => {

  test('login page loads and shows Pi login button', async ({ page }) => {
    await page.goto('/');

    // Should show login/connect with Pi button
    const piButton = page.locator('button, [role="button"]').filter({
      hasText: /pi|connect|login|sign in/i,
    }).first();

    await expect(piButton).toBeVisible({ timeout: 15000 });
  });

  test('unauthenticated users are redirected from hub', async ({ page }) => {
    await page.goto('/hub');

    // C-123 §7: /hub always renders its shell (middleware does NOT cookie-check
    // it); the CLIENT guard redirects unauthenticated non-payment visitors to
    // the login page once auth resolution settles.
    await expect(page).not.toHaveURL(/\/hub/, { timeout: 15000 });
  });

  test('unauthenticated users are redirected from dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Middleware-protected route — server redirect to login page
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('unauthenticated users cannot access wallet', async ({ page }) => {
    await page.goto('/dashboard/wallet');
    await expect(page).not.toHaveURL(/\/dashboard\/wallet/, { timeout: 15000 });
  });

  test('unauthenticated users cannot access assets', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await expect(page).not.toHaveURL(/\/dashboard\/assets/, { timeout: 15000 });
  });

});
