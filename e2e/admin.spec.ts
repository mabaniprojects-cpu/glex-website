import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { mainRegion } from './helpers'

/**
 * The admin portal is the most privileged surface, so these tests weight
 * authorization and auditability above presentation.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'GlexDemo!2026'

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/en/login')
  const form = page.locator('form')
  await form.getByLabel('Business email').fill(email)
  await form.getByLabel('Password').fill(DEMO_PASSWORD)
  await form.getByRole('button', { name: /^log in$/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
}

const ADMIN_ROUTES = [
  '/en/admin',
  '/en/admin/rfqs',
  '/en/admin/suppliers',
  '/en/admin/shipments',
  '/en/admin/inquiries',
  '/en/admin/audit',
  '/en/admin/users',
  '/en/admin/organizations',
  '/en/admin/offices',
  '/en/admin/news/categories',
  '/en/admin/emails',
  '/en/admin/chats',
  '/en/admin/tickets',
]

test.describe('Admin access control', () => {
  test('redirects a signed-out visitor away from every admin route', async ({ page }) => {
    for (const route of ADMIN_ROUTES) {
      await page.goto(route)
      await page.waitForURL(/\/login/, { timeout: 30_000 })
      expect(page.url(), `${route} must require sign-in`).toContain('/login')
    }
  })

  test('a client cannot reach the admin portal', async ({ page }) => {
    await signIn(page, 'client@glex.demo')

    for (const route of ['/en/admin', '/en/admin/rfqs', '/en/admin/suppliers']) {
      await page.goto(route)

      const body = await page.locator('body').innerText()
      // Must not render admin content.
      expect(body, `${route} leaked to a client`).not.toContain('Pending supplier approvals')
      expect(body).not.toContain('Audit logs')
    }
  })

  test('a supplier cannot reach the admin portal', async ({ page }) => {
    await signIn(page, 'supplier@glex.demo')

    await page.goto('/en/admin/suppliers')
    const body = await page.locator('body').innerText()
    expect(body).not.toContain('Pending supplier approvals')
  })

  test('the client dashboard bounces staff to the admin portal', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')

    await page.goto('/en/dashboard')
    await page.waitForURL(/\/admin/, { timeout: 30_000 })
    expect(page.url()).toContain('/admin')
  })
})

test.describe('Admin portal', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
  })

  test('shows overview metrics', async ({ page }) => {
    await page.goto('/en/admin')

    const main = mainRegion(page)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Admin Portal')
    await expect(main.getByText('Pending supplier approvals')).toBeVisible()
    await expect(main.getByText('Submitted RFQs')).toBeVisible()
  })

  /**
   * Creates its own RFQ rather than pinning a seeded reference: the list is
   * ordered newest-first and capped at 30 rows, so an old reference falls off
   * page one as soon as the suite has generated enough data.
   */
  test('lists RFQs belonging to organizations the staff member is not part of', async ({
    page,
  }) => {
    const org = await db.organization.upsert({
      where: { slug: 'admin-visibility-test-org' },
      create: { slug: 'admin-visibility-test-org', name: 'Admin Visibility Co', type: 'CLIENT' },
      update: {},
    })

    const reference = `GLEX-RFQ-6666-${String(Date.now()).slice(-6)}`
    const created = await db.rFQ.create({
      data: {
        reference,
        status: 'SUBMITTED',
        organizationId: org.id,
        destinationCountry: 'Iraq',
        items: { create: [{ name: 'Visibility item', quantity: 1, unit: 'PIECE', sortOrder: 0 }] },
      },
      select: { id: true },
    })

    await page.goto('/en/admin/rfqs')

    // Staff resolve to an unrestricted scope, so another organization's RFQ
    // is visible — the opposite of the client-side isolation rule.
    //
    // The list renders both a table and a mobile card view; only one is shown
    // at a time, so filter to the visible copy rather than scoping to `table`,
    // which does not exist at the mobile breakpoint.
    const row = mainRegion(page)
      .getByRole('link', { name: reference })
      .filter({ visible: true })
    await expect(row).toBeVisible()

    await db.rFQ.delete({ where: { id: created.id } })
  })

  test('lists suppliers awaiting a decision', async ({ page }) => {
    await page.goto('/en/admin/suppliers')

    const main = mainRegion(page)
    await expect(main.getByText('Demo Pending Supplier Co.')).toBeVisible()
    await expect(main.getByText('Demo Saudi Materials Factory')).toBeVisible()
  })

  test('renders the audit log', async ({ page }) => {
    await page.goto('/en/admin/audit')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Audit logs')
  })
})

