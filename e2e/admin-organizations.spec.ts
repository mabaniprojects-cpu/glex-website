import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword } from './helpers'

/**
 * Organization administration.
 *
 * The consequential claim is that disabling an organization really denies
 * access to its members — an organization switch that only sets a flag would be
 * worse than none, because it would look like the relationship had been ended.
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

async function createOrg(suffix: string, extra: { withUser?: boolean } = {}) {
  const stamp = `${Date.now()}-${suffix}`
  const organization = await db.organization.create({
    data: {
      name: `E2E Org ${stamp}`,
      slug: `e2e-org-${stamp}`,
      type: 'CLIENT',
      country: 'Saudi Arabia',
    },
    select: { id: true, name: true, slug: true },
  })

  if (extra.withUser) {
    await db.user.create({
      data: {
        email: `org-member-${stamp}@example.com`,
        name: `Member ${stamp}`,
        role: 'CLIENT_TEAM_MEMBER',
        emailVerified: new Date(),
        organizationId: organization.id,
      },
    })
  }

  return organization
}

async function cleanUp(organizationId: string) {
  await db.auditLog.deleteMany({ where: { entityId: organizationId } })
  await db.session.deleteMany({ where: { user: { organizationId } } })
  await db.user.deleteMany({ where: { organizationId } })
  await db.organization.delete({ where: { id: organizationId } })
}

const cardFor = (page: Page, name: string) => page.locator('li').filter({ hasText: name })

test.describe('Organization administration', () => {
  test('edits details and audits the change', async ({ page }) => {
    const org = await createOrg('edit')

    await signInAsAdmin(page)
    await page.goto(`/en/admin/organizations?q=${encodeURIComponent(org.slug)}`)

    const card = cardFor(page, org.name)
    await card.getByRole('button', { name: 'Edit' }).click()

    await card.getByLabel('City').fill('Dammam')
    await card.getByRole('button', { name: 'Save' }).click()

    await expect
      .poll(
        async () =>
          (await db.organization.findUnique({ where: { id: org.id }, select: { city: true } }))
            ?.city,
        { timeout: 20_000 }
      )
      .toBe('Dammam')

    const audit = await db.auditLog.findFirst({
      where: { entityType: 'Organization', entityId: org.id, action: 'organization.updated' },
    })
    expect(audit, 'every organization edit is audited').not.toBeNull()

    await cleanUp(org.id)
  })

  test('refuses a website that is not http(s)', async ({ page }) => {
    const org = await createOrg('xss')

    await signInAsAdmin(page)
    await page.goto(`/en/admin/organizations?q=${encodeURIComponent(org.slug)}`)

    const card = cardFor(page, org.name)
    await card.getByRole('button', { name: 'Edit' }).click()

    // This value becomes an href in the organization view; storing it would be
    // stored XSS.
    await card.getByLabel('Website').fill('javascript:alert(1)')
    await card.getByRole('button', { name: 'Save' }).click()

    await expect(card.getByRole('alert')).toBeVisible({ timeout: 20_000 })

    const fresh = await db.organization.findUnique({
      where: { id: org.id },
      select: { website: true },
    })
    expect(fresh?.website, 'a javascript: URL is never stored').toBeNull()

    await cleanUp(org.id)
  })

  test('disabling an organization denies its members a session', async ({ page, browser }) => {
    const stamp = `${Date.now()}-deny`
    const org = await db.organization.create({
      data: {
        name: `E2E Org ${stamp}`,
        slug: `e2e-org-${stamp}`,
        type: 'CLIENT',
        country: 'Saudi Arabia',
      },
      select: { id: true, name: true, slug: true },
    })

    // A real, sign-in-capable member, using the seeded demo password hash so
    // the credentials actually work.
    const seeded = await db.user.findUnique({
      where: { email: 'client@glex.demo' },
      select: { passwordHash: true },
    })
    const email = `org-member-${stamp}@example.com`
    await db.user.create({
      data: {
        email,
        name: `Member ${stamp}`,
        role: 'CLIENT_TEAM_MEMBER',
        emailVerified: new Date(),
        passwordHash: seeded!.passwordHash,
        organizationId: org.id,
      },
    })

    // The member can sign in while the organization is enabled.
    const before = await browser.newContext()
    const beforePage = await before.newPage()
    await beforePage.goto('/en/login')
    await beforePage.locator('form').getByLabel('Business email').fill(email)
    await beforePage.locator('form').getByLabel('Password').fill(DEMO_PASSWORD)
    await beforePage.locator('form').getByRole('button', { name: /^log in$/i }).click()
    await beforePage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
    expect(beforePage.url(), 'enabled organization allows sign-in').not.toContain('/login')
    await before.close()

    // Disable it from the admin portal.
    await signInAsAdmin(page)
    await page.goto(`/en/admin/organizations?q=${encodeURIComponent(org.slug)}`)
    await cardFor(page, org.name).getByRole('button', { name: 'Disable access' }).click()

    await expect
      .poll(
        async () =>
          (await db.organization.findUnique({ where: { id: org.id }, select: { isActive: true } }))
            ?.isActive,
        { timeout: 20_000 }
      )
      .toBe(false)

    // The same credentials are now refused — the switch is not decorative.
    const after = await browser.newContext()
    const afterPage = await after.newPage()
    await afterPage.goto('/en/login')
    await afterPage.locator('form').getByLabel('Business email').fill(email)
    await afterPage.locator('form').getByLabel('Password').fill(DEMO_PASSWORD)
    await afterPage.locator('form').getByRole('button', { name: /^log in$/i }).click()

    // Stays on the login page rather than reaching a dashboard.
    await expect(afterPage).toHaveURL(/\/login/, { timeout: 30_000 })
    await after.close()

    await cleanUp(org.id)
  })

  test('an organization holding records offers no delete control', async ({ page }) => {
    const org = await createOrg('holding', { withUser: true })

    await signInAsAdmin(page)
    await page.goto(`/en/admin/organizations?q=${encodeURIComponent(org.slug)}`)

    const card = cardFor(page, org.name)
    await expect(card.getByText('1 users')).toBeVisible()

    // No delete button is offered, because the server would refuse it — the UI
    // must not present an action that cannot succeed.
    await expect(card.getByRole('button', { name: 'Delete' })).toHaveCount(0)

    await cleanUp(org.id)
  })

  test('an empty organization can be soft-deleted and leaves the list', async ({ page }) => {
    const org = await createOrg('empty')

    await signInAsAdmin(page)
    await page.goto(`/en/admin/organizations?q=${encodeURIComponent(org.slug)}`)

    await cardFor(page, org.name).getByRole('button', { name: 'Delete' }).click()

    await expect
      .poll(
        async () => {
          const row = await db.organization.findUnique({
            where: { id: org.id },
            select: { deletedAt: true },
          })
          return row?.deletedAt !== null
        },
        { timeout: 20_000 }
      )
      .toBe(true)

    // Soft, not hard: the row survives for history, but the list stops showing it.
    await page.reload()
    await expect(page.getByText(org.name)).toHaveCount(0)

    await cleanUp(org.id)
  })
})
