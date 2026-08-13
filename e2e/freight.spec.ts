import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { mainAlert, mainStatus } from './helpers'

/**
 * Freight quote requests.
 *
 * The form reuses the contact pipeline — same `GLEX-INQ-` series, same consent
 * record, same rate limit and honeypot — so what these tests weight is what is
 * genuinely new: that the structured freight detail is stored as typed columns
 * rather than prose, that a dangerous-goods declaration is recorded exactly as
 * given, and that no rate or price appears anywhere.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

const main = (page: Page) => page.locator('#main-content')

/**
 * Each test submits from its own address.
 *
 * The action rate-limits unauthenticated enquiries at 5/hour per IP, and shares
 * that bucket with the contact form by design — a bot must not get a fresh
 * allowance by switching between them. Left alone, every test in this file plus
 * the contact specs would queue behind one bucket and the later ones would fail
 * for reasons that have nothing to do with what they assert.
 *
 * `clientIp()` reads `x-forwarded-for`, so giving each worker its own address
 * yields an independent bucket without weakening the limit itself. The range is
 * TEST-NET-2 (RFC 5737), reserved for documentation and never routable.
 */
test.beforeEach(async ({ context }, testInfo) => {
  // Project name included because `workerIndex` repeats across projects.
  const slot = (testInfo.workerIndex + testInfo.project.name.length) % 250
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${slot + 1}` })
})

async function fillRequired(page: Page, cargo: string) {
  const form = page.locator('form')

  await form.getByLabel('Full name').fill('Freight Tester')
  await form.getByLabel('Email').fill('freight@example.com')
  await form.getByLabel('Destination country').fill('United Arab Emirates')
  await form.getByLabel('What is being shipped').fill(cargo)

  return form
}

test.describe('Freight quote form', () => {
  test('stores the freight detail as typed columns, not prose', async ({ page }) => {
    const cargo = `Portland cement in 50kg bags, palletised. ${Date.now()}`

    await page.goto('/en/freight')
    const form = await fillRequired(page, cargo)

    await form.getByLabel('Mode of transport').selectOption('OCEAN')
    await form.getByLabel('Incoterm').selectOption('FOB')
    await form.getByLabel('Origin city').fill('Jeddah')
    await form.getByLabel('Destination city').fill('Dubai')
    await form.getByLabel('Gross weight (kg)').fill('24000')
    await form.getByLabel('Volume (m³)').fill('58.5')
    await form.getByLabel('Container or equipment').fill('1 x 40ft HC')

    await form.getByRole('button', { name: /request a freight quote/i }).click()

    const status = mainStatus(page)
    await expect(status).toBeVisible({ timeout: 20_000 })
    await expect(status).toContainText(/GLEX-INQ-\d{4}-\d{6}/)

    const inquiry = await db.contactInquiry.findFirstOrThrow({
      where: { message: cargo },
      include: { freight: true },
    })

    // Reuses the contact pipeline rather than duplicating it.
    expect(inquiry.type).toBe('FREIGHT_QUOTE')
    expect(inquiry.reference).toMatch(/^GLEX-INQ-\d{4}-\d{6}$/)
    expect(inquiry.consentGiven).toBe(true)

    // The part that would be lost if this were crammed into a message body.
    const freight = inquiry.freight!
    expect(freight).not.toBeNull()
    expect(freight.mode).toBe('OCEAN')
    expect(freight.incoterm).toBe('FOB')
    expect(freight.originCountry).toBe('Saudi Arabia')
    expect(freight.destinationCountry).toBe('United Arab Emirates')
    expect(freight.originCity).toBe('Jeddah')
    expect(Number(freight.weightKg)).toBe(24000)
    expect(Number(freight.volumeCbm)).toBe(58.5)
    expect(freight.containerType).toBe('1 x 40ft HC')

    await db.contactInquiry.delete({ where: { id: inquiry.id } })
  })

  test('records a dangerous-goods declaration exactly as given', async ({ page }) => {
    const cargo = `Lithium batteries, UN3480, Class 9. ${Date.now()}`

    await page.goto('/en/freight')
    const form = await fillRequired(page, cargo)

    await form.getByLabel('This shipment contains dangerous goods').check()
    await form.getByRole('button', { name: /request a freight quote/i }).click()

    await expect(mainStatus(page)).toBeVisible({ timeout: 20_000 })

    const inquiry = await db.contactInquiry.findFirstOrThrow({
      where: { message: cargo },
      include: { freight: true },
    })

    // A safety declaration, so it is stored as declared — never inferred from
    // the cargo text.
    expect(inquiry.freight!.isHazardous).toBe(true)

    await db.contactInquiry.delete({ where: { id: inquiry.id } })
  })

  test('defaults dangerous goods to false rather than guessing', async ({ page }) => {
    const cargo = `Ordinary ceramic tiles, no hazard. ${Date.now()}`

    await page.goto('/en/freight')
    const form = await fillRequired(page, cargo)
    await form.getByRole('button', { name: /request a freight quote/i }).click()

    await expect(mainStatus(page)).toBeVisible({ timeout: 20_000 })

    const inquiry = await db.contactInquiry.findFirstOrThrow({
      where: { message: cargo },
      include: { freight: true },
    })

    expect(inquiry.freight!.isHazardous).toBe(false)
    // An unset weight is unknown, not zero — zero would read as a real figure.
    expect(inquiry.freight!.weightKg).toBeNull()
    expect(inquiry.freight!.volumeCbm).toBeNull()

    await db.contactInquiry.delete({ where: { id: inquiry.id } })
  })

  test('never shows a rate or price', async ({ page }) => {
    await page.goto('/en/freight')

    const body = await main(page).innerText()

    // Section 12 applies to freight exactly as it applies to goods.
    expect(body).not.toMatch(/\bSAR\s*\d/)
    expect(body).not.toMatch(/\bUSD\s*\d/)
    expect(body).not.toMatch(/[$€£]\s*\d/)
    await expect(main(page).getByText(/no rate is shown online/i)).toBeVisible()
  })

  test('blocks submission without a destination', async ({ page }) => {
    await page.goto('/en/freight')

    const form = page.locator('form')
    await form.getByLabel('Full name').fill('Incomplete Tester')
    await form.getByLabel('Email').fill('incomplete@example.com')
    await form.getByLabel('What is being shipped').fill('Cargo with nowhere to go.')

    await form.getByRole('button', { name: /request a freight quote/i }).click()

    // The field error is announced and nothing is stored.
    await expect(mainAlert(page)).toBeVisible()
    await expect(mainStatus(page)).toHaveCount(0)
  })

  test('a filled honeypot is accepted in silence and stores nothing', async ({ page }) => {
    const cargo = `Honeypot freight ${Date.now()}`

    await page.goto('/en/freight')
    const form = await fillRequired(page, cargo)

    // Hidden from real users; a scraper does not respect CSS.
    await form.locator('#freight-website-hp').evaluate((element) => {
      const input = element as HTMLInputElement
      const setValue = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      setValue?.call(input, 'http://spam.example')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await form.getByRole('button', { name: /request a freight quote/i }).click()

    // Looks exactly like success, but the sentinel reference gives it away and
    // nothing reaches the database.
    const status = mainStatus(page)
    await expect(status).toBeVisible({ timeout: 20_000 })
    await expect(status).toContainText('GLEX-INQ-0000-000000')

    expect(await db.contactInquiry.count({ where: { message: cargo } })).toBe(0)
  })
})
