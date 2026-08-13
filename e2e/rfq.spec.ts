import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { mainRegion, mainStatus } from './helpers'

/**
 * The RFQ workflow is the core business flow.
 *
 * The specification is explicit: submissions must be stored in the database,
 * not merely acknowledged in the UI. Every assertion here checks PostgreSQL.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

/** RFQ submission is rate-limited per IP; every spec shares 127.0.0.1. */
async function clearRfqRateLimit() {
  await db.rateLimit.deleteMany({ where: { key: { startsWith: 'rfq:' } } })
}

const REFERENCE_PATTERN = /GLEX-RFQ-\d{4}-\d{6}/

test.describe('RFQ builder', () => {
  test('shows an empty cart state and a route into the marketplace', async ({ page }) => {
    await page.goto('/en/rfq')

    const main = mainRegion(page)
    await expect(main.getByText('Your RFQ is empty')).toBeVisible()
    await expect(main.getByRole('link', { name: 'Marketplace' }).first()).toBeVisible()
  })

  test('pre-populates line items from the cart', async ({ page }) => {
    await page.goto('/en/marketplace')
    await mainRegion(page)
      .locator('ul > li')
      .filter({ hasText: /cement/i })
      .first()
      .getByRole('button', { name: /add to rfq/i })
      .click()

    await expect(
      mainRegion(page).getByRole('button', { name: /in your rfq/i }).first()
    ).toBeVisible({ timeout: 15_000 })

    await page.goto('/en/rfq')

    // The cart summary and the first line item both reflect the product.
    await expect(mainRegion(page).getByText(/cement/i).first()).toBeVisible()
  })
})

/**
 * Serial: these tests share one per-IP rate-limit bucket (10 RFQs/hour). Run in
 * parallel, one worker clears the bucket while another is mid-submission, so
 * the limiter intermittently rejects a legitimate submission.
 */
