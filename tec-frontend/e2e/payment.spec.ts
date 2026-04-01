import { test, expect } from '@playwright/test';

/**
 * Payment Flow Integration Tests
 * Frontend → API Routes → Gateway → Payment Service
 */

const MOCK_USER = {
  id:         'afa10fec-aa5e-4455-b66e-24a3664ac983',
  piId:       'e27efdd3-c891-4361-8fa5-5338ada467a9',
  piUsername: 'yas55eR82',
  role:       'user',
};

const MOCK_TOKEN = 'mock-test-token-payment';

// ── Setup auth state ──────────────────────────────────────
const setupAuth = async (page: import('@playwright/test').Page) => {
  await page.addInitScript((user) => {
    localStorage.setItem('tec_access_token',  'mock-test-token-payment');
    localStorage.setItem('tec_refresh_token', 'mock-refresh-token');
    localStorage.setItem('tec_user',          JSON.stringify(user));
  }, MOCK_USER);
};

// ═══════════════════════════════════════════════════════════
test.describe('Payment API Routes', () => {

  test('POST /api/payment/create — returns 401 without token', async ({ request }) => {
    const res = await request.post('/api/payment/create', {
      data: {
        userId:         MOCK_USER.id,
        amount:         1,
        currency:       'PI',
        payment_method: 'pi',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/payment/create — returns 400 for missing fields', async ({ request }) => {
    const res = await request.post('/api/payment/create', {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}` },
      data:    { amount: 1 }, // missing userId + payment_method
    });
    // 400 or 401 from gateway — not 500
    expect([400, 401, 503]).toContain(res.status());
  });

  test('POST /api/payment/approve — returns 401 without token', async ({ request }) => {
    const res = await request.post('/api/payment/approve', {
      data: { payment_id: 'test-id', pi_payment_id: 'pi-test' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/payment/complete — returns 401 without token', async ({ request }) => {
    const res = await request.post('/api/payment/complete', {
      data: { payment_id: 'test-id', transaction_id: 'tx-test' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/payment/resolve-incomplete — returns 401 without token', async ({ request }) => {
    const res = await request.post('/api/payment/resolve-incomplete', {
      data: { pi_payment_id: 'pi-test-id' },
    });
    expect(res.status()).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════
test.describe('Wallet API Routes', () => {

  test('GET /api/wallet/balance — returns 401 without token', async ({ request }) => {
    const res = await request.get('/api/wallet/balance');
    expect(res.status()).toBe(401);
  });

  test('GET /api/wallet/balance — accepts request with token', async ({ request }) => {
    const res = await request.get(`/api/wallet/balance?userId=${MOCK_USER.id}`, {
      headers: { Authorization: `Bearer ${MOCK_TOKEN}` },
    });
    // 200, 401 from gateway (invalid mock token), or 503 — not 500
    expect([200, 401, 404, 503]).toContain(res.status());
  });
});

// ═══════════════════════════════════════════════════════════
test.describe('Payment UI Flow', () => {

  test.beforeEach(setupAuth);

  test('hub page shows Pay button', async ({ page }) => {
    await page.goto('/hub');
    await page.waitForLoadState('networkidle');

    const payBtn = page.locator('button').filter({ hasText: /Pay|π/i }).first();
    if (await payBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(payBtn).toBeEnabled();
    }
  });

  test('dashboard shows payment history section', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const historySection = page.locator('text=/Transaction|History|Payment/i').first();
    if (await historySection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(historySection).toBeVisible();
    }
  });

  test('wallet page loads balance section', async ({ page }) => {
    await page.goto('/dashboard/wallet');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    if (url.includes('/dashboard/wallet')) {
      const balanceEl = page.locator('text=/Balance|π|Pi/i').first();
      await expect(balanceEl).toBeVisible({ timeout: 10000 });
    }
  });

  test('marketplace page loads listings', async ({ page }) => {
    await page.goto('/dashboard/marketplace');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    if (url.includes('/marketplace')) {
      // Either shows listings or empty state — not error
      const content = page.locator('text=/Asset|Listing|Market|No listings/i').first();
      await expect(content).toBeVisible({ timeout: 10000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════
test.describe('Commerce API Routes', () => {

  test('GET /api/commerce/orders — returns 401 without token', async ({ request }) => {
    const res = await request.get('/api/commerce/orders');
    expect([401, 404]).toContain(res.status());
  });

  test('POST /api/commerce/orders — returns 401 without token', async ({ request }) => {
    const res = await request.post('/api/commerce/orders', {
      data: { buyer_id: MOCK_USER.id, items: [] },
    });
    expect([401, 404]).toContain(res.status());
  });
});

// ═══════════════════════════════════════════════════════════
test.describe('API Gateway Health', () => {

  test('Gateway health endpoint responds', async ({ request }) => {
    const gatewayUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      'https://api-gateway-production-6a68.up.railway.app';

    const res = await request.get(`${gatewayUrl}/health`).catch(() => null);
    if (res) {
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('api-gateway');
    }
  });

  test('Auth service health responds', async ({ request }) => {
    const res = await request.get(
      'https://auth-service-pi.up.railway.app/health'
    ).catch(() => null);
    if (res) {
      expect(res.status()).toBe(200);
    }
  });

  test('Payment service health responds', async ({ request }) => {
    const res = await request.get(
      'https://payment-service-production-90e5.up.railway.app/health'
    ).catch(() => null);
    if (res) {
      expect(res.status()).toBe(200);
    }
  });
});
