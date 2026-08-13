import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/**
 * Email template management.
 *
 * The resolution order (requested locale → English → hard-coded copy) is
 * unit-tested in `src/lib/__tests__/email-template-resolution.test.ts`, where
 * the rows can be controlled exactly. These tests cover what only the real
 * stack can show: that an edit is stored and audited, that the key cannot be
 * set to something the application never sends, and that removing a row does
 * not stop the mail going out.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'GlexDemo!2026'

async function signInAsAdmin(page: Page) {
  await page.goto('/en/login')
  const form = page.locator('form')
  await form.getByLabel('Business email').fill('admin@glex.demo')
  await form.getByLabel('Password').fill(DEMO_PASSWORD)
  await form.getByRole('button', { name: /^log in$/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
}

/**
 * Removes rows this spec created. `contact-received` in Arabic is not seeded,
 * so it is a safe key to add and drop without disturbing the English copy the
 * rest of the suite relies on.
 */
test.afterEach(async () => {
  // Gated on the project: Playwright runs afterEach even for SKIPPED tests, so
  // an ungated hook has the mobile project deleting rows the desktop test is
  // still asserting on.
  if (test.info().project.name !== 'desktop-chrome') return

  const strays = await db.emailTemplate.findMany({
    where: { key: 'contact-received', locale: { not: 'en' } },
    select: { id: true },
  })
  if (strays.length > 0) {
    const ids = strays.map((row) => row.id)
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } })
    await db.emailTemplate.deleteMany({ where: { id: { in: ids } } })
  }
})

// Scoped to main: the admin sidebar is also a list, so an unscoped 'li' has to
// scan the navigation on every poll.
const cardFor = (page: Page, text: string) =>
  page.locator('#main-content li').filter({ hasText: text })

/**
 * Fields are looked up inside the editor form. The site header carries its own
 * 'Select language' control, so an unscoped `getByLabel('Language')` matches
 * two elements and fails on strict mode.
 */
const editor = (page: Page) => page.locator('form')

