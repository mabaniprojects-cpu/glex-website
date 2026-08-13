import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword } from './helpers'

/**
 * The two-way RFQ conversation and quotation workflow.
 *
 * The assertions that matter are the boundaries, not the happy path: an
 * internal staff note must never reach the client, a client must not be able to
 * post on someone else's request, and a quotation decision must be answerable
 * only once.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

const DEMO_PASSWORD = demoPassword()

async function signIn(page: Page, email: string) {
  await page.goto('/en/login')
  const form = page.locator('form')
  await form.getByLabel('Business email').fill(email)
  await form.getByLabel('Password').fill(DEMO_PASSWORD)
  await form.getByRole('button', { name: /^log in$/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
}

/** An RFQ owned by the seeded demo client. */
async function createClientRfq(suffix: string) {
  const client = await db.user.findUniqueOrThrow({
    where: { email: 'client@glex.demo' },
    select: { id: true, organizationId: true },
  })

  const reference = `GLEX-RFQ-7777-${String(Date.now()).slice(-6)}`

  const rfq = await db.rFQ.create({
    data: {
      reference,
      status: 'UNDER_REVIEW',
      destinationCountry: 'Kuwait',
      createdById: client.id,
      organizationId: client.organizationId,
      projectName: `E2E Conversation ${suffix}`,
      items: {
        create: [{ name: 'Conversation test item', quantity: 10, unit: 'PIECE', sortOrder: 0 }],
      },
    },
    select: { id: true, reference: true },
  })

  return rfq
}

async function cleanUp(rfqId: string) {
  await db.auditLog.deleteMany({ where: { entityId: rfqId } })
  await db.rFQ.delete({ where: { id: rfqId } })
}

const main = (page: Page) => page.locator('#main-content')

