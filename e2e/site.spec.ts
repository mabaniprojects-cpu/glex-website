import { expect, test } from '@playwright/test'

test.describe('Homepage', () => {
  test('renders the hero, logo and calls to action', async ({ page }) => {
    await page.goto('/en')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Saudi Products')
    await expect(
      page.getByRole('link', { name: 'GLEX' }).first().getByRole('img')
    ).toBeVisible()

    const main = page.locator('#main-content')
    await expect(main.getByRole('link', { name: /request a quote/i }).first()).toBeVisible()
    await expect(main.getByRole('link', { name: /register as a supplier/i }).first()).toBeVisible()
  })

  test('exposes a working skip-to-content link', async ({ page }) => {
    await page.goto('/en')

    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /skip to main content/i })
    await expect(skip).toBeFocused()
    await expect(skip).toHaveAttribute('href', '#main-content')
  })

  test('publishes robots.txt and sitemap.xml', async ({ request }) => {
    const robots = await request.get('/robots.txt')
    expect(robots.ok()).toBeTruthy()
    expect(await robots.text()).toContain('Sitemap:')

    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.ok()).toBeTruthy()
    const xml = await sitemap.text()
    expect(xml).toContain('/en')
    expect(xml).toContain('hreflang')
  })
})

test.describe('Internationalisation', () => {
  test('serves all five locales', async ({ request }) => {
    for (const locale of ['en', 'ar', 'de', 'fr', 'zh-CN']) {
      // Retried rather than asserted once: `next dev` intermittently 500s a
      // request under full-suite parallel load with "No intl context found",
      // which is a dev-server fault, not a routing one. A persistent 500 still
      // fails here.
      await expect(async () => {
        const response = await request.get(`/${locale}`)
        expect(response.status(), `locale ${locale}`).toBe(200)
      }).toPass({ timeout: 30_000 })
    }
  })

  test('Arabic renders right-to-left with the correct lang', async ({ page }) => {
    await page.goto('/ar')

    const html = page.locator('html')
    await expect(html).toHaveAttribute('dir', 'rtl')
    await expect(html).toHaveAttribute('lang', 'ar')

    // Content is genuinely translated, not English served under /ar.
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Saudi Products')
  })

  test('English renders left-to-right', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  })

  test('breadcrumbs do not duplicate the locale prefix', async ({ page }) => {
    await page.goto('/en/about')

    const home = page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link').first()
    // Regression guard: the i18n Link adds the locale, so a locale-prefixed
    // href here would produce /en/en.
    await expect(home).toHaveAttribute('href', '/en')
  })
})

test.describe('Shipment tracking', () => {
  const reference = `GLEX-SHP-${new Date().getFullYear()}-000001`

  test('shows the milestone timeline for the seeded shipment', async ({ page }) => {
    await page.goto(`/en/tracking?ref=${reference}`)

    const main = page.locator('#main-content')
    await expect(main.getByText(reference).first()).toBeVisible()
    await expect(main.getByText('In transit').first()).toBeVisible()
    await expect(main.getByRole('progressbar')).toBeVisible()
    await expect(main.getByText('Booking created')).toBeVisible()
    await expect(main.getByText('Vessel departed')).toBeVisible()
  })

  test('labels seeded records as demonstration data', async ({ page }) => {
    await page.goto(`/en/tracking?ref=${reference}`)
    // Demo/mock data must never be presented as live carrier data.
    await expect(page.getByText('Demo Tracking Mode')).toBeVisible()
  })

  test('shows a not-found state for an unknown reference', async ({ page }) => {
    await page.goto('/en/tracking?ref=GLEX-SHP-2026-999999')
    await expect(page.getByText('No shipment found')).toBeVisible()
  })
})
