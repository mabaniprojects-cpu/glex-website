import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword, mainRegion } from './helpers'

/**
 * The defining constraint of the supplier portal: a supplier must see ONLY the
 * sourcing opportunities assigned to them, and never the requesting client's
 * identity.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

const DEMO_PASSWORD = demoPassword()

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/en/login')
  const form = page.locator('form')
  await form.getByLabel('Business email').fill(email)
  await form.getByLabel('Password').fill(DEMO_PASSWORD)
  await form.getByRole('button', { name: /^log in$/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
}

const SUPPLIER_ROUTES = [
  '/en/supplier',
  '/en/supplier/opportunities',
  '/en/supplier/products',
  '/en/supplier/security',
]

test.describe('Supplier portal access control', () => {
  test('redirects a signed-out visitor away from every supplier route', async ({ page }) => {
    for (const route of SUPPLIER_ROUTES) {
      await page.goto(route)
      await page.waitForURL(/\/login/, { timeout: 30_000 })
      expect(page.url(), `${route} must require sign-in`).toContain('/login')
    }
  })

  test('a client is redirected to their own dashboard', async ({ page }) => {
    await signIn(page, 'client@glex.demo')

    await page.goto('/en/supplier')
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
    expect(page.url()).toContain('/dashboard')
  })

  test('the client dashboard bounces a supplier to the supplier portal', async ({ page }) => {
    await signIn(page, 'supplier@glex.demo')

    await page.goto('/en/dashboard')
    await page.waitForURL(/\/supplier/, { timeout: 30_000 })
    expect(page.url()).toContain('/supplier')
  })
})

test.describe('Supplier portal', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'supplier@glex.demo')
  })

  test('shows the profile with a completion indicator', async ({ page }) => {
    await page.goto('/en/supplier')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Demo Saudi Materials Factory'
    )
    await expect(mainRegion(page).getByRole('progressbar')).toBeVisible()
  })

  test('lists the supplier’s own catalogue', async ({ page }) => {
    await page.goto('/en/supplier/products')

    // The seeded products belong to the approved supplier.
    await expect(mainRegion(page).getByText(/portland cement/i).first()).toBeVisible()
  })

})

/**
 * Serial: both tests read and write the same supplier's opportunity set, so in
 * parallel the empty-state assertion intermittently observes the row the
 * isolation test is mid-way through creating.
 */
test.describe.serial('Sourcing opportunities', () => {
  test('shows an empty state when none is assigned', async ({ page }) => {
    await signIn(page, 'supplier@glex.demo')
    await page.goto('/en/supplier/opportunities')

    await expect(
      mainRegion(page).getByText('You have no assigned opportunities at the moment.')
    ).toBeVisible()
  })

  test('a supplier sees only opportunities assigned to them', async ({ page }) => {
    // Two suppliers, one opportunity each.
    const mine = await db.supplierProfile.findFirst({
      where: { legalName: 'Demo Saudi Materials Factory' },
      select: { id: true },
    })
    const theirs = await db.supplierProfile.findFirst({
      where: { legalName: 'Demo Pending Supplier Co.' },
      select: { id: true },
    })
    expect(mine && theirs, 'both seeded suppliers present').toBeTruthy()

    const mineRef = `GLEX-RFQ-7777-${String(Date.now()).slice(-6)}`
    const theirsRef = `GLEX-RFQ-7778-${String(Date.now()).slice(-6)}`

    const mineRfq = await db.rFQ.create({
      data: {
        reference: mineRef,
        status: 'SUPPLIER_SOURCING',
        destinationCountry: 'Kuwait',
        projectName: 'Assigned To Me Project',
        items: { create: [{ name: 'My Assigned Material', quantity: 10, unit: 'TON', sortOrder: 0 }] },
      },
      select: { id: true },
    })

    const theirsRfq = await db.rFQ.create({
      data: {
        reference: theirsRef,
        status: 'SUPPLIER_SOURCING',
        destinationCountry: 'Egypt',
        projectName: 'Other Supplier Confidential Project',
        items: {
          create: [{ name: 'Other Supplier Secret Material', quantity: 7, unit: 'TON', sortOrder: 0 }],
        },
      },
      select: { id: true },
    })

    await db.sourcingOpportunity.create({
      data: { rfqId: mineRfq.id, supplierId: mine!.id, message: 'Please quote this line.' },
    })
    await db.sourcingOpportunity.create({
      data: { rfqId: theirsRfq.id, supplierId: theirs!.id, message: 'Confidential to the other supplier.' },
    })

    await signIn(page, 'supplier@glex.demo')
    await page.goto('/en/supplier/opportunities')

    const main = mainRegion(page)
    // Sees its own.
    await expect(main.getByText(mineRef)).toBeVisible()
    await expect(main.getByText('My Assigned Material')).toBeVisible()

    // Must not see the other supplier's, at all.
    const body = await page.locator('body').innerText()
    expect(body, 'other reference leaked').not.toContain(theirsRef)
    expect(body, 'other line item leaked').not.toContain('Other Supplier Secret Material')
    expect(body, 'other message leaked').not.toContain('Confidential to the other supplier')

    // The requesting client is never disclosed to a supplier.
    expect(body, 'project name leaked').not.toContain('Assigned To Me Project')

    await db.sourcingOpportunity.deleteMany({
      where: { rfqId: { in: [mineRfq.id, theirsRfq.id] } },
    })
    await db.rFQ.deleteMany({ where: { id: { in: [mineRfq.id, theirsRfq.id] } } })
  })
})
