import 'dotenv/config'
import { existsSync } from 'node:fs'
import { db } from '../src/lib/db'
import { ALL_PRODUCTS } from './catalogue-data'

/**
 * Attaches the product images already in public/products/ to the products in
 * a database. It never reads, writes or converts an image file.
 *
 *   npx tsx scripts/attach-product-images.mts            # dry run
 *   npx tsx scripts/attach-product-images.mts --confirm  # apply
 *
 * This exists for production. The images were converted once, locally, and
 * shipped in the repository; what production lacks is only the ProductImage
 * rows. Re-running import-product-images.mts against production would rebuild
 * every file on the operator's machine, and running its first pass alone would
 * overwrite the 38 branded photos with cutouts in the working tree. Separating
 * "which file" from "which row" makes that mistake impossible.
 *
 * Idempotent: a product that already has its /products/<slug>.webp row is left
 * alone. Nothing is deleted.
 */

const confirmed = process.argv.includes('--confirm')

const withFile = ALL_PRODUCTS.filter((p) => existsSync(`public/products/${p.slug}.webp`))
const withoutFile = ALL_PRODUCTS.filter((p) => !existsSync(`public/products/${p.slug}.webp`))

const products = await db.product.findMany({
  where: { slug: { in: withFile.map((p) => p.slug) }, deletedAt: null },
  select: { id: true, slug: true, images: { select: { url: true } } },
})
const bySlug = new Map(products.map((p) => [p.slug, p]))

const notInDatabase = withFile.filter((p) => !bySlug.has(p.slug))
const toAttach = withFile.filter((p) => {
  const row = bySlug.get(p.slug)
  return row !== undefined && !row.images.some((i) => i.url === `/products/${p.slug}.webp`)
})
const alreadyAttached = withFile.length - notInDatabase.length - toAttach.length

console.log(`Image files in public/products: ${withFile.length} of ${ALL_PRODUCTS.length} products`)
console.log(`Already attached:               ${alreadyAttached}`)
console.log(`To attach:                      ${toAttach.length}`)

if (withoutFile.length > 0) {
  console.log(`\nNo image file for: ${withoutFile.map((p) => p.slug).join(', ')}`)
}
if (notInDatabase.length > 0) {
  console.log(
    `\n${notInDatabase.length} product(s) are not in this database yet — run import-catalogue.mts first.`
  )
}

if (!confirmed) {
  console.log('\nDry run — nothing was written. Re-run with --confirm to apply.')
  await db.$disconnect()
  process.exit(0)
}

if (toAttach.length > 0) {
  const created = await db.productImage.createMany({
    data: toAttach.map((p) => ({
      productId: bySlug.get(p.slug)!.id,
      url: `/products/${p.slug}.webp`,
      alt: p.name,
      sortOrder: 0,
    })),
  })
  console.log(`\nAttached ${created.count} image(s).`)
} else {
  console.log('\nNothing to attach.')
}

await db.$disconnect()
