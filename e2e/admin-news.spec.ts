import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword, mainRegion } from './helpers'
import { toDateTimeLocalInput } from '../src/lib/utils'

/**
 * News authoring.
 *
 * Publishing is date-driven — `publishedWhere()` requires PUBLISHED *and* a
 * publication date that has passed — so the assertions that matter are which
 * articles reach the public listing, not just what the editor claims.
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

/**
 * The editor reads and writes the publication date as a wall-clock time in the
 * company's timezone, not the host's, so the test builds its values the same
 * way — otherwise a CI box in UTC and a laptop in Riyadh would disagree.
 */
const toDateTimeLocal = toDateTimeLocalInput

test.describe('News authoring access control', () => {
  test('a client cannot reach the article editor', async ({ page }) => {
    await signIn(page, 'client@glex.demo')

    for (const route of ['/en/admin/news', '/en/admin/news/new']) {
      await page.goto(route)
      const body = await page.locator('body').innerText()
      expect(body, `${route} leaked to a client`).not.toContain('New article')
      expect(body).not.toContain('Article body')
    }
  })
})

test.describe.serial('Article authoring', () => {
  const title = `E2E Draft Article ${Date.now()}`
  let createdId: string | null = null

  test.afterAll(async () => {
    if (createdId) await db.newsArticle.deleteMany({ where: { id: createdId } })
  })

  test('saves a draft that is not publicly visible', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto('/en/admin/news/new')

    const form = page.locator('form')
    // 'Title' also matches 'SEO title' via getByLabel, which does substring
    // matching on the label TEXT. getByRole matches the ACCESSIBLE NAME, which
    // excludes the aria-hidden required marker, so an exact match works here.
    await form.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
    await form
      .getByRole('textbox', { name: 'Summary', exact: true })
      .fill('A draft created by the end-to-end suite.')
    await form
      .getByLabel('Article body')
      .fill('Body text for the draft article created by the end-to-end suite. '.repeat(10))

    // The form states plainly that saving will not publish.
    await expect(form.getByText('This article will not be publicly visible')).toBeVisible()

    await form.getByRole('button', { name: /^save$/i }).click()
    await page.waitForURL(/\/admin\/news(\?|$)/, { timeout: 30_000 })

    const stored = await db.newsArticle.findFirst({
      where: { title },
      select: {
        id: true,
        slug: true,
        status: true,
        publishedAt: true,
        readingMinutes: true,
        isSample: true,
        authorId: true,
      },
    })
    expect(stored, 'article row written').toBeTruthy()
    createdId = stored!.id

    expect(stored!.status).toBe('DRAFT')
    expect(stored!.publishedAt).toBeNull()
    // Derived server-side from the body, never taken from the client.
    expect(stored!.readingMinutes).toBeGreaterThan(0)
    // Seeded demo content is flagged; authored content must not be.
    expect(stored!.isSample).toBe(false)
    expect(stored!.authorId).not.toBeNull()

    // A draft must be unreachable, even by its exact slug.
    await page.goto(`/en/news/${stored!.slug}`)
    await expect(page.getByText('Page not found')).toBeVisible()
  })

  test('a future publication date schedules rather than publishes', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto(`/en/admin/news/${createdId}`)

    const form = page.locator('form')
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await form.getByLabel('Status').selectOption('PUBLISHED')
    await form.getByLabel('Publication date').fill(toDateTimeLocal(future))

    // The form must not claim this becomes public now.
    await expect(form.getByText('This article will not be publicly visible')).toBeVisible()

    await form.getByRole('button', { name: /^save$/i }).click()
    await page.waitForURL(/\/admin\/news(\?|$)/, { timeout: 30_000 })

    const stored = await db.newsArticle.findUnique({
      where: { id: createdId! },
      select: { status: true, publishedAt: true, slug: true },
    })
    expect(stored!.status).toBe('PUBLISHED')
    expect(stored!.publishedAt!.getTime()).toBeGreaterThan(Date.now())

    // Still absent from the listing, its own page and the feed.
    await page.goto('/en/news')
    await expect(mainRegion(page).getByText(title)).toHaveCount(0)

    await page.goto(`/en/news/${stored!.slug}`)
    await expect(page.getByText('Page not found')).toBeVisible()

    const feed = await page.request.get('/en/news/rss.xml')
    expect(await feed.text()).not.toContain(title)
  })

  test('publishing with a past date makes it public', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto(`/en/admin/news/${createdId}`)

    const form = page.locator('form')

    // The hint is recomputed on the client from the date field, so a `fill()`
    // that lands before hydration sets the value and fires nothing.
    //
    // Each retry must write a DIFFERENT value. `fill()` updates React's
    // internal value tracker, and React suppresses the change event when the
    // value it is handed matches what the tracker already holds — so refilling
    // the same string is a no-op and the loop can never recover. A
    // `datetime-local` has minute precision, so stepping back one more minute
    // per attempt is the smallest change that reliably fires the event. Every
    // value is still in the past, so a hint that never appears still fails.
    let attempt = 0
    await expect(async () => {
      attempt += 1
      const past = new Date(Date.now() - attempt * 60_000)
      await form.getByLabel('Publication date').fill(toDateTimeLocal(past))
      await expect(form.getByText('Saving now makes this article publicly visible.')).toBeVisible({
        timeout: 5_000,
      })
    }).toPass({ timeout: 40_000 })

    await form.getByRole('button', { name: /^save$/i }).click()
    await page.waitForURL(/\/admin\/news(\?|$)/, { timeout: 30_000 })

    const stored = await db.newsArticle.findUnique({
      where: { id: createdId! },
      select: { slug: true },
    })

    await page.goto(`/en/news/${stored!.slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(title)

    // And an audit record exists for the change.
    const audit = await db.auditLog.findFirst({
      where: { entityType: 'NewsArticle', entityId: createdId!, action: 'news.updated' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit, 'AuditLog written').toBeTruthy()
    expect(audit!.actorId).not.toBeNull()
  })

  test('deleting is a soft delete that removes it from the public site', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto(`/en/admin/news/${createdId}`)

    await page.locator('form').getByRole('button', { name: /^delete$/i }).click()
    await page.waitForURL(/\/admin\/news(\?|$)/, { timeout: 30_000 })

    const stored = await db.newsArticle.findUnique({
      where: { id: createdId! },
      select: { deletedAt: true, slug: true },
    })
    expect(stored, 'row is soft-deleted, not removed').toBeTruthy()
    expect(stored!.deletedAt).not.toBeNull()

    await page.goto(`/en/news/${stored!.slug}`)
    await expect(page.getByText('Page not found')).toBeVisible()
  })
})