test.describe('Admin mutations are audited', () => {
  test('changing an RFQ status writes activity and audit records', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')

    // Use a dedicated RFQ so the assertion cannot be confused by other tests.
    const reference = `GLEX-RFQ-8888-${String(Date.now()).slice(-6)}`
    const created = await db.rFQ.create({
      data: {
        reference,
        status: 'SUBMITTED',
        destinationCountry: 'Jordan',
        items: { create: [{ name: 'Audit test item', quantity: 5, unit: 'PIECE', sortOrder: 0 }] },
      },
      select: { id: true },
    })

    await page.goto(`/en/admin/rfqs/${reference}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(reference)

    // Move it to "Under review" with an internal note.
    const controls = mainRegion(page)
    await controls.getByLabel('Status').selectOption('UNDER_REVIEW')
    await controls.getByLabel('Internal notes').fill('Reviewed by the E2E suite.')
    await controls.getByRole('button', { name: /^save$/i }).click()

    await expect(mainRegion(page).getByRole('status')).toBeVisible({ timeout: 20_000 })

    // --- The assertions that matter ---
    const updated = await db.rFQ.findUnique({
      where: { id: created.id },
      include: { activities: true, messages: true },
    })
    expect(updated!.status).toBe('UNDER_REVIEW')

    const statusChange = updated!.activities.find((a) => a.action === 'STATUS_CHANGED')
    expect(statusChange, 'RFQActivity recorded').toBeTruthy()
    expect(statusChange!.fromStatus).toBe('SUBMITTED')
    expect(statusChange!.toStatus).toBe('UNDER_REVIEW')

    // The internal note must be flagged so it never reaches the client.
    const note = updated!.messages.find((m) => m.body.includes('E2E suite'))
    expect(note, 'internal note stored').toBeTruthy()
    expect(note!.isInternal).toBe(true)

    const audit = await db.auditLog.findFirst({
      where: { entityType: 'RFQ', entityId: created.id, action: 'rfq.status_changed' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit, 'AuditLog written').toBeTruthy()
    expect(audit!.actorId).not.toBeNull()

    await db.rFQ.delete({ where: { id: created.id } })
  })

  test('approving a supplier promotes its users and is audited', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')

    const profile = await db.supplierProfile.findFirst({
      where: { legalName: 'Demo Pending Supplier Co.' },
      select: { id: true, status: true, organizationId: true },
    })
    expect(profile, 'seeded pending supplier present').toBeTruthy()

    await page.goto(`/en/admin/suppliers/${profile!.id}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Demo Pending Supplier')

    const main = mainRegion(page)
    await main.getByLabel('Status').selectOption('APPROVED')
    await main.getByRole('button', { name: /^save$/i }).click()
    await expect(main.getByRole('status')).toBeVisible({ timeout: 20_000 })

    const after = await db.supplierProfile.findUnique({
      where: { id: profile!.id },
      select: { status: true, reviewedById: true, reviewedAt: true },
    })
    expect(after!.status).toBe('APPROVED')
    expect(after!.reviewedById, 'reviewer recorded').not.toBeNull()
    expect(after!.reviewedAt).not.toBeNull()

    // Approval grants the supplier's users catalogue permissions.
    const users = await db.user.findMany({
      where: { organizationId: profile!.organizationId },
      select: { role: true },
    })
    expect(users.every((u) => u.role === 'APPROVED_SUPPLIER')).toBe(true)

    const audit = await db.auditLog.findFirst({
      where: { entityType: 'SupplierProfile', entityId: profile!.id, action: 'supplier.decision' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit, 'AuditLog written').toBeTruthy()

    // Restore the seeded state so the suite stays repeatable.
    await db.supplierProfile.update({
      where: { id: profile!.id },
      data: { status: 'SUBMITTED', reviewedById: null, reviewedAt: null },
    })
    await db.user.updateMany({
      where: { organizationId: profile!.organizationId },
      data: { role: 'PENDING_SUPPLIER' },
    })
  })
})

test.describe('Audit log redaction', () => {
  test('masks sensitive values at write time', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto('/en/admin/audit')

    const body = await mainRegion(page).innerText()
    // No raw email address may appear in the audit view.
    expect(body).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
  })
})

/**
 * REGRESSION GUARD.
 *
 * Admin lists were previously capped at 30 rows with no pagination UI, so any
 * record past the first page was unreachable from the portal. This creates more
 * than one page of RFQs and proves the older ones can still be opened.
 */
test.describe.serial('Admin list pagination', () => {
  const PAGE_SIZE = 25
  const prefix = `GLEX-RFQ-7777-${String(Date.now()).slice(-6)}`
  const references = Array.from(
    { length: PAGE_SIZE + 1 },
    (_, index) => `${prefix}${String(index).padStart(2, '0')}`
  )

  test.beforeAll(async () => {
    await db.rFQ.createMany({
      data: references.map((reference) => ({
        reference,
        status: 'SUBMITTED' as const,
        destinationCountry: 'Oman',
      })),
    })
  })

  test.afterAll(async () => {
    await db.rFQ.deleteMany({ where: { reference: { in: references } } })
  })

  /**
   * Asserts the invariant, not the page composition. Both Playwright projects
   * run against one database and each creates its own batch, so which records
   * land on which page is not stable — but pages must always advance and must
   * never repeat a row.
   */
  test('advances through the list without repeating or skipping rows', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto('/en/admin/rfqs')

    const main = mainRegion(page)
    const rangePattern = /Showing (\d+)[–-](\d+) of (\d+)/

    await expect(main.getByText(rangePattern)).toBeVisible()

    const firstText = await main.innerText()
    const firstRange = firstText.match(rangePattern)!
    expect(Number(firstRange[1])).toBe(1)
    expect(Number(firstRange[2])).toBe(PAGE_SIZE)

    const total = Number(firstRange[3])
    expect(total, 'the batch created above must overflow one page').toBeGreaterThan(PAGE_SIZE)

    const firstRefs = new Set(firstText.match(/GLEX-RFQ-\d{4}-\d+/g) ?? [])
    expect(firstRefs.size).toBe(PAGE_SIZE)

    await main.getByRole('link', { name: '2', exact: true }).click()
    await page.waitForURL(/[?&]page=2/)
    await expect(main.getByText(new RegExp(`Showing ${PAGE_SIZE + 1}[–-]`))).toBeVisible()

    const secondRefs = new Set(
      ((await main.innerText()).match(/GLEX-RFQ-\d{4}-\d+/g) ?? []) as string[]
    )
    expect(secondRefs.size).toBeGreaterThan(0)

    // No row may appear on both pages — that would mean records in between are
    // unreachable, which is the exact defect this guards.
    const overlap = [...secondRefs].filter((reference) => firstRefs.has(reference))
    expect(overlap, 'pages must not overlap').toEqual([])
  })

  test('a record pushed onto a later page is still reachable', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')

    // The oldest of the batch; with 25 newer siblings it cannot be on page one.
    const target = references[0]!

    // The whole scan is retried, not each page. A transient dev-server 500 on
    // one page would otherwise be read as "not on this page" and the scan would
    // walk past the page the record was actually on — reporting a pagination
    // bug that does not exist. A genuinely unreachable record still fails.
    await expect(async () => {
      let found = false
      for (let pageNumber = 1; pageNumber <= 12 && !found; pageNumber += 1) {
        const response = await page.goto(`/en/admin/rfqs?page=${pageNumber}`)
        expect(response?.status(), `page ${pageNumber} must render`).toBe(200)
        found = (await mainRegion(page).innerText()).includes(target)
      }
      expect(found, `${target} must be reachable by paging`).toBe(true)
    }).toPass({ timeout: 90_000 })
  })

  test('an out-of-range page renders an empty list rather than an error', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')

    // 1000 is the clamp ceiling in src/lib/pagination.ts.
    //
    // Retried rather than asserted once: `next dev` intermittently 500s a
    // request under full-suite parallel load with "No intl context found",
    // which has nothing to do with pagination. A persistent 500 still fails
    // here — a single transient one does not.
    await expect(async () => {
      const response = await page.goto('/en/admin/rfqs?page=1000')
      expect(response?.status()).toBe(200)
      await expect(mainRegion(page).getByText('No results found')).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 40_000 })
  })
})
