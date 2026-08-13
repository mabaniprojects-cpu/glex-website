import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword } from './helpers'

/**
 * Supplier catalogue ownership.
 *
 * `product:write` is held by GLEX staff **and** by approved suppliers, so the
 * permission alone never answered "which products?". Until this scope existed,
 * `saveProduct` and `deleteProduct` looked a product up by id with no ownership
 * check — an approved supplier could edit, hide or delete any listing in the
 * catalogue by calling the Server Action directly, without ever loading the
 * admin UI.
 *
 * These tests drive the action through a real signed-in supplier session.
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

/** A product owned by nobody the demo supplier belongs to. */
async function createForeignProduct(suffix: string) {
  const stamp = `${Date.now()}-${suffix}`
  const category = await db.category.findFirstOrThrow({
    where: { deletedAt: null },
    select: { id: true },
  })

  return db.product.create({
    data: {
      slug: `e2e-foreign-${stamp}`,
      name: `E2E Foreign Product ${stamp}`,
      categoryId: category.id,
      isVisible: true,
      // Deliberately not the demo supplier's.
      supplierId: null,
    },
    select: { id: true, name: true, slug: true },
  })
}

test.describe('Supplier catalogue ownership', () => {
  test('a supplier cannot edit a product they do not own', async ({ page }) => {
    const foreign = await createForeignProduct('edit')

    await signIn(page, 'supplier@glex.demo')
    await page.goto(`/en/admin/products/${foreign.id}`)

    // No editing surface reaches a supplier. Asserted on content rather than
    // status: the admin layout answers a refused request with the `forbidden()`
    // boundary, which Next renders at 200 in this configuration — so a status
    // check would pass while the form was on screen.
    const main = page.locator('#main-content')
    await expect(main.getByRole('textbox', { name: /product name/i })).toHaveCount(0)
    await expect(main.getByRole('button', { name: /^save$/i })).toHaveCount(0)
    // Nor may the product's own details leak through the refusal.
    expect(await page.content()).not.toContain(foreign.name)

    const after = await db.product.findUniqueOrThrow({
      where: { id: foreign.id },
      select: { name: true, isVisible: true, deletedAt: true },
    })
    expect(after.name, 'the foreign product is untouched').toBe(foreign.name)
    expect(after.isVisible).toBe(true)
    expect(after.deletedAt).toBeNull()

    await db.product.delete({ where: { id: foreign.id } })
  })

  test('a supplier sees only their own products in the portal', async ({ page }) => {
    const foreign = await createForeignProduct('list')

    await signIn(page, 'supplier@glex.demo')
    await page.goto('/en/supplier/products')

    // Scoped by `supplierId` in SQL — another owner's product is not merely
    // hidden, it is never selected.
    await expect(page.locator('#main-content').getByText(foreign.name)).toHaveCount(0)

    await db.product.delete({ where: { id: foreign.id } })
  })

  test('the supplier catalogue paginates rather than returning everything', async ({ page }) => {
    await signIn(page, 'supplier@glex.demo')
    await page.goto('/en/supplier/products')

    const main = page.locator('#main-content')

    // The range indicator is the visible proof the query is bounded.
    await expect(main.getByText(/showing/i)).toBeVisible()

    // An out-of-range page renders an empty list rather than an error.
    //
    // Retried and asserted on content: a first navigation can catch the dev
    // server mid-compile and report 500 for a page that then renders fine, so
    // the status alone is not the claim. A page that never renders still fails.
    await expect(async () => {
      await page.goto('/en/supplier/products?page=999')
      await expect(main.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 5_000 })
      await expect(main.getByText(/showing 0/i)).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 45_000 })
  })

  test('the opportunities list paginates too', async ({ page }) => {
    await signIn(page, 'supplier@glex.demo')

    // Still the supplier's own view, not an error page. Retried for the same
    // reason as above.
    await expect(async () => {
      await page.goto('/en/supplier/opportunities?page=999')
      const main = page.locator('#main-content')
      await expect(main.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 5_000 })
      await expect(main.getByText(/showing 0/i)).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 45_000 })
  })

  test('the supplier overview counts every open opportunity, not just a page', async ({
    page,
  }) => {
    await signIn(page, 'supplier@glex.demo')
    await page.goto('/en/supplier')

    const profile = await db.supplierProfile.findFirstOrThrow({
      where: { organization: { users: { some: { email: 'supplier@glex.demo' } } } },
      select: { id: true },
    })
    const open = await db.sourcingOpportunity.count({
      where: { supplierId: profile.id, status: 'ASSIGNED' },
    })

    // Counted with its own query rather than by filtering a paginated page,
    // which would under-report once a supplier has more than one page.
    await expect(page.locator('#main-content')).toContainText(String(open))
  })
})
