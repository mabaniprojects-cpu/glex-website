/**
 * Captures full-page screenshots of the site in its current state.
 * Run with the dev server already listening on :3000.
 */
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const OUT = 'preview'
// No fallback: this signs in as the demo administrator, and a default password
// committed to a public repository is one anybody can read. Plain JS, so it
// cannot share e2e/helpers.ts — the rule is duplicated, the value is not.
const PASSWORD = process.env.SEED_DEMO_PASSWORD
if (!PASSWORD) {
  console.error(
    'SEED_DEMO_PASSWORD is not set, so the signed-in screenshots cannot be captured.\n' +
      'Set it to the value the database was seeded with (see .env).'
  )
  process.exit(1)
}

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()

/** Public pages, captured signed-out. */
const PUBLIC_PAGES = [
  ['01-homepage', '/en', 'desktop'],
  ['02-homepage-arabic-rtl', '/ar', 'desktop'],
  ['03-marketplace', '/en/marketplace', 'desktop'],
  ['04-product-detail', '/en/products/ordinary-portland-cement-type-i-sample', 'desktop'],
  ['05-rfq-builder', '/en/rfq', 'desktop'],
  ['06-tracking', '/en/tracking?ref=GLEX-SHP-2026-000001', 'desktop'],
  ['07-services', '/en/services', 'desktop'],
  ['08-global-network', '/en/network', 'desktop'],
  ['09-resources', '/en/resources', 'desktop'],
  ['10-contact', '/en/contact', 'desktop'],
  ['11-login', '/en/login', 'desktop'],
  ['12-homepage-mobile', '/en', 'mobile'],
]

/** Signed-in pages, with the account to use. */
const PRIVATE_PAGES = [
  ['13-client-dashboard', '/en/dashboard', 'client@glex.demo'],
  ['14-client-rfqs', '/en/dashboard/rfqs', 'client@glex.demo'],
  ['15-client-rfq-detail', '/en/dashboard/rfqs/GLEX-RFQ-2026-000001', 'client@glex.demo'],
  ['16-admin-overview', '/en/admin', 'admin@glex.demo'],
  ['17-admin-rfqs', '/en/admin/rfqs', 'admin@glex.demo'],
  ['18-admin-suppliers', '/en/admin/suppliers', 'admin@glex.demo'],
  ['19-admin-audit', '/en/admin/audit', 'admin@glex.demo'],
]

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

async function shoot(page, name, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60_000 })
  // Let fonts settle and any entrance animation finish.
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`  ${name}`)
}

console.log('public pages:')
for (const [name, path, viewport] of PUBLIC_PAGES) {
  const context = await browser.newContext({ viewport: VIEWPORTS[viewport] })
  const page = await context.newPage()
  await shoot(page, name, path)
  await context.close()
}

console.log('\nauthenticated pages:')
const sessions = new Map()
for (const [name, path, account] of PRIVATE_PAGES) {
  if (!sessions.has(account)) {
    const context = await browser.newContext({ viewport: VIEWPORTS.desktop })
    const page = await context.newPage()
    await page.goto(`${BASE}/en/login`, { waitUntil: 'networkidle' })
    await page.locator('form').getByLabel('Business email').fill(account)
    await page.locator('form').getByLabel('Password').fill(PASSWORD)
    await page.locator('form').getByRole('button', { name: /^log in$/i }).click()
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
    sessions.set(account, page)
  }
  await shoot(sessions.get(account), name, path)
}

await browser.close()
console.log(`\nwrote ${PUBLIC_PAGES.length + PRIVATE_PAGES.length} screenshots to ./${OUT}`)
