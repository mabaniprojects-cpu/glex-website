import { expect, test } from '@playwright/test'
import { mainAlert, mainStatus } from './helpers'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { createToken, TOKEN_PURPOSE } from '../src/lib/tokens'

/**
 * End-to-end registration → verification → sign-in.
 *
 * The development mail transport is `console`, so the verification link is not
 * deliverable to a mailbox. Tokens are also stored hashed, so the raw value
 * cannot be read back from the database — by design. The test therefore issues
 * its own token through the same `createToken()` the action uses, and drives
 * the real verification page with it.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

const PASSWORD = 'GlexE2ePass9'

/**
 * Registration and password reset are rate-limited per IP (5/hour). Every
 * spec here shares 127.0.0.1, so the bucket is cleared first — these tests
 * exercise the registration mechanics, not the limiter. The limiter itself is
 * covered by its own test below.
 */
async function clearRateLimits() {
  await db.rateLimit.deleteMany({
    where: { OR: [{ key: { startsWith: 'register:' } }, { key: { startsWith: 'reset:' } }] },
  })
}

async function registerClient(
  page: import('@playwright/test').Page,
  email: string,
  name = 'E2E Client'
) {
  await clearRateLimits()
  await page.goto('/en/register/client')

  const form = page.locator('form')
  await form.getByLabel('Full name').fill(name)
  await form.getByLabel('Business email').fill(email)
  await form.getByLabel('Company name').fill(`E2E Trading ${Date.now()}`)
  await form.getByLabel('Country').fill('United Arab Emirates')
  await form.getByLabel('Password', { exact: false }).first().fill(PASSWORD)
  await form.getByLabel('Confirm password').fill(PASSWORD)
  await form.getByRole('button', { name: /create account/i }).click()

  await expect(mainStatus(page)).toBeVisible({ timeout: 20_000 })
}

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/en/login')
  const form = page.locator('form')
  await form.getByLabel('Business email').fill(email)
  await form.getByLabel('Password').fill(password)
  await form.getByRole('button', { name: /^log in$/i }).click()
}

test.describe('Client registration', () => {
  test('creates the user, organization and profile, unverified', async ({ page }) => {
    const email = uniqueEmail()
    await registerClient(page, email)
    await expect(mainStatus(page)).toContainText(email)

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true, role: true, organizationId: true, passwordHash: true },
    })

    expect(user, 'user row created').not.toBeNull()
    expect(user!.emailVerified, 'unverified until the link is followed').toBeNull()
    expect(user!.role).toBe('CLIENT_ORG_ADMIN')
    expect(user!.organizationId).not.toBeNull()
    // The password must never be stored in clear text.
    expect(user!.passwordHash).not.toBe(PASSWORD)
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$/)

    const profile = await db.clientProfile.findUnique({ where: { userId: user!.id } })
    expect(profile, 'client profile created').not.toBeNull()
  })

  test('stores the verification token hashed, never in clear text', async ({ page }) => {
    const email = uniqueEmail()
    await registerClient(page, email)

    const token = await db.securityToken.findFirst({
      where: { email, purpose: 'EMAIL_VERIFICATION', usedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    expect(token, 'verification token issued').not.toBeNull()
    expect(token!.token, 'stored as a SHA-256 hash').toMatch(/^[a-f0-9]{64}$/)
    expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  test('refuses sign-in while the account is unverified', async ({ page }) => {
    const email = uniqueEmail()
    await registerClient(page, email, 'Unverified User')

    await signIn(page, email, PASSWORD)

    await expect(mainAlert(page)).toBeVisible({ timeout: 20_000 })
    expect(page.url()).toContain('/login')
  })

  test('verifies by token, then signs in successfully', async ({ page }) => {
    const email = uniqueEmail()
    await registerClient(page, email, 'Verified User')

    // Issue a token through the same code path the action uses. This
    // invalidates the earlier one, which is exactly the intended behaviour.
    const raw = await createToken(email, TOKEN_PURPOSE.EMAIL_VERIFICATION)

    await page.goto(`/en/verify-email?token=${raw}`)
    await expect(mainStatus(page)).toContainText(/verified/i)

    const verified = await db.user.findUnique({
      where: { email },
      select: { emailVerified: true },
    })
    expect(verified!.emailVerified, 'emailVerified set in the database').not.toBeNull()

    // The link is single-use.
    await page.goto(`/en/verify-email?token=${raw}`)
    await expect(mainAlert(page)).toBeVisible()

    // And now sign-in succeeds.
    await signIn(page, email, PASSWORD)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 })
    expect(page.url()).not.toContain('/login')
  })
})

test.describe('Password reset', () => {
  test('does not reveal whether an address is registered', async ({ page }) => {
    await page.goto('/en/forgot-password')
    await page
      .locator('form')
      .getByLabel('Business email')
      .fill('definitely-not-registered@example.com')
    await page.locator('form').getByRole('button', { name: /send reset link/i }).click()

    const status = mainStatus(page)
    await expect(status).toBeVisible({ timeout: 20_000 })
    await expect(status).toContainText(/if an account exists/i)
  })

  test('resets the password with a valid token and invalidates it', async ({ page }) => {
    const email = uniqueEmail()
    await registerClient(page, email, 'Reset User')

    const raw = await createToken(email, TOKEN_PURPOSE.PASSWORD_RESET)
    const newPassword = 'GlexReset2026x'

    await page.goto(`/en/reset-password?token=${raw}`)
    const form = page.locator('form')
    await form.getByLabel('New password').fill(newPassword)
    await form.getByLabel('Confirm password').fill(newPassword)
    await form.getByRole('button', { name: /send reset link|reset/i }).click()

    await expect(mainStatus(page)).toContainText(/updated/i, { timeout: 20_000 })

    // A reset also proves the address, so sign-in should now work.
    await signIn(page, email, newPassword)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 })

    // The token cannot be reused.
    await page.goto(`/en/reset-password?token=${raw}`)
    await expect(mainAlert(page)).toBeVisible()
  })

  test('rejects an invalid reset token', async ({ page }) => {
    await page.goto('/en/reset-password?token=not-a-real-token-value-abcdefgh')
    await expect(mainAlert(page)).toContainText(/invalid or has expired/i)
  })

  test('rejects a missing reset token', async ({ page }) => {
    await page.goto('/en/reset-password')
    await expect(mainAlert(page)).toBeVisible()
  })
})

test.describe('Email verification', () => {
  test('rejects an invalid verification token', async ({ page }) => {
    await page.goto('/en/verify-email?token=bogus-token-value-1234567890')
    await expect(mainAlert(page)).toContainText(/invalid or has expired/i)
  })
})

// NOTE: rate limiting is verified in `src/lib/__tests__/rate-limit.test.ts`.
// It cannot be tested reliably here because every browser spec shares the same
// client IP, so a burst test would race with the registration specs above.