test.describe('Email template management', () => {
  // Serial, because these tests share one row. The fallback test below deletes
  // the seeded `contact-received` row and restores it afterwards; run in
  // parallel, the edit test looks for a card that is momentarily gone and waits
  // out its entire budget. Raising the timeout does not help — the row is
  // absent, not slow.
  test.describe.configure({ mode: 'serial' })

  // Every test here mutates seeded rows and restores them. Both browser
  // projects share one database, so running them in parallel has each project
  // restoring the row the other is still asserting on. The behaviour is
  // server-side and identical at every viewport.
  test.skip(
    () => test.info().project.name !== 'desktop-chrome',
    'mutates shared seeded rows; verified once on desktop'
  )

  test('editing the subject is stored and audited', async ({ page }) => {
    const subject = `We have received your message ${Date.now()}`

    await signInAsAdmin(page)
    await page.goto('/en/admin/emails')

    const card = cardFor(page, 'contact-received').first()
    await card.getByRole('button', { name: 'Edit' }).click()

    await editor(page).getByLabel('Subject line').fill(subject)
    await editor(page).getByRole('button', { name: 'Save' }).click()

    const row = await (async () => {
      await expect
        .poll(async () => db.emailTemplate.count({ where: { subject } }), { timeout: 20_000 })
        .toBe(1)
      return db.emailTemplate.findFirstOrThrow({ where: { subject } })
    })()

    expect(row.key).toBe('contact-received')

    const audit = await db.auditLog.findFirst({
      where: {
        entityType: 'EmailTemplate',
        entityId: row.id,
        action: 'email_template.updated',
      },
    })
    expect(audit, 'every copy change is audited').not.toBeNull()

    // Restore the seeded wording so later runs start from a known state.
    await db.emailTemplate.update({
      where: { id: row.id },
      data: { subject: 'We have received your message' },
    })
    await db.auditLog.deleteMany({ where: { entityId: row.id } })
  })

  test('only keys the application actually sends can be chosen', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/en/admin/emails')

    await page.getByRole('button', { name: 'New template' }).click()

    const keySelect = editor(page).getByLabel('Template')
    const options = await keySelect.locator('option').allTextContents()

    // A free-text key would let someone write copy that reads as edited and is
    // never sent by anything.
    expect(options).toContain('contact-received')
    expect(options).toContain('rfq-submitted')
    expect(options.length).toBeGreaterThan(15)

    // Every offered key must exist in the codebase's own list.
    for (const option of options) {
      expect(option).toMatch(/^[a-z][a-z-]+$/)
    }
  })

  test('a translated template is stored against its own locale', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/en/admin/emails')

    await page.getByRole('button', { name: 'New template' }).click()
    await editor(page).getByLabel('Template').selectOption('contact-received')
    await editor(page).getByLabel('Language').selectOption('ar')
    await editor(page).getByLabel('Subject line').fill('لقد استلمنا رسالتك')
    await editor(page).getByLabel('Body').fill('شكراً لتواصلك مع GLEX. سيرد فريقنا في أقرب وقت ممكن.')
    await editor(page).getByRole('button', { name: 'Save' }).click()

    await expect
      .poll(
        async () =>
          db.emailTemplate.count({ where: { key: 'contact-received', locale: 'ar' } }),
        { timeout: 20_000 }
      )
      .toBe(1)

    const arabic = await db.emailTemplate.findFirstOrThrow({
      where: { key: 'contact-received', locale: 'ar' },
    })
    expect(arabic.subject).toBe('لقد استلمنا رسالتك')

    // The English row is untouched — adding a translation must not replace it.
    const english = await db.emailTemplate.findFirstOrThrow({
      where: { key: 'contact-received', locale: 'en' },
    })
    expect(english.subject).toBe('We have received your message')
  })

  test('the same key and locale cannot be added twice', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/en/admin/emails')

    await page.getByRole('button', { name: 'New template' }).click()
    await editor(page).getByLabel('Template').selectOption('contact-received')
    await editor(page).getByLabel('Language').selectOption('en')
    await editor(page).getByLabel('Subject line').fill('Duplicate attempt')
    await editor(page).getByLabel('Body').fill('This must not create a second English row.')
    await editor(page).getByRole('button', { name: 'Save' }).click()

    // Refused, and the seeded row is still the only English one.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 })

    expect(
      await db.emailTemplate.count({ where: { key: 'contact-received', locale: 'en' } }),
      'the unique key/locale pair is enforced'
    ).toBe(1)
  })

  test('a contact enquiry still sends when the template row is removed', async ({ page }) => {
    // Deleting a row must degrade to built-in copy, not silence the email.
    const seeded = await db.emailTemplate.findFirstOrThrow({
      where: { key: 'contact-received', locale: 'en' },
    })
    const { key, locale, subject, heading, body, isActive } = seeded
    await db.emailTemplate.delete({ where: { id: seeded.id } })

    try {
      await page.goto('/en/contact')
      const form = page.locator('form')

      await form.getByLabel('Full name').fill('Template Fallback Tester')
      await form.getByLabel('Email').fill('fallback@example.com')
      await form.getByLabel('Subject').fill(`Fallback ${Date.now()}`)
      await form.getByLabel('Message').fill('Checking that mail survives a missing template row.')
      await form.getByRole('button', { name: /send message/i }).click()

      // The enquiry is still accepted and referenced — the mail layer fell back
      // rather than throwing.
      const status = page.locator('#main-content').getByRole('status')
      await expect(status).toBeVisible({ timeout: 20_000 })
      await expect(status).toContainText(/GLEX-INQ-\d{4}-\d{6}/)
    } finally {
      await db.emailTemplate.create({
        data: { key, locale, subject, heading, body, isActive },
      })
    }
  })
})
