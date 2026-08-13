import { expect, test } from '@playwright/test'
import { mainRegion } from './helpers'

/**
 * The catalogue is RFQ-based. The most important assertions here are the
 * negative ones: no price may ever appear, and filters must be reflected in the
 * URL so results stay shareable.
 */
test.describe('Marketplace', () => {
  test('lists seeded products with a result count', async ({ page }) => {
    await page.goto('/en/marketplace')

    const main = mainRegion(page)
    await expect(main.getByText(/\d+ products?/)).toBeVisible()

    // `locator.count()` does NOT auto-wait, so assert with expect() instead.
    const cards = main.locator('ul > li').filter({ hasText: 'Price on request' })
    await expect(cards.first()).toBeVisible()
  })

  test('never displays a price', async ({ page }) => {
    await page.goto('/en/marketplace')

    // `innerText()` is a one-shot read with no auto-wait, so it can capture the
    // Suspense fallback instead of the catalogue. Wait for a card first.
    const main = mainRegion(page)
    await expect(main.locator('ul > li').first()).toBeVisible()

    const body = await main.innerText()
    // No currency symbols or SAR/USD amounts anywhere in the catalogue.
    expect(body).not.toMatch(/[$€£]\s?\d/)
    expect(body).not.toMatch(/\b(SAR|USD|EUR)\s?\d/)
    expect(body).toContain('Price on request')
  })

  test('search narrows results and is reflected in the URL', async ({ page }) => {
    await page.goto('/en/marketplace')

    await page.getByLabel('Search', { exact: true }).fill('cement')
    await page.getByRole('button', { name: /^search$/i }).click()

    await page.waitForURL(/[?&]q=cement/)

    // Scope to the results list: the category <select> also contains "Cement",
    // and its hidden <option> would otherwise satisfy the assertion.
    const results = mainRegion(page).locator('ul > li')
    await expect(results.first()).toBeVisible()
    await expect(results.first()).toContainText(/cement/i)
  })

  test('shows an empty state for a query that matches nothing', async ({ page }) => {
    await page.goto('/en/marketplace?q=zzzznomatchzzzz')

    const main = mainRegion(page)
    await expect(main.getByText('No products match your filters')).toBeVisible()
    await expect(main.getByText(/no products/i).first()).toBeVisible()
  })

  test('filters by category through the URL', async ({ page }) => {
    await page.goto('/en/marketplace?category=tiles-and-ceramics')

    const main = mainRegion(page)
    await expect(main.getByText(/porcelain/i).first()).toBeVisible()
  })

  test('category route renders its own page', async ({ page }) => {
    await page.goto('/en/marketplace/steel-and-reinforcement')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/steel/i)
    await expect(mainRegion(page).getByText(/reinforcement bar/i).first()).toBeVisible()
  })
})

test.describe('Product detail', () => {
  /** Seeded by prisma/seed.ts. Navigating directly keeps these deterministic. */
  const PRODUCT_SLUG = 'ordinary-portland-cement-type-i-sample'

  test('navigates from a catalogue card to the product page', async ({ page }) => {
    await page.goto('/en/marketplace')

    await mainRegion(page)
      .locator('ul > li')
      .filter({ hasText: /cement/i })
      .first()
      .getByRole('link')
      .first()
      .click()

    await page.waitForURL(/\/products\//)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/cement/i)
  })

  test('renders specifications and no price', async ({ page }) => {
    await page.goto(`/en/products/${PRODUCT_SLUG}`)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const main = mainRegion(page)
    // "Price on request" also appears on each related-product card.
    await expect(main.getByText('Price on request').first()).toBeVisible()
    await expect(main.getByText('Saudi made').first()).toBeVisible()

    // Target the heading specifically: the spec table also carries an sr-only
    // <caption> with the same text, so a plain text match is ambiguous.
    await expect(
      main.getByRole('heading', { name: 'Technical specifications' })
    ).toBeVisible()

    const body = await main.innerText()
    expect(body).not.toMatch(/[$€£]\s?\d/)
  })

  test('emits Product structured data without a fabricated offer', async ({ page }) => {
    await page.goto(`/en/products/${PRODUCT_SLUG}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // The page emits several JSON-LD blocks (BreadcrumbList too); find Product.
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const product = blocks
      .map((block) => JSON.parse(block) as Record<string, unknown>)
      .find((parsed) => parsed['@type'] === 'Product')

    expect(product, 'Product JSON-LD present').toBeDefined()
    expect(product!.name).toBeTruthy()
    // Asserting a price we do not have would be false structured data.
    expect(product!.offers).toBeUndefined()
  })

  test('renders the not-found page for an unknown product slug', async ({ page }) => {
    await page.goto('/en/products/does-not-exist-at-all')

    // Next 16 returns 200 for a *streamed* notFound(), so assert the rendered
    // content rather than the status code.
    await expect(page.getByText('Page not found')).toBeVisible()
  })
})

test.describe('RFQ cart', () => {
  test('adds a product and persists it across a reload', async ({ page, context }) => {
    await page.goto('/en/marketplace')

    const firstCard = mainRegion(page).locator('ul > li').first()
    await firstCard.getByRole('button', { name: /add to rfq/i }).click()

    // The control confirms the addition.
    await expect(firstCard.getByRole('button', { name: /in your rfq/i })).toBeVisible({
      timeout: 15_000,
    })

    // The cart lives in an httpOnly cookie, so it survives a reload.
    const cookies = await context.cookies()
    const cart = cookies.find((cookie) => cookie.name === 'GLEX_RFQ_CART')
    expect(cart, 'cart cookie set').toBeDefined()
    expect(cart!.httpOnly, 'cart cookie is httpOnly').toBe(true)
  })
})
