import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'prettier'),
  {
    rules: {
      // ── منع استيراد packages/tec-core-sdk مباشرة ──────────
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group:   ['**/packages/tec-core-sdk/**'],
            message: 'استخدم @yasser172/tec-sdk بدلاً من packages/tec-core-sdk مباشرة. راجع src/lib/sdk.ts',
          },
          {
            group:   ['**/tec-core-sdk/src/**'],
            message: 'استخدم @yasser172/tec-sdk بدلاً من الـ source مباشرة.',
          },
        ],
      }],
    },
  },
];

export default eslintConfig;
