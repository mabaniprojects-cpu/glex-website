import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword } from './helpers'

/**
 * News category management.
 *
 * The two claims worth proving are that the slug is derived server-side rather
 * than accepted from the form, and that a category holding articles cannot be
 * removed. The relation is `onDelete: SetNull`, so a delete would not destroy
 * the articles — it would quietly strip their category, which is the kind of
 * content change that leaves no trace.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

const DEMO_PASSWORD = demoPassword()

async function signInAsAdmin(page: Page) {
  await page.goto('/en/login')
  const form = page.locator('form')
  await form.getByLabel('Business email').fill('admin@glex.demo')
  await form.getByLabel('Password').fill(DEMO_PASSWORD)
  await form.getByRole('button', { name: /^log in$/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
}

const cardFor = (page: Page, name: string) => page.locator('li').filter({ hasText: name })

test.describe('News category management', () => {
  test('creates a category with a slug derived from the name', async ({ page }) => {
    const name = `E2E Port Logistics ${Date.now()}`

    await signInAsAdmin(page)
    await page.goto('/en/admin/news/categories')

    await page.getByRole('button', { name: 'New category' }).click()
    await page.getByLabel('Category name').fill(name)
    await page.getByRole('button', { name: 'Save' }).click()

    await expect
      .poll(async () => db.newsCategory.findFirst({ where: { name } }), { timeout: 20_000 })
      .not.toBeNull()

    const created = await db.newsCategory.findFirst({ where: { name } })

    // Derived, never submitted: the slug is a public URL, so accepting one from
    // the form would let it be pointed anywhere.
    expect(created!.slug).toMatch(/^e2e-port-logistics-\d+$/)

    const audit = await db.auditLog.findFirst({
      where: { entityType: 'NewsCategory', entityId: created!.id, action: 'news_category.created' },
    })
    expect(audit, 'creating a category is audited').not.toBeNull()

    await db.auditLog.deleteMany({ where: { entityId: created!.id } })
    await db.newsCategory.delete({ where: { id: created!.id } })
  })

  test('a category holding articles cannot be deleted', async ({ page }) => {
    const stamp = Date.now()
    const category = await db.newsCategory.create({
      data: { name: `E2E Held ${stamp}`, slug: `e2e-held-${stamp}`, sortOrder: 900 },
      select: { id: true, name: true },
    })

    const article = await db.newsArticle.create({
      data: {
        slug: `e2e-held-article-${stamp}`,
        title: `E2E Held Article ${stamp}`,
        summary: 'Holds a category so it cannot be removed.',
        body: 'Body text for the held-category check.',
        status: 'DRAFT',
        categoryId: category.id,
        readingMinutes: 1,
      },
      select: { id: true },
    })

    await signInAsAdmin(page)
    await page.goto('/en/admin/news/categories')

    const card = cardFor(page, category.name)
    await expect(card.getByText('1 articles')).toBeVisible()

    await card.getByRole('button', { name: 'Delete' }).click()

    // The refusal is the point: the category must survive.
    await expect
      .poll(async () => db.newsCategory.count({ where: { id: category.id } }), { timeout: 20_000 })
      .toBe(1)

    await db.newsArticle.delete({ where: { id: article.id } })
    await db.newsCategory.delete({ where: { id: category.id } })
  })

  test('an empty category is removed and disappears from the list', async ({ page }) => {
    const stamp = Date.now()
    const category = await db.newsCategory.create({
      data: { name: `E2E Empty ${stamp}`, slug: `e2e-empty-${stamp}`, sortOrder: 901 },
      select: { id: true, name: true },
    })

    await signInAsAdmin(page)
    await page.goto('/en/admin/news/categories')

    await cardFor(page, category.name).getByRole('button', { name: 'Delete' }).click()

    await expect
      .poll(async () => db.newsCategory.count({ where: { id: category.id } }), { timeout: 20_000 })
      .toBe(0)

    await expect(page.getByText(category.name)).toHaveCount(0)

    await db.auditLog.deleteMany({ where: { entityId: category.id } })
  })

  test('a category with no published article stays off the public news page', async ({ page }) => {
    const stamp = Date.now()
    const category = await db.newsCategory.create({
      data: { name: `E2E Unpublished ${stamp}`, slug: `e2e-unpublished-${stamp}`, sortOrder: 902 },
      select: { id: true, name: true },
    })

    // Visible in the admin list...
    await signInAsAdmin(page)
    await page.goto('/en/admin/news/categories')
    await expect(page.getByText(category.name)).toBeVisible()

    // ...but the public filter only offers categories that have something to
    // show, so an empty one must not appear as a dead end.
    await page.goto('/en/news')
    await expect(page.getByText(category.name)).toHaveCount(0)

    await db.auditLog.deleteMany({ where: { entityId: category.id } })
    await db.newsCategory.delete({ where: { id: category.id } })
  })
})
