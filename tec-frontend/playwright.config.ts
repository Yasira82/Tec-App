import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:   './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries:   process.env.CI ? 2 : 0,
  workers:   process.env.CI ? 1 : undefined,
  timeout:   30000,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL:       process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace:         'on-first-retry',
    screenshot:    'only-on-failure',
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use:  { ...devices['Pixel 5'] },
    },
  ],

  // Start a local server only when no external base URL is provided.
  // In CI the app is already built, so use `next start` (production server).
  // Locally, use `next dev` for fast iteration.
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url:     'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
