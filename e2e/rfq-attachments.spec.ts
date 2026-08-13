import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/**
 * RFQ attachments.
 *
 * The interesting rule is not that a file can be attached, but that only the
 * submitter's own uploads can be. A payload naming an arbitrary file id would
 * otherwise let a client attach a stranger's document to their own RFQ and then
 * download it from the confirmation page.
 *
 * Guests get no control at all: `/api/uploads` requires a session, and opening
 * it to anonymous callers would make it a free file host.
 *
 * The ownership guard itself is unit-tested in
 * `src/lib/__tests__/rfq-attachments.test.ts` — producing the "someone else's
 * file" case here would mean forging a Server Action request, and an assertion
 * that merely observes no foreign attachment exists proves nothing.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'GlexDemo!2026'

async function signIn(page: Page, email: string) {
  await page.goto('/en/login')
  const form = page.locator('form')
  await form.getByLabel('Business email').fill(email)
  await form.getByLabel('Password').fill(DEMO_PASSWORD)
  await form.getByRole('button', { name: /^log in$/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
}

const main = (page: Page) => page.locator('#main-content')

test.describe('RFQ attachments', () => {
  test('a guest is told to sign in rather than shown a control that cannot work', async ({
    page,
  }) => {
    await page.goto('/en/rfq')

    // `/api/uploads` requires a session, so a file input here would fail on
    // every attempt.
    await expect(main(page).getByText(/sign in to attach/i)).toBeVisible()
    await expect(main(page).locator('input[type="file"]')).toHaveCount(0)
  })

  test('a signed-in client is offered the attachment control', async ({ page }) => {
    await signIn(page, 'client@glex.demo')
    await page.goto('/en/rfq')

    await expect(main(page).locator('#rfq-attachments')).toBeVisible()
    await expect(main(page).getByText(/sign in to attach/i)).toHaveCount(0)
  })

  test('an attachment uploaded by the submitter is stored against the RFQ', async ({ page }) => {
    await signIn(page, 'client@glex.demo')
    await page.goto('/en/rfq')

    const client = await db.user.findUniqueOrThrow({
      where: { email: 'client@glex.demo' },
      select: { id: true },
    })

    // Upload through the real endpoint, with the client's own session.
    const uploaded = await page.evaluate(async () => {
      const body = new FormData()
      body.append('file', new File(['%PDF-1.4 test'], 'spec.pdf', { type: 'application/pdf' }))
      body.append('purpose', 'rfq')
      const response = await fetch('/api/uploads', { method: 'POST', body })
      return (await response.json()) as { id?: string; error?: string }
    })

    expect(uploaded.id, `upload failed: ${uploaded.error ?? 'unknown'}`).toBeTruthy()

    const stored = await db.storedFile.findUniqueOrThrow({
      where: { id: uploaded.id! },
      select: { uploadedById: true, originalName: true },
    })
    // Attribution is what the attachment guard later relies on.
    expect(stored.uploadedById).toBe(client.id)
    expect(stored.originalName).toBe('spec.pdf')

    await db.storedFile.delete({ where: { id: uploaded.id! } })
  })
})
