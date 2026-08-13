import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword } from './helpers'

/**
 * Chat transcripts.
 *
 * A read-only support view. The claims worth proving are that a real
 * conversation is readable end to end, that it stays read-only, and that an
 * anonymous visitor's opaque cookie id never reaches the page — staff need to
 * read what was said, not to re-identify the person who said it.
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

const VISITOR_ID = 'e2e-visitor-cookie-should-never-render'

async function createTranscript(options: { escalated?: boolean } = {}) {
  const stamp = Date.now()
  return db.chatConversation.create({
    data: {
      visitorId: `${VISITOR_ID}-${stamp}`,
      locale: 'en',
      title: `E2E Transcript ${stamp}`,
      handoffAt: options.escalated ? new Date() : null,
      messages: {
        create: [
          { role: 'USER', content: 'How do I track my shipment?' },
          {
            role: 'ASSISTANT',
            content: 'From our FAQ: use the tracking page with your GLEX reference.',
            toolsUsed: ['faq_lookup'],
          },
        ],
      },
    },
    select: { id: true, title: true, visitorId: true },
  })
}

async function cleanUp(id: string) {
  await db.chatConversation.delete({ where: { id } })
}

test.describe('Chat transcripts', () => {
  test('a transcript is readable end to end', async ({ page }) => {
    const conversation = await createTranscript()

    await signInAsAdmin(page)
    await page.goto(`/en/admin/chats/${conversation.id}`)

    const main = page.locator('#main-content')
    await expect(main.getByRole('heading', { level: 1 })).toContainText(conversation.title!)

    // Both turns, in order, with the tool names but never their arguments.
    await expect(main.getByText('How do I track my shipment?')).toBeVisible()
    await expect(main.getByText(/use the tracking page/)).toBeVisible()
    await expect(main.getByText(/faq_lookup/)).toBeVisible()

    await cleanUp(conversation.id)
  })

  test('an anonymous visitor id never reaches the page', async ({ page }) => {
    const conversation = await createTranscript()

    await signInAsAdmin(page)
    await page.goto(`/en/admin/chats/${conversation.id}`)

    // The cookie id identifies a person across sessions. It is not selected by
    // the query, so it cannot appear in the markup or the RSC payload either.
    const html = await page.content()
    expect(html).not.toContain(VISITOR_ID)

    await expect(page.locator('#main-content').getByText('Anonymous visitor')).toBeVisible()

    await cleanUp(conversation.id)
  })

  test('the transcript is read-only', async ({ page }) => {
    const conversation = await createTranscript()

    await signInAsAdmin(page)
    await page.goto(`/en/admin/chats/${conversation.id}`)

    const main = page.locator('#main-content')

    // A record of what a visitor was told is worth having precisely because
    // nobody can revise it afterwards.
    await expect(main.getByRole('button', { name: /edit/i })).toHaveCount(0)
    await expect(main.getByRole('button', { name: /delete/i })).toHaveCount(0)
    await expect(main.locator('textarea')).toHaveCount(0)

    await cleanUp(conversation.id)
  })

  test('the escalated filter shows only handed-off conversations', async ({ page }) => {
    const plain = await createTranscript()
    const escalated = await createTranscript({ escalated: true })

    await signInAsAdmin(page)
    await page.goto('/en/admin/chats?escalated=1')

    const main = page.locator('#main-content')
    await expect(main.getByText(escalated.title!)).toBeVisible()
    await expect(main.getByText(plain.title!)).toHaveCount(0)

    await cleanUp(plain.id)
    await cleanUp(escalated.id)
  })

  test('an unknown transcript id is a plain 404', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/en/admin/chats/11111111-1111-4111-8111-111111111111')

    // Not a distinct "no such transcript" — an id that exists and one that does
    // not must look the same from outside.
    await expect(page.getByText('Page not found')).toBeVisible()
  })
})
