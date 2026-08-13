import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { mainRegion } from './helpers'

/**
 * Site settings: the announcement bar, social links, FAQ entries and trade
 * routes.
 *
 * Each of these is admin-managed content that renders on the public site, so
 * the assertions follow it all the way through: form → PostgreSQL → the page a
 * visitor actually sees.
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

test.describe('Settings access control', () => {
  test('a client cannot reach the settings surfaces', async ({ page }) => {
    await signIn(page, 'client@glex.demo')

    for (const route of ['/en/admin/settings', '/en/admin/faq', '/en/admin/routes']) {
      await page.goto(route)
      const body = await page.locator('body').innerText()
      expect(body, `${route} leaked to a client`).not.toContain('New announcement')
      expect(body).not.toContain('New FAQ entry')
      expect(body).not.toContain('New route')
    }
  })
})

test.describe.serial('Announcement bar', () => {
  const message = `E2E announcement ${Date.now()}`

  test.afterAll(async () => {
    await db.announcement.deleteMany({ where: { message } })
  })

  test('an active announcement appears on the public site', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto('/en/admin/settings')

    await mainRegion(page).getByRole('button', { name: 'New announcement' }).click()

    const form = page.locator('form')
    await form.getByRole('textbox', { name: 'Message', exact: true }).fill(message)
    await form.getByLabel('Active').check()
    await form.getByRole('button', { name: /^save$/i }).click()

    await expect(mainRegion(page).getByRole('status')).toBeVisible({ timeout: 20_000 })

    const stored = await db.announcement.findFirst({
      where: { message },
      select: { id: true, isActive: true, variant: true },
    })
    expect(stored, 'announcement row written').toBeTruthy()
    expect(stored!.isActive).toBe(true)

    // The bar renders above the header on every page.
    await page.goto('/en')
    await expect(page.getByText(message)).toBeVisible()
  })

  test('deactivating it removes the bar', async ({ page }) => {
    const existing = await db.announcement.findFirstOrThrow({ where: { message } })
    await db.announcement.update({ where: { id: existing.id }, data: { isActive: false } })

    await page.goto('/en')
    await expect(page.getByText(message)).toHaveCount(0)
  })

  test('rejects a javascript: link', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto('/en/admin/settings')

    await mainRegion(page).getByRole('button', { name: 'New announcement' }).click()

    const form = page.locator('form')
    const hostile = `E2E hostile ${Date.now()}`
    await form.getByRole('textbox', { name: 'Message', exact: true }).fill(hostile)
    await form.getByRole('textbox', { name: /^Link/ }).fill('javascript:alert(1)')
    await form.getByRole('button', { name: /^save$/i }).click()

    // Refused server-side, and nothing is written.
    await expect(mainRegion(page).getByRole('alert')).toBeVisible({ timeout: 20_000 })
    expect(await db.announcement.count({ where: { message: hostile } })).toBe(0)
  })
})

test.describe.serial('FAQ entries', () => {
  const question = `E2E does GLEX answer this question ${Date.now()}?`
  const answer = 'Yes — this answer was written by the end-to-end suite to verify FAQ management.'

  test.afterAll(async () => {
    await db.faqEntry.deleteMany({ where: { question } })
  })

  test('a new entry reaches the public FAQ page', async ({ page }) => {
    await signIn(page, 'admin@glex.demo')
    await page.goto('/en/admin/faq')

    await mainRegion(page).getByRole('button', { name: 'New FAQ entry' }).click()

    const form = page.locator('form')
    await form.getByRole('textbox', { name: 'Question', exact: true }).fill(question)
    await form.getByRole('textbox', { name: 'Answer', exact: true }).fill(answer)
    await form.getByRole('button', { name: /^save$/i }).click()

    await expect(mainRegion(page).getByRole('status')).toBeVisible({ timeout: 20_000 })

    const stored = await db.faqEntry.findFirst({
      where: { question },
      select: { id: true, locale: true, isActive: true },
    })
    expect(stored, 'FAQ row written').toBeTruthy()
    expect(stored!.isActive).toBe(true)

    await page.goto('/en/faq')
    await expect(mainRegion(page).getByText(question)).toBeVisible()
  })

  /**
   * The assistant's deterministic fallback answers from these entries verbatim,
   * so an admin edit is the only way its answers change while no AI provider is
   * configured.
   */
  test('the assistant answers from the new entry', async ({ page }) => {
    const response = await page.request.post('/api/chat', {
      data: { message: question, locale: 'en' },
    })
    expect(response.ok()).toBe(true)

    const body = (await response.json()) as {
      answer: string
      usedFallback: boolean
      sourceTitle: string | null
    }
    expect(body.usedFallback).toBe(true)
    expect(body.sourceTitle).toBe(question)
    expect(body.answer).toBe(answer)
  })
})

test.describe('Trade routes', () => {
  test('a new route is stored with its coordinates', async ({ page }) => {
    const label = `E2E Route ${Date.now()}`

    await signIn(page, 'admin@glex.demo')
    await page.goto('/en/admin/routes')

    await mainRegion(page).getByRole('button', { name: 'New route' }).click()

    const form = page.locator('form')
    await form.getByRole('textbox', { name: /^Route label/ }).fill(label)
    await form.getByRole('textbox', { name: /^Origin$/ }).fill('Jeddah')
    await form.getByRole('textbox', { name: /^Destination$/ }).fill('Rotterdam')
    await form.getByRole('spinbutton', { name: /^Origin latitude/ }).fill('21.4858')
    await form.getByRole('spinbutton', { name: /^Origin longitude/ }).fill('39.1925')
    await form.getByRole('spinbutton', { name: /^Destination latitude/ }).fill('51.9244')
    await form.getByRole('spinbutton', { name: /^Destination longitude/ }).fill('4.4777')
    await form.getByRole('button', { name: /^save$/i }).click()

    await expect(mainRegion(page).getByRole('status')).toBeVisible({ timeout: 20_000 })

    const stored = await db.globalRoute.findFirst({
      where: { label },
      select: { id: true, originLat: true, destLng: true, mode: true, isActive: true },
    })
    expect(stored, 'route row written').toBeTruthy()
    expect(stored!.originLat).toBeCloseTo(21.4858, 4)
    expect(stored!.destLng).toBeCloseTo(4.4777, 4)
    expect(stored!.isActive).toBe(true)

    await db.globalRoute.delete({ where: { id: stored!.id } })
  })
})
