import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/**
 * Support tickets.
 *
 * These already existed before there was anywhere to read them: the GLEX
 * Assistant's human handoff creates a `GLEX-TKT-…` reference. So the first
 * thing worth proving is that a handoff ticket is now reachable by the person
 * who raised it — and that nobody else can reach it.
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

/**
 * Reference counter, scoped to this worker.
 *
 * A millisecond-derived suffix is not unique enough: both browser projects run
 * this spec, and two workers can land in the same millisecond and collide on
 * the `reference` unique constraint.
 */
let ticketSeq = 0

async function createTicket(ownerEmail: string, suffix: string) {
  const owner = await db.user.findUniqueOrThrow({
    where: { email: ownerEmail },
    select: { id: true },
  })

  const slot = String(test.info().workerIndex).padStart(2, '0')
  const seq = String(ticketSeq++).padStart(4, '0')

  return db.supportTicket.create({
    data: {
      reference: `GLEX-TKT-7777-${slot}${seq}`,
      subject: `E2E Ticket ${suffix} ${Date.now()}`,
      requesterId: owner.id,
      messages: {
        create: [{ body: 'Original question from the requester.', isInternal: false }],
      },
    },
    select: { id: true, reference: true, subject: true },
  })
}

async function cleanUp(id: string) {
  await db.auditLog.deleteMany({ where: { entityId: id } })
  await db.supportTicket.delete({ where: { id } })
}

const main = (page: Page) => page.locator('#main-content')

test.describe('Support tickets', () => {
  test('a requester can read and answer their own ticket', async ({ page }) => {
    const ticket = await createTicket('client@glex.demo', 'reply')
    const body = `Client follow-up ${Date.now()}`

    await signIn(page, 'client@glex.demo')
    await page.goto(`/en/dashboard/support/${ticket.reference}`)

    await expect(main(page).getByRole('heading', { level: 1 })).toContainText(ticket.subject)

    await main(page).getByLabel('Add to this ticket').fill(body)
    await main(page).getByRole('button', { name: 'Send' }).click()

    await expect
      .poll(async () => db.supportMessage.count({ where: { ticketId: ticket.id, body } }), {
        timeout: 20_000,
      })
      .toBe(1)

    const stored = await db.supportMessage.findFirstOrThrow({
      where: { ticketId: ticket.id, body },
    })
    // A requester's message is always requester-visible; `isInternal` is never
    // taken from the payload.
    expect(stored.isInternal).toBe(false)

    await cleanUp(ticket.id)
  })

  test('an internal note never reaches the requester', async ({ page }) => {
    const ticket = await createTicket('client@glex.demo', 'internal')
    const secret = `INTERNAL TICKET NOTE ${Date.now()}`

    await db.supportMessage.create({
      data: { ticketId: ticket.id, body: secret, isInternal: true },
    })

    await signIn(page, 'client@glex.demo')
    await page.goto(`/en/dashboard/support/${ticket.reference}`)

    // Filtered by the query, so it is absent from the markup and the RSC
    // payload alike — not merely hidden.
    const html = await page.content()
    expect(html).not.toContain(secret)

    await cleanUp(ticket.id)
  })

  test('a ticket belonging to someone else is a plain 404', async ({ page }) => {
    const ticket = await createTicket('supplier@glex.demo', 'other-owner')

    await signIn(page, 'client@glex.demo')
    await page.goto(`/en/dashboard/support/${ticket.reference}`)

    // The reference must not be confirmed to exist.
    await expect(page.getByText('Page not found')).toBeVisible()

    await cleanUp(ticket.id)
  })

  test('staff can answer, and the reply reaches the requester', async ({ page, browser }) => {
    const ticket = await createTicket('client@glex.demo', 'staff-reply')
    const reply = `Staff answer ${Date.now()}`

    await signIn(page, 'admin@glex.demo')
    await page.goto(`/en/admin/tickets/${ticket.reference}`)

    const replyForm = page.locator('form').filter({ hasText: 'Who can see this message' })
    // Visibility defaults to internal, so sending outward is deliberate.
    await replyForm.getByLabel('Who can see this message').selectOption('client')
    await replyForm.getByLabel('Add to this ticket').fill(reply)
    await replyForm.getByRole('button', { name: 'Send to the requester' }).click()

    await expect
      .poll(async () => db.supportMessage.count({ where: { ticketId: ticket.id, body: reply } }), {
        timeout: 20_000,
      })
      .toBe(1)

    // And the requester actually sees it.
    const clientContext = await browser.newContext()
    const clientPage = await clientContext.newPage()
    await signIn(clientPage, 'client@glex.demo')
    await clientPage.goto(`/en/dashboard/support/${ticket.reference}`)
    await expect(main(clientPage).getByText(reply)).toBeVisible()
    await clientContext.close()

    await cleanUp(ticket.id)
  })

  test('a status change is stored and audited', async ({ page }) => {
    const ticket = await createTicket('client@glex.demo', 'status')

    await signIn(page, 'admin@glex.demo')
    await page.goto(`/en/admin/tickets/${ticket.reference}`)

    await page.getByLabel('Status').selectOption('RESOLVED')
    await page.getByRole('button', { name: 'Update ticket' }).click()

    await expect
      .poll(
        async () =>
          (await db.supportTicket.findUnique({
            where: { id: ticket.id },
            select: { status: true },
          }))?.status,
        { timeout: 20_000 }
      )
      .toBe('RESOLVED')

    const audit = await db.auditLog.findFirst({
      where: { entityType: 'SupportTicket', entityId: ticket.id, action: 'ticket.updated' },
    })
    expect(audit, 'every ticket change is audited').not.toBeNull()

    await cleanUp(ticket.id)
  })

  test('a resolved ticket takes no further replies', async ({ page }) => {
    const ticket = await createTicket('client@glex.demo', 'settled')
    await db.supportTicket.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } })

    await signIn(page, 'client@glex.demo')
    await page.goto(`/en/dashboard/support/${ticket.reference}`)

    // No form at all, rather than one the server would refuse.
    await expect(main(page).getByRole('button', { name: 'Send' })).toHaveCount(0)
    await expect(
      main(page).getByText('This ticket is closed and can no longer be updated.')
    ).toBeVisible()

    await cleanUp(ticket.id)
  })
})
