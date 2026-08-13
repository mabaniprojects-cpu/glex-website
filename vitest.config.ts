import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Vite resolves the `@/*` paths from tsconfig.json natively; the
  // vite-tsconfig-paths plugin is no longer needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Playwright specs are driven by Playwright, not Vitest.
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
    server: {
      // next-intl ships ESM only; inlining avoids CJS interop failures.
      deps: { inline: ['next-intl', 'use-intl'] },
    },
  },
})
