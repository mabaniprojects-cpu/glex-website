import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword, mainRegion } from './helpers'

/**
 * Admin content management.
 *
 * The assertions that matter are in PostgreSQL: a form that only looks like it
 * saved is exactly the failure mode these guard against.
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

test.describe('Content management access control', () => {
  test('a client cannot reach the product or category editors', async ({ page }) => {
    await signIn(page, 'client@glex.demo')

    for (const route of ['/en/admin/products', '/en/admin/products/new', '/en/admin/categories']) {
      await page.goto(route)
      const body = await page.locator('body').innerText()
      expect(body, `${route} leaked to a client`).not.toContain('New product')
      expect(body).not.toContain('New category')
    }
  })

  test('a supplier cannot reach the product editor', async ({ page }) => {
    await signIn(page, 'supplier@glex.demo')

    await page.goto('/en/admin/products/new')
    const body = await page.locator('body').innerText()
    expect(body).not.toContain('Product name')
  })
})

test.describe.serial('Product management', () => {
  const name = `E2E Test Product ${Date.now()}`
  let createdId: string | null = null

  test.afterAll(async () => {
    if (createdId) await db.product.deleteMany({ where: { id: createdId } })
  })

  test('creates a product and stores it in the database', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto('/en/admin/products/new')

    const form = page.locator('form')
    await form.getByLabel('Product name').fill(name)

    // Pick the first real category rather than pinning a seeded name.
    const category = await db.category.findFirst({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    // A required field renders a visual '*' inside its label, so an exact
    // string match fails. Anchor with a regex instead of matching 'Category',
    // which would also select 'Parent category'.
    await form.getByLabel(/^Category\s*\*?$/).selectOption(category!.id)

    await form.getByLabel('Brand').fill('E2E Brand')
    await form.getByLabel('Minimum order').fill('40')

    await form.getByRole('button', { name: /^save$/i }).click()

    // Redirects back to the list once the write succeeds.
    await page.waitForURL(/\/admin\/products(\?|$)/, { timeout: 30_000 })

    // --- The assertion that matters ---
    const stored = await db.product.findFirst({
      where: { name },
      select: {
        id: true,
        slug: true,
        brand: true,
        minimumOrderQty: true,
        isVisible: true,
        categoryId: true,
      },
    })
    expect(stored, 'product row written').toBeTruthy()
    createdId = stored!.id

    expect(stored!.brand).toBe('E2E Brand')
    expect(stored!.minimumOrderQty).toBe(40)
    expect(stored!.categoryId).toBe(category!.id)
    // The slug is derived server-side, never taken from the client.
    expect(stored!.slug).toMatch(/^e2e-test-product-\d+$/)
  })

  test('the new product is reachable in the public catalogue', async ({ page }) => {
    const product = await db.product.findFirst({ where: { name }, select: { slug: true } })
    await page.goto(`/en/products/${product!.slug}`)

    await expect(page.getByRole('heading', { level: 1 })).toContainText(name)

    // Spec section 7: no price may appear, on any surface.
    const body = await mainRegion(page).innerText()
    expect(body).not.toMatch(/[$€£]\s?\d/)
    expect(body).not.toMatch(/\b(SAR|USD|EUR)\s?\d/)
  })

  test('the edit form saves changes and writes an audit record', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto(`/en/admin/products/${createdId}`)

    const form = page.locator('form')
    await form.getByLabel('Brand').fill('E2E Brand Updated')
    await form.getByRole('button', { name: /^save$/i }).click()
    await page.waitForURL(/\/admin\/products(\?|$)/, { timeout: 30_000 })

    const stored = await db.product.findUnique({
      where: { id: createdId! },
      select: { brand: true },
    })
    expect(stored!.brand).toBe('E2E Brand Updated')

    const audit = await db.auditLog.findFirst({
      where: { entityType: 'Product', entityId: createdId!, action: 'product.updated' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit, 'AuditLog written').toBeTruthy()
    expect(audit!.actorId).not.toBeNull()
  })

  test('deleting is a soft delete that hides it from the catalogue', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto(`/en/admin/products/${createdId}`)

    await page.locator('form').getByRole('button', { name: /^delete$/i }).click()
    await page.waitForURL(/\/admin\/products(\?|$)/, { timeout: 30_000 })

    const stored = await db.product.findUnique({
      where: { id: createdId! },
      select: { deletedAt: true, isVisible: true, slug: true },
    })
    // The row survives so historical RFQ line items keep resolving.
    expect(stored, 'row is soft-deleted, not removed').toBeTruthy()
    expect(stored!.deletedAt).not.toBeNull()
    expect(stored!.isVisible).toBe(false)

    // ...but the public page must be gone. A streamed `notFound()` cannot
    // change the status after the response has started, so Next serves it with
    // 200 — assert the rendered page, plus the `noindex` directive Next emits
    // for the not-found boundary, which is what keeps a soft 404 unindexed.
    await page.goto(`/en/products/${stored!.slug}`)
    await expect(page.getByText('Page not found')).toBeVisible()
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()
  })
})

test.describe.serial('Category management', () => {
  const name = `E2E Test Category ${Date.now()}`

  test.afterAll(async () => {
    await db.category.deleteMany({ where: { name } })
  })

  test('creates a category and stores it in the database', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto('/en/admin/categories')

    await mainRegion(page).getByRole('button', { name: 'New category' }).click()

    const form = page.locator('form')
    await form.getByLabel('Category name').fill(name)
    await form.getByRole('button', { name: /^save$/i }).click()

    await expect(mainRegion(page).getByRole('status')).toBeVisible({ timeout: 20_000 })

    const stored = await db.category.findFirst({
      where: { name },
      select: { id: true, slug: true, isActive: true },
    })
    expect(stored, 'category row written').toBeTruthy()
    expect(stored!.slug).toMatch(/^e2e-test-category-\d+$/)
    expect(stored!.isActive).toBe(true)
  })

  test('refuses to delete a category that still has products', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')

    // A seeded category with products — deleting it must be blocked.
    const inUse = await db.category.findFirst({
      where: { deletedAt: null, products: { some: { deletedAt: null } } },
      select: { id: true, name: true },
    })
    expect(inUse, 'a category with products must exist for this test').toBeTruthy()

    await page.goto('/en/admin/categories')

    const row = mainRegion(page).locator('li').filter({ hasText: inUse!.name }).first()

    // Blocked in the UI, and the server refuses it too (see content-actions.ts).
    await expect(row.getByRole('button', { name: 'Delete' })).toBeDisabled()

    const still = await db.category.findUnique({
      where: { id: inUse!.id },
      select: { deletedAt: true },
    })
    expect(still!.deletedAt).toBeNull()
  })
})
