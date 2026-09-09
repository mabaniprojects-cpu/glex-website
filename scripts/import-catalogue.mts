import 'dotenv/config'
import { Locale } from '@prisma/client'
import { db } from '../src/lib/db'
import { ALL_PRODUCTS, CATALOGUE } from './catalogue-data'

/**
 * Imports the catalogue from the company portfolio.
 *
 *   npx tsx scripts/import-catalogue.mts            # dry run
 *   npx tsx scripts/import-catalogue.mts --confirm  # apply
 *
 * Idempotent: everything is keyed on slug, so a second run updates rather than
 * duplicates, and re-running after a correction to catalogue-data.ts is safe.
 *
 * It deliberately does NOT delete. A product removed from the data file is left
 * in place and reported, because by the time this runs a second time the
 * catalogue may have been edited through the admin portal, and a script that
 * silently deletes an admin's work is worse than one that leaves a stale row
 * for a human to look at.
 *
 * Products are created with no supplier and no images. Both are admin-portal
 * work: a supplier record has to exist and be verified before a product can
 * honestly be attributed to it.
 */

const confirmed = process.argv.includes('--confirm')

const existingCategories = await db.category.findMany({
  where: { slug: { in: CATALOGUE.map((c) => c.slug) } },
  select: { slug: true },
})
const existingProducts = await db.product.findMany({
  where: { slug: { in: ALL_PRODUCTS.map((p) => p.slug) } },
  select: { slug: true },
})

const knownCategories = new Set(existingCategories.map((c) => c.slug))
const knownProducts = new Set(existingProducts.map((p) => p.slug))

const [totalCategories, totalProducts] = [CATALOGUE.length, ALL_PRODUCTS.length]
const newCategories = CATALOGUE.filter((c) => !knownCategories.has(c.slug)).length
const newProducts = ALL_PRODUCTS.filter((p) => !knownProducts.has(p.slug)).length

console.log(
  `Categories: ${totalCategories} in file — ${newCategories} new, ${totalCategories - newCategories} already present`
)
console.log(
  `Products:   ${totalProducts} in file — ${newProducts} new, ${totalProducts - newProducts} already present`
)

// Anything already in the catalogue that this file does not describe. Reported,
// never touched.
const untouched = await db.product.count({
  where: { slug: { notIn: ALL_PRODUCTS.map((p) => p.slug) }, deletedAt: null },
})
if (untouched > 0) {
  console.log(`\n${untouched} existing product(s) are not in this file and will be left alone.`)
}

if (!confirmed) {
  console.log('\nDry run — nothing was written. Re-run with --confirm to apply.')
  await db.$disconnect()
  process.exit(0)
}

let categoriesWritten = 0
let productsWritten = 0

for (const [index, category] of CATALOGUE.entries()) {
  const record = await db.category.upsert({
    where: { slug: category.slug },
    create: {
      slug: category.slug,
      name: category.name,
      sortOrder: index,
      isActive: true,
    },
    // Only the fields this file owns. An icon or image set through the admin
    // portal must survive a re-import.
    update: { name: category.name, sortOrder: index },
    select: { id: true },
  })
  categoriesWritten++

  await db.categoryTranslation.upsert({
    where: { categoryId_locale: { categoryId: record.id, locale: Locale.ar } },
    create: { categoryId: record.id, locale: Locale.ar, name: category.nameAr },
    update: { name: category.nameAr },
  })

  for (const [position, product] of category.products.entries()) {
    const saved = await db.product.upsert({
      where: { slug: product.slug },
      create: {
        slug: product.slug,
        name: product.name,
        hsCode: product.hsCode,
        categoryId: record.id,
        // Every item in the portfolio is a Saudi export line.
        isSaudiMade: true,
        countryOfOrigin: 'SA',
        isVisible: true,
        // The first item of each category seeds the featured rail; adjust in
        // the admin portal once there is a real editorial view.
        isFeatured: position === 0,
      },
      update: { name: product.name, hsCode: product.hsCode, categoryId: record.id },
      select: { id: true },
    })
    productsWritten++

    await db.productTranslation.upsert({
      where: { productId_locale: { productId: saved.id, locale: Locale.ar } },
      create: { productId: saved.id, locale: Locale.ar, name: product.nameAr },
      update: { name: product.nameAr },
    })
  }
}

console.log(`\nWrote ${categoriesWritten} categories and ${productsWritten} products.`)
console.log('Arabic names written; de/fr/zh-CN fall back to the English name by design.')

await db.$disconnect()
