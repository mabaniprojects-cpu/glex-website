import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    // Local file-storage target and Playwright output.
    'storage/**',
    'test-results/**',
    'playwright-report/**',
    // Prisma's generated client, if the `prisma-client` generator is used.
    'src/generated/**',
  ]),

  {
    rules: {
      // `any` defeats the point of strict mode. Escape hatches must be
      // explicit and documented, never silent.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Errors must never be silently swallowed.
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
])
