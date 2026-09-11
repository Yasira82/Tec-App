import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // Never lint build OUTPUT. `eslint .` walks it, so `npm run build` followed
  // by `npm run lint` reports 4 errors in minified chunks — none of them in
  // code anyone wrote. It cost a real verification pass this session: the run
  // was red, and the question being asked at that moment was "is the Vercel
  // build failing?", so a red lint looked like the answer. A gate that fails
  // on a clean tree is how a gate teaches people to ignore it.
  { ignores: ['.next/**', 'out/**', 'coverage/**', 'playwright-report/**'] },

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
