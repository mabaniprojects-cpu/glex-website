import { expect, test, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { demoPassword } from './helpers'

/**
 * Office administration.
 *
 * The claim that matters is that these rows drive the public contact page. An
 * admin form editing a table nothing renders would be worse than no form at
 * all, so the first test follows an edit all the way out to `/en/contact`.
 *
 * The seeded head office is restored afterwards — it carries the real Jeddah
 * address that other specs assert on.
 *
 * The 'last office cannot be deleted' rule is unit-tested instead
 * (src/lib/__tests__/office-guards.test.ts). Exercising it here would mean
 * clicking Delete on the seeded office, and because the guard counts every
 * office in a database shared by both browser projects, a stray row from a
 * parallel run would let that click succeed and wreck the seed for the whole
 * suite.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

/**
 * Removes every office this spec created, whether or not the test reached its
 * own teardown, and restores Jeddah as the head office. Without this a failed
 * run leaves residue that breaks the next one — which is exactly how the
 * single-office assertion below first went red.
 */
test.afterEach(async () => {
  // Gated on the project, because Playwright runs afterEach even for SKIPPED
  // tests. Without this the mobile project's hook deletes the rows the desktop
  // test just created and is still asserting on.
  if (test.info().project.name !== 'desktop-chrome') return

  const strays = await db.office.findMany({
    where: { name: { startsWith: 'E2E Office' } },
    select: { id: true },
  })
  if (strays.length > 0) {
    const ids = strays.map((row) => row.id)
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } })
    await db.office.deleteMany({ where: { id: { in: ids } } })
  }
  await db.office.updateMany({ where: { city: 'Jeddah' }, data: { isPrimary: true } })
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

test.describe('Office administration', () => {
  // Serial, because the afterEach below resets which office is the head office.
  // Run in parallel, that reset lands between another test promoting its own
  // office and asserting there is exactly one head office.
  test.describe.configure({ mode: 'serial' })

  // These assert on database-global state — how many offices exist, and which
  // one is the head office. Both browser projects share a single database, so
  // running them in parallel has each project observing the other's rows and
  // deleting them mid-assertion. The behaviour is server-side and identical at
  // every viewport, so proving it once is enough.
  test.skip(
    () => test.info().project.name !== 'desktop-chrome',
    'database-global assertions; verified once on desktop'
  )

  test('a new office appears on the public contact page', async ({ page }) => {
    const stamp = Date.now()
    const name = `E2E Office Riyadh ${stamp}`

    await signInAsAdmin(page)
    await page.goto('/en/admin/offices')

    await page.getByRole('button', { name: 'New office' }).click()
    await page.getByLabel('Office name').fill(name)
    await page.getByLabel('Address').fill('Olaya Street\nAl Olaya District')
    await page.getByLabel('City').fill('Riyadh')
    await page.getByLabel('Country').fill('Saudi Arabia')
    await page.getByLabel('Telephone').fill('+966 11 000 0000')
    await page.getByRole('button', { name: 'Save' }).click()

    const created = await (async () => {
      await expect
        .poll(async () => db.office.count({ where: { name } }), { timeout: 20_000 })
        .toBe(1)
      return db.office.findFirstOrThrow({ where: { name } })
    })()

    // Stored one line per row, exactly as typed.
    expect(created.addressLines).toEqual(['Olaya Street', 'Al Olaya District'])

    // The assertion that makes this surface real rather than decorative.
    //
    // Retried as a whole: the row is already proven stored above, so what is
    // being waited on here is `revalidatePath` propagating to the contact page.
    // An office that never surfaces still fails.
    await expect(async () => {
      await page.goto('/en/contact')
      const main = page.locator('#main-content')
      await expect(main.getByText(name)).toBeVisible({ timeout: 5_000 })
      await expect(main.getByText('Olaya Street')).toBeVisible({ timeout: 5_000 })

      // The seeded Jeddah office is still there alongside it.
      await expect(main.getByText('King Road Tower')).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 45_000 })

    // Cleanup is handled by afterEach.
  })

  test('only one office can be the head office', async ({ page }) => {
    const stamp = Date.now()
    const name = `E2E Office Dammam ${stamp}`

    await signInAsAdmin(page)
    await page.goto('/en/admin/offices')

    await page.getByRole('button', { name: 'New office' }).click()
    await page.getByLabel('Office name').fill(name)
    await page.getByLabel('City').fill('Dammam')
    await page.getByLabel('Country').fill('Saudi Arabia')
    await page.getByLabel('Head office').check()
    await page.getByRole('button', { name: 'Save' }).click()

    // Wait for THIS office to become primary. Polling the global count instead
    // proves nothing: the seeded Jeddah office already satisfies `=== 1`, so
    // the poll returns before the save has even landed.
    await expect
      .poll(
        async () =>
          (await db.office.findFirst({ where: { name }, select: { isPrimary: true } }))
            ?.isPrimary ?? null,
        { timeout: 20_000 }
      )
      .toBe(true)

    // Only then is the invariant meaningful: promoting one demotes the rest.
    expect(
      await db.office.count({ where: { isPrimary: true } }),
      'exactly one head office'
    ).toBe(1)

    // Restore the seeded head office, which other specs depend on.
    const created = await db.office.findFirstOrThrow({ where: { name } })
    await db.office.delete({ where: { id: created.id } })
    await db.auditLog.deleteMany({ where: { entityId: created.id } })
    await db.office.updateMany({
      where: { city: 'Jeddah' },
      data: { isPrimary: true },
    })
  })

  test('a coordinate left empty is stored as unmapped, not as zero', async ({ page }) => {
    const stamp = Date.now()
    const name = `E2E Office Unmapped ${stamp}`

    await signInAsAdmin(page)
    await page.goto('/en/admin/offices')

    await page.getByRole('button', { name: 'New office' }).click()
    await page.getByLabel('Office name').fill(name)
    await page.getByLabel('City').fill('Jubail')
    await page.getByLabel('Country').fill('Saudi Arabia')
    // Latitude and longitude deliberately left blank.
    await page.getByRole('button', { name: 'Save' }).click()

    await expect
      .poll(async () => db.office.count({ where: { name } }), { timeout: 20_000 })
      .toBe(1)

    const created = await db.office.findFirstOrThrow({ where: { name } })

    // `''` must not coerce to 0 — that would drop a pin in the Gulf of Guinea
    // and look like real data.
    expect(created.latitude).toBeNull()
    expect(created.longitude).toBeNull()

    await db.auditLog.deleteMany({ where: { entityId: created.id } })
    await db.office.delete({ where: { id: created.id } })
  })
})
