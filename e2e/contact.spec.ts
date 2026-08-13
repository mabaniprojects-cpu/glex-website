import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { mainAlert, mainStatus } from './helpers'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

/**
 * The contact form must persist to PostgreSQL, not merely appear to succeed.
 * The assertion is the generated GLEX-INQ reference, which is produced inside
 * the same database transaction that writes the row.
 *
 * NOTE on locators: required fields render a visual "*" inside the <label>, so
 * the accessible name is "Email*", not "Email". Substring matching (the
 * default) is therefore required — do not add `{ exact: true }`.
 */
test.describe('Contact form', () => {
  test('submits and returns a persisted inquiry reference', async ({ page }) => {
    await page.goto('/en/contact')

    const form = page.locator('form')

    await form.getByLabel('Full name').fill('Playwright Tester')
    await form.getByLabel('Email').fill('e2e@example.com')
    await form.getByLabel('Subject').fill(`E2E ${Date.now()}`)
    await form
      .getByLabel('Message')
      .fill('Automated end-to-end check that this submission reaches the database.')

    // Consent defaults to checked; assert rather than assume.
    await expect(form.getByRole('checkbox')).toBeChecked()

    await form.getByRole('button', { name: /send message/i }).click()

    const status = mainStatus(page)
    await expect(status).toBeVisible({ timeout: 20_000 })
    await expect(status).toContainText(/GLEX-INQ-\d{4}-\d{6}/)
  })

  test('a filled honeypot is accepted in silence and stores nothing', async ({ page }) => {
    await page.goto('/en/contact')

    const form = page.locator('form')
    const subject = `Honeypot ${Date.now()}`

    await form.getByLabel('Full name').fill('Spam Bot')
    await form.getByLabel('Email').fill('bot@example.com')
    await form.getByLabel('Subject').fill(subject)
    await form.getByLabel('Message').fill('Automated submission that must never be stored.')

    // The trap: hidden from real users, irresistible to naive scrapers.
    // `fill()` is not usable here — the field is `display:none`, so Playwright
    // waits for a visibility that never comes. A scraper does not respect CSS
    // either, so the value is set the way one actually would, with an `input`
    // event so React Hook Form registers it.
    await form.locator('#website-hp').evaluate((element) => {
      const input = element as HTMLInputElement
      const setValue = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      setValue?.call(input, 'http://spam.example')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await form.getByRole('button', { name: /send message/i }).click()

    // It must look exactly like success. A validation error naming this field
    // would tell the bot which one is the trap.
    const status = mainStatus(page)
    await expect(status).toBeVisible({ timeout: 20_000 })
    await expect(mainAlert(page)).toHaveCount(0)

    // ...but nothing may reach the database, and the sentinel reference is a
    // giveaway that no real record was created.
    await expect(status).toContainText('GLEX-INQ-0000-000000')

    const stored = await db.contactInquiry.count({ where: { subject } })
    expect(stored, 'honeypot submissions are dropped, not stored').toBe(0)
  })

  test('rejects an invalid email without submitting', async ({ page }) => {
    await page.goto('/en/contact')

    const form = page.locator('form')

    await form.getByLabel('Full name').fill('Invalid Email Tester')
    await form.getByLabel('Email').fill('not-an-email')
    await form.getByLabel('Subject').fill('Should not submit')
    await form.getByLabel('Message').fill('This submission must be blocked by validation.')

    await form.getByRole('button', { name: /send message/i }).click()

    // The success panel must not appear, and the field error must be announced.
    await expect(mainAlert(page)).toBeVisible()
    await expect(mainStatus(page)).toHaveCount(0)
  })

  test('shows the Jeddah office details', async ({ page }) => {
    await page.goto('/en/contact')

    // Scope to main — the same address also appears in the footer.
    const main = page.locator('#main-content')
    await expect(main.getByText('King Road Tower')).toBeVisible()
    await expect(main.getByText('Ash Shati District')).toBeVisible()
    await expect(main.getByRole('link', { name: '+966 9200 31827' }).first()).toBeVisible()
  })
})
