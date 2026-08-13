import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { mainRegion } from './helpers'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

test.describe('News listing', () => {
  test('lists published articles with reading time', async ({ page }) => {
    await page.goto('/en/news')

    const main = mainRegion(page)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('News')
    await expect(main.getByText(/GLEX launches its digital export platform/i)).toBeVisible()
    await expect(main.getByText(/min read/i).first()).toBeVisible()
  })

  test('labels seeded articles as samples', async ({ page }) => {
    await page.goto('/en/news')
    // Demonstration content must never masquerade as real reporting.
    await expect(mainRegion(page).getByText('Sample').first()).toBeVisible()
  })

  test('filters by category through the URL', async ({ page }) => {
    await page.goto('/en/news?category=company-news')

    // `locator.count()` does NOT auto-wait — it queries immediately and would
    // return 0 before the page renders. Assert with expect(), which retries.
    const articles = mainRegion(page).getByRole('article')
    await expect(articles.first()).toBeVisible()

    // The active chip reflects the filter.
    await expect(
      mainRegion(page).getByRole('link', { name: /company news/i }).first()
    ).toHaveAttribute('aria-current', 'page')
  })

  test('searches and shows an empty state when nothing matches', async ({ page }) => {
    await page.goto('/en/news?q=zzzznomatchzzzz')
    await expect(mainRegion(page).getByText('No results found')).toBeVisible()
  })
})

