import type { Locator, Page } from '@playwright/test'

/**
 * Next.js injects `#__next-route-announcer__` with `role="alert"` for
 * screen-reader route announcements. An unscoped `getByRole('alert')`
 * therefore matches two elements and trips Playwright's strict mode.
 * Always scope page-level roles to the main landmark.
 */
export const mainRegion = (page: Page): Locator => page.locator('#main-content')

export const mainAlert = (page: Page): Locator => mainRegion(page).getByRole('alert')

export const mainStatus = (page: Page): Locator => mainRegion(page).getByRole('status')
