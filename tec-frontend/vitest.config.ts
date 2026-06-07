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
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