test.describe('News article', () => {
  const SLUG = 'sample-glex-launches-its-digital-export-platform'

  test('renders the article with a sample notice and Article JSON-LD', async ({ page }) => {
    await page.goto(`/en/news/${SLUG}`)

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/digital export platform/i)

    const main = mainRegion(page)
    await expect(main.getByText(/sample article created for demonstration/i)).toBeVisible()

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const article = blocks
      .map((block) => JSON.parse(block) as Record<string, unknown>)
      .find((parsed) => parsed['@type'] === 'NewsArticle')

    expect(article, 'NewsArticle JSON-LD present').toBeDefined()
    expect(article!.headline).toBeTruthy()
    expect(article!.datePublished).toBeTruthy()
  })

  test('offers related articles and a route back to the listing', async ({ page }) => {
    await page.goto(`/en/news/${SLUG}`)

    await expect(mainRegion(page).getByRole('link', { name: /back to news/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Related articles' })).toBeVisible()
  })

  test('returns not-found for an unknown slug', async ({ page }) => {
    await page.goto('/en/news/this-article-does-not-exist')
    await expect(page.getByText('Page not found')).toBeVisible()
  })
})

test.describe('Scheduled publishing', () => {
  test('hides an article dated in the future from the site and the feed', async ({ page }) => {
    const slug = `future-article-${Date.now()}`
    const created = await db.newsArticle.create({
      data: {
        slug,
        title: 'Future Embargoed Announcement',
        summary: 'This must not be visible before its publication date.',
        body: 'Embargoed body text.',
        status: 'PUBLISHED',
        // Published status, but dated a week ahead.
        publishedAt: new Date(Date.now() + 7 * 86_400_000),
        readingMinutes: 1,
      },
      select: { id: true },
    })

    // Absent from the listing.
    await page.goto('/en/news')
    await expect(mainRegion(page).getByText('Future Embargoed Announcement')).toHaveCount(0)

    // Absent from the article route.
    await page.goto(`/en/news/${slug}`)
    await expect(page.getByText('Page not found')).toBeVisible()

    // Absent from the RSS feed.
    const feed = await page.request.get('/en/news/rss.xml')
    expect(feed.ok()).toBeTruthy()
    expect(await feed.text()).not.toContain('Future Embargoed Announcement')

    // Becomes visible once its date passes.
    await db.newsArticle.update({
      where: { id: created.id },
      data: { publishedAt: new Date(Date.now() - 60_000) },
    })
    await page.goto(`/en/news/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Future Embargoed')

    await db.newsArticle.delete({ where: { id: created.id } })
  })

  test('hides a draft article', async ({ page }) => {
    const slug = `draft-article-${Date.now()}`
    const created = await db.newsArticle.create({
      data: {
        slug,
        title: 'Unpublished Draft Article',
        summary: 'Drafts must never be reachable.',
        body: 'Draft body.',
        status: 'DRAFT',
        publishedAt: new Date(Date.now() - 86_400_000),
        readingMinutes: 1,
      },
      select: { id: true },
    })

    await page.goto(`/en/news/${slug}`)
    await expect(page.getByText('Page not found')).toBeVisible()

    await db.newsArticle.delete({ where: { id: created.id } })
  })
})

test.describe('RSS feed', () => {
  test('serves a valid feed per locale', async ({ request }) => {
    for (const locale of ['en', 'ar']) {
      const response = await request.get(`/${locale}/news/rss.xml`)
      expect(response.status(), locale).toBe(200)
      expect(response.headers()['content-type']).toContain('application/rss+xml')

      const xml = await response.text()
      expect(xml).toContain('<rss version="2.0"')
      expect(xml).toContain(`<language>${locale}</language>`)
      expect(xml).toContain('<item>')
    }
  })

  test('rejects an unknown locale', async ({ request }) => {
    const response = await request.get('/xx/news/rss.xml')
    expect(response.status()).toBe(404)
  })
})

test.describe('Homepage news slider', () => {
  test('renders as an accessible carousel with a pause control', async ({ page }) => {
    await page.goto('/en')

    const carousel = page.getByRole('region', { name: 'Featured news' })
    await expect(carousel).toBeVisible()
    await expect(carousel).toHaveAttribute('aria-roledescription', 'carousel')

    // Pause, Stop, Hide — the control must exist and be operable.
    await expect(carousel.getByRole('button', { name: /pause|resume/i })).toBeVisible()
    await expect(carousel.getByRole('button', { name: /previous article/i })).toBeVisible()
    await expect(carousel.getByRole('button', { name: /next article/i })).toBeVisible()
  })

  /**
   * Uses a MOBILE viewport with reduced motion.
   *
   * - Reduced motion stops autoplay, whose transitions otherwise keep the
   *   layout shifting so the control is never "stable" for Playwright.
   * - A mobile viewport shows one slide at a time. On desktop the three seeded
   *   articles all fit across `basis-1/3`, so Embla has nothing to scroll to
   *   and `scrollNext()` correctly does nothing.
   */
  test('advances to the next slide', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 390, height: 844 },
    })
    const page = await context.newPage()
    await page.goto('/en')

    const carousel = page.getByRole('region', { name: 'Featured news' })
    await expect(carousel.getByText(/^1 of \d+$/)).toBeAttached()

    // Embla initialises asynchronously, and `scrollNext()` is a no-op until it
    // has measured the track. A click that lands in that window is silently
    // lost, so retry the click until the position actually changes rather than
    // clicking once and waiting on a state that will never arrive.
    await expect(async () => {
      await carousel.getByRole('button', { name: /next article/i }).click()
      // The live region reports the new position.
      await expect(carousel.getByText(/^2 of \d+$/)).toBeAttached({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })

    await context.close()
  })

  /**
   * REGRESSION GUARD.
   *
   * Headless Chromium reports `prefers-reduced-motion: reduce` by default, so
   * every other slider test only ever exercised the plugin's `stop()` path.
   * The `play()` path crashed in a real browser — `Cannot read properties of
   * undefined` — because the autoplay plugin was called before Embla had
   * initialised it. This test forces motion ON so that path is covered.
   */
  test('starts autoplay without crashing when motion is allowed', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference' })
    const page = await context.newPage()

    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto('/en')
    const carousel = page.getByRole('region', { name: 'Featured news' })

    // Autoplay running means the control offers to PAUSE.
    await expect(carousel.getByRole('button', { name: /pause automatic rotation/i })).toBeVisible()

    // The slider must still be mounted — not replaced by an error boundary.
    await expect(carousel.getByText(/^1 of \d+$/)).toBeAttached()
    expect(pageErrors, 'the slider must not throw').toEqual([])

    await context.close()
  })

  test('does not autoplay when the user prefers reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/en')

    const carousel = page.getByRole('region', { name: 'Featured news' })
    // With motion suppressed the control offers to START rotation, proving
    // autoplay never began (WCAG 2.2 — Pause, Stop, Hide).
    await expect(carousel.getByRole('button', { name: /resume automatic rotation/i })).toBeVisible()

    await context.close()
  })
})