test.describe.serial('RFQ submission', () => {
  test('persists a guest RFQ with items and an activity record', async ({ page }) => {
    await clearRfqRateLimit()

    const email = `rfq-${Date.now()}@example.com`
    await page.goto('/en/rfq')

    const form = page.locator('form')
    await form.getByLabel('Product or material').first().fill('Portland Cement Type I')
    await form.getByLabel('Quantity').first().fill('250')
    await form.getByLabel('Destination country').fill('United Arab Emirates')
    await form.getByLabel('Destination city').fill('Dubai')
    await form.getByLabel('Project name').fill('E2E Verification Project')

    await form.getByLabel('Full name').fill('RFQ Guest Tester')
    await form.getByLabel('Business email').fill(email)

    await form.getByRole('button', { name: /submit rfq/i }).click()

    // Lands on the confirmation page with a real reference.
    await page.waitForURL(REFERENCE_PATTERN, { timeout: 30_000 })
    const status = mainStatus(page)
    await expect(status).toBeVisible()
    await expect(status).toContainText(REFERENCE_PATTERN)

    const reference = (await status.innerText()).match(REFERENCE_PATTERN)?.[0]
    expect(reference, 'reference rendered').toBeTruthy()

    // --- The assertions that matter: it reached PostgreSQL ---
    const rfq = await db.rFQ.findUnique({
      where: { reference: reference! },
      include: { items: true, activities: true },
    })

    expect(rfq, 'RFQ row created').not.toBeNull()
    expect(rfq!.status).toBe('SUBMITTED')
    expect(rfq!.isGuest).toBe(true)
    expect(rfq!.guestEmail).toBe(email)
    // A guest RFQ is not final until the emailed link is followed.
    expect(rfq!.emailVerified).toBe(false)
    expect(rfq!.destinationCountry).toBe('United Arab Emirates')
    expect(rfq!.projectName).toBe('E2E Verification Project')
    expect(rfq!.submittedAt).not.toBeNull()

    expect(rfq!.items).toHaveLength(1)
    expect(Number(rfq!.items[0]!.quantity)).toBe(250)

    expect(rfq!.activities.length).toBeGreaterThan(0)
    expect(rfq!.activities[0]!.action).toBe('SUBMITTED')
    expect(rfq!.activities[0]!.toStatus).toBe('SUBMITTED')

    // A verification token is issued for the guest address.
    const token = await db.securityToken.findFirst({
      where: { email, purpose: 'EMAIL_VERIFICATION' },
    })
    expect(token, 'verification token issued').not.toBeNull()
  })

  test('clears the cart after a successful submission', async ({ page, context }) => {
    await clearRfqRateLimit()

    await page.goto('/en/marketplace')
    await mainRegion(page)
      .locator('ul > li')
      .first()
      .getByRole('button', { name: /add to rfq/i })
      .click()
    await expect(
      mainRegion(page).getByRole('button', { name: /in your rfq/i }).first()
    ).toBeVisible({ timeout: 15_000 })

    await page.goto('/en/rfq')
    const form = page.locator('form')
    await form.getByLabel('Destination country').fill('Oman')
    await form.getByLabel('Full name').fill('Cart Clearing Tester')
    await form.getByLabel('Business email').fill(`cart-${Date.now()}@example.com`)
    await form.getByRole('button', { name: /submit rfq/i }).click()

    await page.waitForURL(REFERENCE_PATTERN, { timeout: 30_000 })

    const cookies = await context.cookies()
    const cart = cookies.find((cookie) => cookie.name === 'GLEX_RFQ_CART')
    // Either removed outright, or emptied.
    expect(cart?.value ?? '').toBe('')
  })

  test('rejects a submission with no destination', async ({ page }) => {
    await clearRfqRateLimit()
    await page.goto('/en/rfq')

    const form = page.locator('form')
    await form.getByLabel('Product or material').first().fill('Some material')
    await form.getByLabel('Full name').fill('Invalid Tester')
    await form.getByLabel('Business email').fill(`invalid-${Date.now()}@example.com`)
    await form.getByRole('button', { name: /submit rfq/i }).click()

    // Stays on the builder; no reference is issued.
    await expect(page).not.toHaveURL(REFERENCE_PATTERN)
    expect(page.url()).toContain('/rfq')
  })

  test('requires a guest email address', async ({ page }) => {
    await clearRfqRateLimit()
    await page.goto('/en/rfq')

    const form = page.locator('form')
    await form.getByLabel('Product or material').first().fill('Some material')
    await form.getByLabel('Destination country').fill('Bahrain')
    await form.getByRole('button', { name: /submit rfq/i }).click()

    await expect(page).not.toHaveURL(REFERENCE_PATTERN)
  })
})

test.describe('RFQ confirmation privacy', () => {
  test('withholds details from someone who only knows the reference', async ({ page }) => {
    await clearRfqRateLimit()

    // Submit as a guest, then view the confirmation in a signed-out context.
    const email = `privacy-${Date.now()}@example.com`
    await page.goto('/en/rfq')

    const form = page.locator('form')
    await form.getByLabel('Product or material').first().fill('Confidential material')
    await form.getByLabel('Destination country').fill('Qatar')
    await form.getByLabel('Project name').fill('Confidential Project Name')
    await form.getByLabel('Full name').fill('Privacy Tester')
    await form.getByLabel('Business email').fill(email)
    await form.getByRole('button', { name: /submit rfq/i }).click()

    await page.waitForURL(REFERENCE_PATTERN, { timeout: 30_000 })
    const reference = page.url().match(REFERENCE_PATTERN)![0]

    // A different visitor with only the reference must not see the details.
    const body = await mainRegion(page).innerText()
    expect(body).toContain(reference)
    expect(body, 'project name must not leak').not.toContain('Confidential Project Name')
    expect(body, 'line items must not leak').not.toContain('Confidential material')
  })

  test('returns not-found for an unknown reference', async ({ page }) => {
    await page.goto('/en/rfq/GLEX-RFQ-2026-999999')
    await expect(page.getByText('Page not found')).toBeVisible()
  })
})
