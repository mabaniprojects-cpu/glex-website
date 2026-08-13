import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/**
 * Cookie consent (spec §31).
 *
 * The decision is read on the server, so the banner must be absent — not
 * hidden — once a choice has been made, and a refusal must be recorded just as
 * a grant is.
 *
 * Each test uses its own browser context so it starts with no consent cookie.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

const banner = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: 'Cookies on this site' })

test.describe('Cookie consent banner', () => {
  test('appears for a first-time visitor', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/en')

    await expect(banner(page)).toBeVisible()

    // Neither choice may be presented as the only real option.
    await expect(banner(page).getByRole('button', { name: 'Accept all' })).toBeVisible()
    await expect(banner(page).getByRole('button', { name: 'Essential only' })).toBeVisible()

    await context.close()
  })

  test('accepting stores the choice and does not come back', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/en')

    const before = await db.consentRecord.count({ where: { purpose: 'ANALYTICS' } })

    await banner(page).getByRole('button', { name: 'Accept all' }).click()
    await expect(banner(page)).toHaveCount(0)

    const cookie = (await context.cookies()).find((c) => c.name === 'GLEX_CONSENT')
    expect(cookie?.value).toBe('all')

    // Gone on a fresh navigation too — the server sees the choice.
    await page.goto('/en/about')
    await expect(banner(page)).toHaveCount(0)

    await expect
      .poll(() => db.consentRecord.count({ where: { purpose: 'ANALYTICS', granted: true } }))
      .toBeGreaterThan(0)
    expect(await db.consentRecord.count({ where: { purpose: 'ANALYTICS' } })).toBeGreaterThan(
      before
    )

    await context.close()
  })

  test('declining is recorded as a refusal, not silence', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/en')

    const before = await db.consentRecord.count({
      where: { purpose: 'ANALYTICS', granted: false },
    })

    await banner(page).getByRole('button', { name: 'Essential only' }).click()
    await expect(banner(page)).toHaveCount(0)

    const cookie = (await context.cookies()).find((c) => c.name === 'GLEX_CONSENT')
    expect(cookie?.value).toBe('essential')

    // A refusal is evidence too, and must be stored.
    await expect
      .poll(() => db.consentRecord.count({ where: { purpose: 'ANALYTICS', granted: false } }))
      .toBeGreaterThan(before)

    await context.close()
  })

  test('the choice can be changed from the cookie policy page', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/en')

    await banner(page).getByRole('button', { name: 'Essential only' }).click()
    await expect(banner(page)).toHaveCount(0)

    await page.goto('/en/cookies')
    const main = page.locator('#main-content')
    await expect(main.getByText('You have chosen essential cookies only.')).toBeVisible()

    await main.getByRole('button', { name: 'Accept all' }).click()
    await expect(main.getByRole('status')).toBeVisible({ timeout: 20_000 })

    const cookie = (await context.cookies()).find((c) => c.name === 'GLEX_CONSENT')
    expect(cookie?.value).toBe('all')

    await context.close()
  })

  test('is translated in Arabic and lays out right-to-left', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/ar')

    const arabicBanner = page.getByRole('dialog')
    await expect(arabicBanner).toBeVisible()

    // No untranslated English may leak into a non-English locale.
    await expect(arabicBanner.getByText(/Accept all|Essential only/)).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    await context.close()
  })
})