test.describe('RFQ conversation', () => {
  test('a client can reply and staff see it', async ({ page }) => {
    const rfq = await createClientRfq('reply')
    const body = `Client question ${Date.now()}`

    await signIn(page, 'client@glex.demo')
    await page.goto(`/en/dashboard/rfqs/${rfq.reference}`)

    // `getByLabel` is ambiguous here: the section is `aria-labelledby` the same
    // "Messages" heading, so it matches the region as well as the textarea.
    await main(page).getByRole('textbox', { name: 'Messages' }).fill(body)
    await main(page).getByRole('button', { name: 'Send' }).click()

    await expect
      .poll(async () => db.rFQMessage.count({ where: { rfqId: rfq.id, body } }), {
        timeout: 20_000,
      })
      .toBe(1)

    const stored = await db.rFQMessage.findFirstOrThrow({ where: { rfqId: rfq.id, body } })
    // A client message is always client-visible; `isInternal` is never taken
    // from the payload.
    expect(stored.isInternal).toBe(false)

    const activity = await db.rFQActivity.findFirst({
      where: { rfqId: rfq.id, action: 'CLIENT_REPLIED' },
    })
    expect(activity, 'the reply is recorded in the activity trail').not.toBeNull()

    await cleanUp(rfq.id)
  })

  test('an internal staff note never reaches the client', async ({ page }) => {
    const rfq = await createClientRfq('internal')
    const secret = `INTERNAL ONLY ${Date.now()}`

    await db.rFQMessage.create({
      data: { rfqId: rfq.id, body: secret, isInternal: true },
    })

    await signIn(page, 'client@glex.demo')
    await page.goto(`/en/dashboard/rfqs/${rfq.reference}`)

    // Not merely hidden by CSS — the query filters it, so it is absent from the
    // markup and the RSC payload alike.
    const html = await page.content()
    expect(html).not.toContain(secret)

    await cleanUp(rfq.id)
  })

  test('a client cannot post on another organization’s request', async ({ page }) => {
    // Owned by nobody the demo client belongs to.
    const orphan = await db.rFQ.create({
      data: {
        reference: `GLEX-RFQ-7778-${String(Date.now()).slice(-6)}`,
        status: 'UNDER_REVIEW',
        destinationCountry: 'Bahrain',
        items: { create: [{ name: 'Other org item', quantity: 1, unit: 'PIECE', sortOrder: 0 }] },
      },
      select: { id: true, reference: true },
    })

    await signIn(page, 'client@glex.demo')
    await page.goto(`/en/dashboard/rfqs/${orphan.reference}`)

    // A plain 404 — the reference must not be confirmed to exist.
    await expect(page.getByText('Page not found')).toBeVisible()

    expect(
      await db.rFQMessage.count({ where: { rfqId: orphan.id } }),
      'nothing was written to a request the client does not own'
    ).toBe(0)

    await cleanUp(orphan.id)
  })

  test('staff issue a quotation and the client can accept it', async ({ page, browser }) => {
    const rfq = await createClientRfq('quote')

    // --- Staff issue the offer ---
    await signIn(page, 'admin@glex.demo')
    await page.goto(`/en/admin/rfqs/${rfq.reference}`)

    const issueForm = page.locator('form').filter({ hasText: 'Issue a quotation' })
    await issueForm.getByRole('button', { name: 'Issue a quotation' }).click()

    await expect
      .poll(async () => db.quotation.count({ where: { rfqId: rfq.id } }), { timeout: 20_000 })
      .toBe(1)

    const quotation = await db.quotation.findFirstOrThrow({ where: { rfqId: rfq.id } })
    expect(quotation.reference).toMatch(/^GLEX-QUO-\d{4}-\d{6}$/)
    expect(quotation.sentAt, 'issuing and sending are the same act').not.toBeNull()
    expect(quotation.version).toBe(1)

    const audit = await db.auditLog.findFirst({
      where: { entityType: 'Quotation', entityId: quotation.id },
    })
    expect(audit, 'issuing a commercial offer is audited').not.toBeNull()

    // --- The client accepts it ---
    const clientContext = await browser.newContext()
    const clientPage = await clientContext.newPage()
    await signIn(clientPage, 'client@glex.demo')
    await clientPage.goto(`/en/dashboard/rfqs/${rfq.reference}`)

    await expect(main(clientPage).getByText(quotation.reference)).toBeVisible()
    await main(clientPage).getByRole('button', { name: 'Accept quotation' }).click()

    await expect
      .poll(
        async () =>
          (await db.quotation.findUnique({
            where: { id: quotation.id },
            select: { acceptedAt: true },
          }))?.acceptedAt !== null,
        { timeout: 20_000 }
      )
      .toBe(true)

    // Accepting the offer moves the request, not just the quotation.
    const updated = await db.rFQ.findUniqueOrThrow({
      where: { id: rfq.id },
      select: { status: true },
    })
    expect(updated.status).toBe('ACCEPTED')

    await clientContext.close()
    await db.auditLog.deleteMany({ where: { entityId: quotation.id } })
    await cleanUp(rfq.id)
  })

  test('a quotation cannot be answered twice', async ({ page }) => {
    const rfq = await createClientRfq('twice')

    const quotation = await db.quotation.create({
      data: {
        rfqId: rfq.id,
        reference: `GLEX-QUO-7777-${String(Date.now()).slice(-6)}`,
        version: 1,
        sentAt: new Date(),
        // Already accepted before the client opens the page.
        acceptedAt: new Date(),
      },
      select: { id: true, reference: true },
    })

    await signIn(page, 'client@glex.demo')
    await page.goto(`/en/dashboard/rfqs/${rfq.reference}`)

    // The outcome is shown instead of controls that would overwrite it.
    await expect(main(page).getByText('Accepted')).toBeVisible()
    await expect(main(page).getByRole('button', { name: 'Accept quotation' })).toHaveCount(0)
    await expect(main(page).getByRole('button', { name: 'Decline quotation' })).toHaveCount(0)

    await db.quotation.delete({ where: { id: quotation.id } })
    await cleanUp(rfq.id)
  })

  test('a closed request takes no further replies', async ({ page }) => {
    // Suffix avoids the word "closed", which would otherwise also match the
    // project name printed on the page.
    const rfq = await createClientRfq('cancelled')
    await db.rFQ.update({ where: { id: rfq.id }, data: { status: 'CANCELLED' } })

    await signIn(page, 'client@glex.demo')
    await page.goto(`/en/dashboard/rfqs/${rfq.reference}`)

    // No form at all, rather than one the server would refuse.
    await expect(main(page).getByRole('button', { name: 'Send' })).toHaveCount(0)
    await expect(
      main(page).getByText('This request is closed and can no longer be updated.')
    ).toBeVisible()

    await cleanUp(rfq.id)
  })
})
