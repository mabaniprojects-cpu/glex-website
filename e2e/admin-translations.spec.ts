import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword } from './helpers'

/**
 * Per-entity translation editing.
 *
 * The claim worth proving is that a translation written in the portal is what
 * the public page actually renders, and that removing it degrades to the
 * English source rather than emptying the page.
 *
 * English is deliberately not offered: the base record *is* the English text,
 * so an `en` translation row would shadow the source and the two could disagree
 * with nothing to say which wins.
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

/** A disposable product, so no seeded catalogue entry is left translated. */
async function createProduct(suffix: string) {
  const stamp = `${Date.now()}-${suffix}`
  const category = await db.category.findFirstOrThrow({
    where: { deletedAt: null },
    select: { id: true },
  })

  return db.product.create({
    data: {
      slug: `e2e-translate-${stamp}`,
      name: `E2E Translate ${stamp}`,
      shortDescription: 'English short description.',
      description: 'English long description.',
      categoryId: category.id,
      isVisible: true,
    },
    select: { id: true, slug: true, name: true },
  })
}

async function cleanUp(productId: string) {
  await db.auditLog.deleteMany({ where: { entityId: productId } })
  await db.product.delete({ where: { id: productId } })
}

const editor = (page: Page) => page.locator('#main-content')

test.describe('Per-entity translations', () => {
  // These assert on public pages rendered from shared rows and mutate a
  // disposable product; the behaviour is server-side and viewport-independent.
  test.skip(
    () => test.info().project.name !== 'desktop-chrome',
    'server behaviour; verified once on desktop'
  )

  test('a saved Arabic translation is what the public page renders', async ({ page }) => {
    const product = await createProduct('render')
    const arabicName = `منتج مترجم ${Date.now()}`

    await signInAsAdmin(page)
    await page.goto(`/en/admin/products/${product.id}`)

    const section = editor(page).getByRole('region', { name: 'Translations' })
    await section.getByRole('tab', { name: /العربية|Arabic/ }).click()
    await section.getByLabel('Name').fill(arabicName)
    await section.getByRole('button', { name: 'Save translation' }).click()

    await expect
      .poll(
        async () =>
          db.productTranslation.count({ where: { productId: product.id, locale: 'ar' } }),
        { timeout: 20_000 }
      )
      .toBe(1)

    // The assertion that makes this real rather than decorative.
    await page.goto(`/ar/products/${product.slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(arabicName)

    // English is untouched — a translation adds, it does not replace.
    await page.goto(`/en/products/${product.slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(product.name)

    await cleanUp(product.id)
  })

  test('removing a translation falls back to English rather than emptying the page', async ({
    page,
  }) => {
    const product = await createProduct('fallback')

    await db.productTranslation.create({
      data: { productId: product.id, locale: 'ar', name: 'اسم عربي مؤقت' },
    })

    await signInAsAdmin(page)
    await page.goto(`/en/admin/products/${product.id}`)

    const section = editor(page).getByRole('region', { name: 'Translations' })
    await section.getByRole('tab', { name: /العربية|Arabic/ }).click()
    await section.getByRole('button', { name: /remove this translation/i }).click()

    await expect
      .poll(
        async () =>
          db.productTranslation.count({ where: { productId: product.id, locale: 'ar' } }),
        { timeout: 20_000 }
      )
      .toBe(0)

    // Degrades to the English source, which is far better than a blank name.
    await page.goto(`/ar/products/${product.slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(product.name)

    await cleanUp(product.id)
  })

  test('English is not offered as a translation', async ({ page }) => {
    const product = await createProduct('no-english')

    await signInAsAdmin(page)
    await page.goto(`/en/admin/products/${product.id}`)

    const section = editor(page).getByRole('region', { name: 'Translations' })

    // The base record is the English source; a row for it would shadow that.
    await expect(section.getByRole('tab', { name: /^English$/ })).toHaveCount(0)
    await expect(section.getByRole('tab')).toHaveCount(4)

    await cleanUp(product.id)
  })

  test('a blank required field is refused rather than rendering an empty name', async ({
    page,
  }) => {
    const product = await createProduct('blank')

    await signInAsAdmin(page)
    await page.goto(`/en/admin/products/${product.id}`)

    const section = editor(page).getByRole('region', { name: 'Translations' })
    await section.getByRole('tab', { name: /العربية|Arabic/ }).click()

    // `pickTranslation(...)?.name ?? product.name` does not fall back on an
    // empty string, so a blank name would render as nothing at all.
    await expect(section.getByRole('button', { name: 'Save translation' })).toBeDisabled()

    expect(
      await db.productTranslation.count({ where: { productId: product.id } }),
      'nothing was written'
    ).toBe(0)

    await cleanUp(product.id)
  })

  test('the English source is shown beside each field', async ({ page }) => {
    const product = await createProduct('source')

    await signInAsAdmin(page)
    await page.goto(`/en/admin/products/${product.id}`)

    const section = editor(page).getByRole('region', { name: 'Translations' })

    // A translator working from a blank box guesses; one working from the
    // source does not.
    await expect(section.getByText(product.name)).toBeVisible()
    await expect(section.getByText('English short description.')).toBeVisible()

    await cleanUp(product.id)
  })
})
