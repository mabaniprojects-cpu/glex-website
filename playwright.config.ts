// Specs talk to PostgreSQL directly to assert persistence, so the same .env
// the app uses must be loaded before the config is evaluated.
import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 3000)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',

  // Compiles every route once, serially, before the workers start. See the file
  // for why this is necessary against `next dev`.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 1,

  /**
   * Capped deliberately.
   *
   * The suite runs against `next dev`, which compiles each route on first
   * request. Saturating it with one worker per CPU makes Turbopack serve
   * incomplete RSC payloads, which surfaces as
   * `SyntaxError: Unexpected end of JSON input` in the browser and leaves pages
   * stuck on their `loading.tsx` fallback. Four workers keeps it stable.
   *
   * Running against `next start` needs its own environment rather than being
   * impossible, as this comment previously claimed: `src/lib/env.ts` refuses
   * `EMAIL_PROVIDER=console` and `SEED_DEMO_DATA=true` under NODE_ENV=production,
   * so point the provider at a local SMTP sink and rely on the database already
   * being seeded. The whole suite passes that way — see "Verifying a production
   * build" in the README for the exact commands. Worth doing before a release,
   * because everything below this line is dev-server behaviour.
   */
  workers: process.env.CI ? 2 : 4,

  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  // Allowances for first-request compilation in dev.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],

  // Reuse a dev server that is already running; otherwise start one.
  //
  // `!CI` alone is not enough. The production-build job starts the real server
  // itself — `npm start` against a build, which is the whole point of that job
  // and not something this command could produce — and then Playwright refused
  // to use it: *"http://localhost:3000 is already used"*. CI should still fail
  // loudly when something unexpected holds the port, so reuse stays opt-in
  // rather than becoming unconditional.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === 'true' || !process.env.CI,
    timeout: 180_000,
  },
})
