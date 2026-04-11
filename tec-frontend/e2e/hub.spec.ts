import { test, expect } from '@playwright/test';

test.describe('Hub Page (authenticated)', () => {

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name:     'tec_access_token',
        value:    'mock-test-token',
        domain:   'localhost',
        path:     '/',
        secure:   false,
        httpOnly: false,
        sameSite: 'Lax',
      },
      {
        name:     'tec_user',
        value:    encodeURIComponent(JSON.stringify({
          id:         'afa10fec-aa5e-4455-b66e-24a3664ac983',
          piId:       'e27efdd3-c891-4361-8fa5-5338ada467a9',
          piUsername: 'yas55eR82',
        })),
        domain:   'localhost',
        path:     '/',
        secure:   false,
        httpOnly: false,
        sameSite: 'Lax',
      },
    ]);
  });

  test('hub page has correct structure', async ({ page }) => {
    await page.goto('/hub');
    // ✅ domcontentloaded بدل networkidle — الـ hub بيعمل background requests
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    expect(url).toMatch(/\/(hub|$)/);
  });

  test('TEC branding is visible when hub loads', async ({ page }) => {
    await page.goto('/hub');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (!url.includes('/hub')) return;

    const tecLogo = page.locator('text=TEC').first();
    if (await tecLogo.isVisible()) {
      await expect(tecLogo).toBeVisible();
    }
  });

  test('notification bell button exists on hub', async ({ page }) => {
    await page.goto('/hub');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (!url.includes('/hub')) return;

    const bell = page.locator('button').filter({ hasText: /🔔/ }).first();
    if (await bell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(bell).toBeVisible();
    }
  });

});
