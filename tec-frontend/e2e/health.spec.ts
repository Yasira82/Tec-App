import { test, expect } from '@playwright/test';

test.describe('App Health', () => {

  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/error/);
    const status = page.response();
    expect(await page.title()).toBeTruthy();
  });

  test('has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Filter out known non-critical errors
    const critical = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('hydrat')
    );
    expect(critical).toHaveLength(0);
  });

});
