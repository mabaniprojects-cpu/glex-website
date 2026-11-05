import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Supplier prices must never reach a public page.
 *
 * The catalogue says "Price on request" as a commercial decision: GLEX's
 * margin is the difference between what a supplier charges and what a buyer
 * is quoted, and publishing the first gives away the second. `ProductPrice`
 * now exists and is one `include` away from every public product query.
 *
 * That mistake would not look like a bug. The page would render, the tests
 * would pass, and supplier pricing would simply be on the internet — findable
 * in the page source long before anyone noticed. So this is enforced by
 * reading the source of the public data layer rather than by remembering.
 *
 * If a public page ever legitimately needs a price, the decision belongs with
 * GLEX, not with whoever is editing a selector that day. Changing this test is
 * the deliberate step that records it.
 */

const ROOT = path.join(__dirname, '..', '..')

/** Modules that serve unauthenticated visitors. */
const PUBLIC_MODULES = [
  'lib/catalogue.ts',
  'app/[locale]/marketplace/page.tsx',
  'app/[locale]/marketplace/[category]/page.tsx',
  'app/[locale]/products/[slug]/page.tsx',
  // The assistant answers the public; its tools read the catalogue too.
  'lib/ai/tools.ts',
]

/** Anything naming the price tables, in a query or an import. */
const PRICE_REFERENCES = /\bproductPrice\b|\bProductPrice\b|\bprices\s*:/

function read(relative: string): string | null {
  try {
    return readFileSync(path.join(ROOT, relative), 'utf8')
  } catch {
    return null
  }
}

describe('supplier prices stay out of public queries', () => {
  it.each(PUBLIC_MODULES)('%s does not reach ProductPrice', (relative) => {
    const source = read(relative)

    // A module that has been moved or renamed must fail loudly rather than
    // pass by being absent — a silently skipped guard is not a guard.
    expect(source, `${relative} not found; update PUBLIC_MODULES`).not.toBeNull()
    expect(source).not.toMatch(PRICE_REFERENCES)
  })

  it('watches every public module the catalogue is served from', () => {
    // Guards rot when files are added beside the ones they cover. If a new
    // public page starts selecting products, it belongs in the list above.
    const marketplace = read('app/[locale]/marketplace/page.tsx')
    expect(marketplace).toContain('listProducts')
  })
})

describe('the packing table is safe to expose', () => {
  it('carries no commercial figure', () => {
    const schema = readFileSync(path.join(ROOT, '..', 'prisma', 'schema.prisma'), 'utf8')
    const model = /model ProductPacking \{([\s\S]*?)\n\}/.exec(schema)

    expect(model).not.toBeNull()

    // Dimensions and weight are shipping facts a buyer may legitimately see —
    // they are what the container calculator shows them. A price or a cost
    // appearing here would quietly make that public too.
    expect(model![1]).not.toMatch(/\bamount\b|\bprice\b|\bcost\b|\bcurrency\b/i)
  })
})
