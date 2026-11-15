import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles:  ['./vitest.setup.ts'],
    globals:     true,
    exclude:     ['**/node_modules/**', '**/e2e/**', '**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include:  ['src/**/*.{ts,tsx}'],
      exclude:  ['src/**/__tests__/**', 'src/**/*.d.ts', 'src/**/e2e/**'],
      // TEC-AUDIT-0037 — the fleet's floor. Measured 13 Nov 2026: 75.9 statements · 66.8
      // branches · 71.3 functions · 79.4 lines. Raise it as the suite grows; never lower it
      // to make a change pass.
      thresholds: { lines: 60, functions: 60, statements: 60, branches: 50 },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
