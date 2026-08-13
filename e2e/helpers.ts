// Loaded here rather than relied upon from playwright.config.ts: specs run in
// worker processes, and `demoPassword()` below has no fallback to mask it if
// the environment did not come through.
import 'dotenv/config'
import type { Locator, Page } from '@playwright/test'

/**
 * The password the demo accounts were seeded with.
 *
 * Every spec used to carry its own hardcoded fallback. That is a sign-in
 * credential in a public repository, and — more to the point — a fallback here
 * would disagree with `prisma/seed.ts`, which now refuses to seed without an
 * explicit `SEED_DEMO_PASSWORD`. A test that signs in with a different password
 * than the accounts were created with fails as an unhelpful "invalid
 * credentials", so this throws with the real reason instead.
 */
export function demoPassword(): string {
  const password = process.env.SEED_DEMO_PASSWORD

  if (!password) {
    throw new Error(
      'SEED_DEMO_PASSWORD is not set, so these specs cannot sign in.\n' +
        'Set it to the same value the database was seeded with (see .env).'
    )
  }

  return password
}

/**
 * Next.js injects `#__next-route-announcer__` with `role="alert"` for
 * screen-reader route announcements. An unscoped `getByRole('alert')`
 * therefore matches two elements and trips Playwright's strict mode.
 * Always scope page-level roles to the main landmark.
 */
export const mainRegion = (page: Page): Locator => page.locator('#main-content')

export const mainAlert = (page: Page): Locator => mainRegion(page).getByRole('alert')

export const mainStatus = (page: Page): Locator => mainRegion(page).getByRole('status')
