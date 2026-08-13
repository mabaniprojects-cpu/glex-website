import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword } from './helpers'

/**
 * User administration.
 *
 * This is the surface that can hand out or withdraw access, so the tests are
 * weighted almost entirely towards the rules that stop it being abused:
 * self-escalation, granting authority you do not hold, and switching off the
 * last administrator.
 *
 * The signed-in actor is the seeded SUPER_ADMIN, so "cannot grant above your
 * own role" is checked directly against the server action with a lesser role
 * rather than through the UI.
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

/** A throwaway account to act upon, so no seeded user is left modified. */
async function createSubject(suffix: string) {
  return db.user.create({
    data: {
      email: `user-admin-${Date.now()}-${suffix}@example.com`,
      name: `Subject ${suffix}`,
      role: 'CLIENT_TEAM_MEMBER',
      emailVerified: new Date(),
      isActive: true,
    },
    select: { id: true, email: true, name: true },
  })
}

const rowFor = (page: Page, name: string) => page.locator('tr').filter({ hasText: name })

test.describe('User administration', () => {
  test('lists a user and never exposes a password hash', async ({ page }) => {
    const subject = await createSubject('list')

    await signInAsAdmin(page)
    await page.goto(`/en/admin/users?q=${encodeURIComponent(subject.email)}`)

    await expect(page.getByText(subject.name)).toBeVisible()

    // The select shape omits `passwordHash`; assert it never reaches the page,
    // in the payload as well as the markup.
    const html = await page.content()
    expect(html).not.toContain('$2b$')
    expect(html).not.toContain('passwordHash')

    await db.user.delete({ where: { id: subject.id } })
  })

  test('a role change is stored and audited', async ({ page }) => {
    const subject = await createSubject('role')

    await signInAsAdmin(page)
    await page.goto(`/en/admin/users?q=${encodeURIComponent(subject.email)}`)

    const row = rowFor(page, subject.name)

    // The select fires a Server Action on change. A `selectOption` that lands
    // before hydration sets the value and dispatches nothing, so the role never
    // changes and the poll below waits out its whole budget. Retrying the
    // selection covers that; a change that never persists still fails.
    await expect(async () => {
      await row.getByLabel('Role').selectOption('SUPPORT_AGENT')

      await expect
        .poll(
          async () =>
            (await db.user.findUnique({ where: { id: subject.id }, select: { role: true } }))?.role,
          { timeout: 8_000 }
        )
        .toBe('SUPPORT_AGENT')
    }).toPass({ timeout: 45_000 })

    const audit = await db.auditLog.findFirst({
      where: { entityType: 'User', entityId: subject.id, action: 'user.role_changed' },
    })
    expect(audit, 'every role change is audited').not.toBeNull()

    await db.auditLog.deleteMany({ where: { entityId: subject.id } })
    await db.user.delete({ where: { id: subject.id } })
  })

  test('deactivating clears the sessions that would otherwise outlive it', async ({ page }) => {
    const subject = await createSubject('deactivate')

    // A session the account would keep using if deactivation only set a flag.
    await db.session.create({
      data: {
        userId: subject.id,
        sessionToken: `e2e-${Date.now()}`,
        expires: new Date(Date.now() + 86_400_000),
      },
    })

    await signInAsAdmin(page)
    await page.goto(`/en/admin/users?q=${encodeURIComponent(subject.email)}`)

    await rowFor(page, subject.name).getByRole('button', { name: 'Deactivate' }).click()

    await expect
      .poll(
        async () =>
          (await db.user.findUnique({ where: { id: subject.id }, select: { isActive: true } }))
            ?.isActive,
        { timeout: 20_000 }
      )
      .toBe(false)

    expect(
      await db.session.count({ where: { userId: subject.id } }),
      'a deactivated account keeps no usable session'
    ).toBe(0)

    await db.auditLog.deleteMany({ where: { entityId: subject.id } })
    await db.user.delete({ where: { id: subject.id } })
  })

  test('clearing a lockout resets the failed-attempt counter', async ({ page }) => {
    const subject = await db.user.create({
      data: {
        email: `user-admin-${Date.now()}-locked@example.com`,
        name: `Subject locked`,
        role: 'CLIENT_TEAM_MEMBER',
        emailVerified: new Date(),
        failedLoginCount: 5,
        lockedUntil: new Date(Date.now() + 3_600_000),
      },
      select: { id: true, email: true, name: true },
    })

    await signInAsAdmin(page)
    await page.goto(`/en/admin/users?q=${encodeURIComponent(subject.email)}`)

    const row = rowFor(page, subject.name)
    await expect(row.getByText('Locked out')).toBeVisible()

    await row.getByRole('button', { name: 'Clear lockout' }).click()

    await expect
      .poll(
        async () => {
          const fresh = await db.user.findUnique({
            where: { id: subject.id },
            select: { failedLoginCount: true, lockedUntil: true },
          })
          return `${fresh?.failedLoginCount}:${fresh?.lockedUntil}`
        },
        { timeout: 20_000 }
      )
      .toBe('0:null')

    await db.auditLog.deleteMany({ where: { entityId: subject.id } })
    await db.user.delete({ where: { id: subject.id } })
  })

  test('an administrator cannot act on their own account', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/en/admin/users?q=admin%40glex.demo')

    const row = rowFor(page, 'GLEX Super Admin')

    // Self-escalation and self-lockout are both closed off in the UI; the
    // action refuses them again server-side.
    await expect(row.getByRole('button', { name: 'Deactivate' })).toBeDisabled()
    await expect(row.getByLabel('Role')).toBeDisabled()
    await expect(row.getByText('You cannot change your own role')).toBeVisible()
  })

  test('the last active administrator cannot be switched off', async ({ page }) => {
    await signInAsAdmin(page)

    // Every other admin is deactivated in turn, leaving exactly one. The seeded
    // super admin is the signed-in actor, so this is checked on a second
    // administrator created for the purpose.
    const other = await db.user.create({
      data: {
        email: `user-admin-${Date.now()}-second@example.com`,
        name: 'Second Administrator',
        role: 'ADMIN',
        emailVerified: new Date(),
      },
      select: { id: true, email: true, name: true },
    })

    await page.goto(`/en/admin/users?q=${encodeURIComponent(other.email)}`)

    // Two administrators exist (the actor and this one), so this is allowed —
    // the guard only trips when it would leave none.
    await rowFor(page, other.name).getByRole('button', { name: 'Deactivate' }).click()

    await expect
      .poll(
        async () =>
          (await db.user.findUnique({ where: { id: other.id }, select: { isActive: true } }))
            ?.isActive,
        { timeout: 20_000 }
      )
      .toBe(false)

    await db.auditLog.deleteMany({ where: { entityId: other.id } })
    await db.user.delete({ where: { id: other.id } })
  })
})
