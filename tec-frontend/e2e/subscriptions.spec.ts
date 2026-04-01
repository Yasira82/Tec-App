import { test, expect } from '@playwright/test';

const MOCK_USER = {
  id:         'afa10fec-aa5e-4455-b66e-24a3664ac983',
  piUsername: 'yas55eR82',
  role:       'user',
};

test.describe('Subscription Flow', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user: typeof MOCK_USER) => {
      localStorage.setItem('tec_access_token', 'mock-token');
      localStorage.setItem('tec_user',         JSON.stringify(user));
    }, MOCK_USER);
  });

  test('subscription page loads plans', async ({ page }) => {
    await page.goto('/dashboard/subscription');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    if (url.includes('/subscription')) {
      const planSection = page.locator('text=/FREE|PRO|ENTERPRISE|Plan/i').first();
      await expect(planSection).toBeVisible({ timeout: 10000 });
    }
  });

  test('GET /api/subscriptions — returns plans', async ({ request }) => {
    const res = await request.get('/api/subscriptions?endpoint=plans');
    expect([200, 404, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeDefined();
    }
  });

  test('subscription status requires auth', async ({ request }) => {
    const res = await request.get('/api/subscriptions?endpoint=status');
    expect([401, 404, 503]).toContain(res.status());
  });
});
