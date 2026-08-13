import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { mainRegion, mainStatus } from './helpers'

/**
 * Supplier / distributor registration.
 *
 * The specification is explicit that banking details must never be requested
 * during public registration — that rule gets its own test.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await db.$disconnect()
})

/** Registration is rate-limited per IP; the suite shares one address. */
async function clearRateLimit() {
  await db.rateLimit.deleteMany({ where: { key: { startsWith: 'supplier-register:' } } })
}

function uniqueEmail() {
  return `sup-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

const PASSWORD = 'GlexSupplier9'

test.describe('Supplier registration form', () => {
  test('renders step one and the step indicator', async ({ page }) => {
    await page.goto('/en/register/supplier')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/supplier/i)
    await expect(mainRegion(page).getByText('Step 1 of 6')).toBeVisible()
    await expect(mainRegion(page).getByLabel('Full name')).toBeVisible()
  })

  test('never asks for banking details', async ({ page }) => {
    await page.goto('/en/register/supplier')

    // Walk every step so all fields have rendered at least once.
    const main = mainRegion(page)
    await main.getByLabel('Full name').fill('Banking Check')
    await main.getByLabel('Business email').fill(uniqueEmail())
    await main.getByLabel('Password', { exact: false }).first().fill(PASSWORD)
    await main.getByLabel('Confirm password').fill(PASSWORD)

    const seen: string[] = []
    for (let step = 1; step <= 6; step += 1) {
      seen.push(await main.innerText())
      if (step === 2) {
        await main.getByLabel('Legal company name').fill('Banking Check Co')
        await main.getByLabel('Country').fill('Saudi Arabia')
      }
      if (step < 6) await main.getByRole('button', { name: /^next$/i }).click()
    }

    const everything = seen.join('\n').toLowerCase()
    for (const banned of ['iban', 'swift', 'bank account', 'account number', 'sort code']) {
      expect(everything, `must not request "${banned}"`).not.toContain(banned)
    }

    // And the promise is stated explicitly.
    expect(everything).toContain('never request banking details')
  })

  test('blocks advancing past step one with an invalid email', async ({ page }) => {
    await page.goto('/en/register/supplier')

    const main = mainRegion(page)
    await main.getByLabel('Full name').fill('Invalid Email')
    await main.getByLabel('Business email').fill('not-an-email')
    await main.getByLabel('Password', { exact: false }).first().fill(PASSWORD)
    await main.getByLabel('Confirm password').fill(PASSWORD)
    await main.getByRole('button', { name: /^next$/i }).click()

    // Still on step one, with the error announced.
    await expect(main.getByText('Step 1 of 6')).toBeVisible()
    await expect(main.getByRole('alert').first()).toBeVisible()
  })

  test('rejects a weak password', async ({ page }) => {
    await page.goto('/en/register/supplier')

    const main = mainRegion(page)
    await main.getByLabel('Full name').fill('Weak Password')
    await main.getByLabel('Business email').fill(uniqueEmail())
    await main.getByLabel('Password', { exact: false }).first().fill('short')
    await main.getByLabel('Confirm password').fill('short')
    await main.getByRole('button', { name: /^next$/i }).click()

    await expect(main.getByText('Step 1 of 6')).toBeVisible()
  })
})

/**
 * Serial: these submissions share one per-IP rate-limit bucket, so parallel
 * workers would race each other clearing and consuming it.
 */
test.describe.serial('Supplier application submission', () => {
  test('creates the organization, profile, contacts and pending user', async ({ page }) => {
    await clearRateLimit()

    const email = uniqueEmail()
    const legalName = `E2E Materials Factory ${Date.now()}`

    await page.goto('/en/register/supplier')
    const main = mainRegion(page)

    // Step 1
    await main.getByLabel('Full name').fill('Supplier Applicant')
    await main.getByLabel('Business email').fill(email)
    await main.getByLabel('Password', { exact: false }).first().fill(PASSWORD)
    await main.getByLabel('Confirm password').fill(PASSWORD)
    await main.getByRole('button', { name: /^next$/i }).click()

    // Step 2
    await main.getByLabel('Legal company name').fill(legalName)
    await main.getByLabel('Country').fill('Saudi Arabia')
    await main.getByLabel('City').fill('Dammam')
    await main.getByLabel('Commercial registration number').fill('1010101010')
    await main.getByRole('button', { name: /^next$/i }).click()

    // Step 3 — pick a category and an Incoterm.
    await main.getByLabel('Cement and Concrete Products').check()
    await main.getByLabel('FOB', { exact: true }).check()
    await main.getByRole('button', { name: /^next$/i }).click()

    // Step 4 — documents are optional.
    await main.getByRole('button', { name: /^next$/i }).click()

    // Step 5 — one contact.
    const salesGroup = main.getByRole('group', { name: 'SALES' })
    await salesGroup.getByLabel('Full name').fill('Sales Lead')
    await salesGroup.getByLabel('Business email').fill(`sales-${Date.now()}@example.com`)
    await main.getByRole('button', { name: /^next$/i }).click()

    // Step 6 — declaration is pre-accepted; submit.
    await expect(main.getByText('Step 6 of 6')).toBeVisible()
    await main.getByRole('button', { name: /submit application/i }).click()

    await expect(mainStatus(page)).toBeVisible({ timeout: 30_000 })
    await expect(mainStatus(page)).toContainText(/application submitted/i)

    // --- The assertions that matter: it reached PostgreSQL ---
    const profile = await db.supplierProfile.findFirst({
      where: { legalName },
      include: { organization: true, contacts: true, categories: true },
    })

    expect(profile, 'supplier profile created').not.toBeNull()
    expect(profile!.status).toBe('SUBMITTED')
    expect(profile!.submittedAt).not.toBeNull()
    expect(profile!.declarationAccepted).toBe(true)
    expect(profile!.declarationAt).not.toBeNull()
    expect(profile!.country).toBe('Saudi Arabia')
    expect(profile!.crNumber).toBe('1010101010')
    expect(profile!.availableIncoterms).toContain('FOB')
    expect(profile!.categories.length).toBeGreaterThan(0)
    expect(profile!.contacts.length).toBeGreaterThan(0)
    expect(profile!.completionPercent).toBeGreaterThan(0)

    expect(profile!.organization.type).toBe('SUPPLIER')

    // The applicant is PENDING until an admin approves.
    const user = await db.user.findUnique({
      where: { email },
      select: { role: true, emailVerified: true, organizationId: true, passwordHash: true },
    })
    expect(user, 'applicant account created').not.toBeNull()
    expect(user!.role).toBe('PENDING_SUPPLIER')
    expect(user!.emailVerified, 'unverified until the link is followed').toBeNull()
    expect(user!.organizationId).toBe(profile!.organizationId)
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$/)

    // A verification token is issued.
    const token = await db.securityToken.findFirst({
      where: { email, purpose: 'EMAIL_VERIFICATION' },
    })
    expect(token, 'verification token issued').not.toBeNull()

    // Clean up.
    await db.user.deleteMany({ where: { email } })
    await db.organization.delete({ where: { id: profile!.organizationId } })
  })

  test('does not reveal that an address is already registered', async ({ page }) => {
    await clearRateLimit()

    await page.goto('/en/register/supplier')
    const main = mainRegion(page)

    // An address that definitely exists.
    await main.getByLabel('Full name').fill('Duplicate Applicant')
    await main.getByLabel('Business email').fill('supplier@glex.demo')
    await main.getByLabel('Password', { exact: false }).first().fill(PASSWORD)
    await main.getByLabel('Confirm password').fill(PASSWORD)
    await main.getByRole('button', { name: /^next$/i }).click()

    await main.getByLabel('Legal company name').fill(`Duplicate Co ${Date.now()}`)
    await main.getByLabel('Country').fill('Saudi Arabia')
    await main.getByRole('button', { name: /^next$/i }).click()
    await main.getByRole('button', { name: /^next$/i }).click()
    await main.getByRole('button', { name: /^next$/i }).click()
    await main.getByRole('button', { name: /^next$/i }).click()
    await main.getByRole('button', { name: /submit application/i }).click()

    // The same success panel appears — no hint that the address was taken.
    await expect(mainStatus(page)).toBeVisible({ timeout: 30_000 })
    await expect(mainStatus(page)).toContainText(/application submitted/i)

    // But no duplicate supplier was created.
    const count = await db.supplierProfile.count({
      where: { legalName: { startsWith: 'Duplicate Co ' } },
    })
    expect(count, 'no profile created for an existing address').toBe(0)
  })
})
