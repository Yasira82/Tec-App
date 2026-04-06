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

  webServer: {
    // 'npm run start' serves the pre-built app (.next/).
    // The CI workflow builds the app before running this step.
    // For local runs, build once with `npm run build` before `npm run test:e2e`.
    command: 'npm run start',
    url:     'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      E2E_MODE:          'true',
      E2E_ALLOW_NETWORK: 'false',
    },
  },
});
