import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { mainRegion } from './helpers'

/**
 * The dashboard is the first authenticated surface, so these tests care as much
 * about what a user CANNOT see as what they can.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'GlexDemo!2026'

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/en/login')
  const form = page.locator('form')
  await form.getByLabel('Business email').fill(email)
  await form.getByLabel('Password').fill(password)
  await form.getByRole('button', { name: /^log in$/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
}

test.describe('Dashboard access control', () => {
  test('redirects a signed-out visitor to the login page', async ({ page }) => {
    await page.goto('/en/dashboard')

    await page.waitForURL(/\/login/, { timeout: 30_000 })
    expect(page.url()).toContain('/login')
    // The intended destination is preserved for after sign-in.
    expect(page.url()).toContain('callbackUrl')
  })

  test('protects every dashboard route', async ({ page }) => {
    for (const route of [
      '/en/dashboard/rfqs',
      '/en/dashboard/shipments',
      '/en/dashboard/saved',
      '/en/dashboard/notifications',
      '/en/dashboard/security',
    ]) {
      await page.goto(route)
      await page.waitForURL(/\/login/, { timeout: 30_000 })
      expect(page.url(), `${route} must require sign-in`).toContain('/login')
    }
  })
})

test.describe('Client dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'client@glex.demo', DEMO_PASSWORD)
  })

  test('shows the overview with summary cards', async ({ page }) => {
    await page.goto('/en/dashboard')

    const main = mainRegion(page)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/welcome/i)
    await expect(main.getByText('Active RFQs')).toBeVisible()
    await expect(main.getByText('Active shipments')).toBeVisible()
  })

  /**
   * The list renders a desktop table AND a mobile card list, with CSS hiding
   * one. Both are in the DOM, so an unscoped locator matches twice and trips
   * strict mode. Filtering to the visible copy keeps the assertion honest in
   * both projects — scoping to `table` would only ever pass on desktop.
   */
  test('lists the organization’s own RFQs', async ({ page }) => {
    await page.goto('/en/dashboard/rfqs')

    // The seeded RFQ belongs to the demo client organization.
    const row = mainRegion(page)
      .getByRole('link', { name: 'GLEX-RFQ-2026-000001' })
      .filter({ visible: true })
    await expect(row).toBeVisible()
  })

  test('opens an RFQ it owns and shows the activity history', async ({ page }) => {
    await page.goto('/en/dashboard/rfqs/GLEX-RFQ-2026-000001')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('GLEX-RFQ-2026-000001')

    const main = mainRegion(page)
    await expect(main.getByRole('heading', { name: 'Items' })).toBeVisible()
    await expect(main.getByRole('heading', { name: 'Activity' })).toBeVisible()
    // The status appears in the header badge and again in the activity list.
    await expect(main.getByText('Under review').first()).toBeVisible()
  })

  test('lists the organization’s shipments', async ({ page }) => {
    await page.goto('/en/dashboard/shipments')

    const main = mainRegion(page)
    await expect(main.getByText('GLEX-SHP-2026-000001')).toBeVisible()
    // Seeded records must stay labelled as demonstration data.
    await expect(main.getByText('Demo')).toBeVisible()
  })

  test('renders the security page without leaking the raw user id', async ({ page }) => {
    await page.goto('/en/dashboard/security')

    const main = mainRegion(page)
    await expect(main.getByText('client@glex.demo')).toBeVisible()

    const body = await main.innerText()
    // The id is masked; a full UUID must never appear.
    expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })
})

test.describe('Organization data isolation', () => {
  test('a client cannot open another organization’s RFQ', async ({ page }) => {
    // Create an RFQ owned by a different organization.
    const otherOrg = await db.organization.upsert({
      where: { slug: 'isolation-test-org' },
      create: { slug: 'isolation-test-org', name: 'Isolation Test Co', type: 'CLIENT' },
      update: {},
    })

    const reference = `GLEX-RFQ-9999-${String(Date.now()).slice(-6)}`
    await db.rFQ.create({
      data: {
        reference,
        status: 'SUBMITTED',
        organizationId: otherOrg.id,
        destinationCountry: 'Kuwait',
        projectName: 'Other Org Confidential Project',
        items: {
          create: [{ name: 'Other Org Secret Material', quantity: 1, unit: 'PIECE', sortOrder: 0 }],
        },
      },
    })

    await signIn(page, 'client@glex.demo', DEMO_PASSWORD)
    await page.goto(`/en/dashboard/rfqs/${reference}`)

    // Must render a plain not-found — never the record, and never a message
    // that would confirm the reference exists.
    await expect(page.getByText('Page not found')).toBeVisible()

    const body = await page.locator('body').innerText()
    expect(body).not.toContain('Other Org Confidential Project')
    expect(body).not.toContain('Other Org Secret Material')

    // It must not appear in the list either.
    await page.goto('/en/dashboard/rfqs')
    await expect(mainRegion(page).getByText(reference)).toHaveCount(0)

    await db.rFQ.deleteMany({ where: { reference } })
  })
})
