import 'dotenv/config'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'
import { db } from '../src/lib/db'
import { ALL_PRODUCTS } from './catalogue-data'

/**
 * Converts the supplied product photographs and attaches them to the catalogue.
 *
 *   npx tsx scripts/import-product-images.mts <source-dir>            # dry run
 *   npx tsx scripts/import-product-images.mts <source-dir> --confirm  # apply
 *
 * Images are written into `public/products/` and served same-origin, because
 * `next.config.ts` sets `remotePatterns: []` — next/image will not load an
 * external host, and nothing in the app creates ProductImage rows yet, so there
 * is no existing convention to follow.
 *
 * Output is 4:3, not square. Both the card and the product page render images
 * in an `aspect-4/3` box with `object-cover`, so a square source is cropped by
 * a quarter of its height and the product gets clipped. The photograph is
 * letterboxed into 4:3 instead and nothing is lost.
 *
 * Transparency is preserved. The boxes sit on `--color-surface-muted`, so a
 * white-background image would read as a brighter rectangle against the card;
 * a cutout blends, and still works if the surface is ever restyled.
 *
 * Filenames are matched to products rather than assumed. Anything unmatched is
 * REPORTED AND FAILS the run — silently skipping a file means a product quietly
 * has no image, which nobody notices until a buyer does.
 */

const OUTPUT_DIR = 'public/products'
const WIDTH = 1200
const HEIGHT = 900

const [sourceDir, ...flags] = process.argv.slice(2)
const confirmed = flags.includes('--confirm')

if (!sourceDir) {
  console.error('Usage: npx tsx scripts/import-product-images.mts <source-dir> [--confirm]')
  process.exit(1)
}
if (!existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`)
  process.exit(1)
}

/** Lower-case, punctuation to single hyphens — for comparing names to filenames. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * The supplied names match either the slug or the full product name once
 * normalised, except this one: the file says "Steel Wire Rod" where the
 * portfolio says "Wire Rod (Low/High Carbon)".
 */
const ALIASES: Record<string, string> = {
  'steel-wire-rod': 'wire-rod',
}

const bySlug = new Map(ALL_PRODUCTS.map((p) => [p.slug, p]))
const byNormalisedName = new Map(ALL_PRODUCTS.map((p) => [normalise(p.name), p]))

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const files = readdirSync(sourceDir).filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()))

const matched: { file: string; slug: string; name: string }[] = []
const unmatched: string[] = []

for (const file of files) {
  const stem = normalise(basename(file, extname(file)))
  const key = ALIASES[stem] ?? stem
  const product = bySlug.get(key) ?? byNormalisedName.get(key)
  if (product) matched.push({ file, slug: product.slug, name: product.name })
  else unmatched.push(file)
}

const withoutImage = ALL_PRODUCTS.filter((p) => !matched.some((m) => m.slug === p.slug))

console.log(`Source:   ${sourceDir}`)
console.log(`Files:    ${files.length} image(s)`)
console.log(`Matched:  ${matched.length} of ${ALL_PRODUCTS.length} products`)

if (unmatched.length > 0) {
  console.error(`\nUNMATCHED — these files do not correspond to any product:`)
  for (const f of unmatched) console.error(`  ${f}`)
  console.error(`\nRename them, or add an alias in ALIASES. Nothing was written.`)
  await db.$disconnect()
  process.exit(1)
}

if (withoutImage.length > 0) {
  console.log(`\n${withoutImage.length} product(s) have no image in this directory:`)
  for (const p of withoutImage) console.log(`  ${p.slug}`)
  console.log('They keep whatever image they already have.')
}

if (!confirmed) {
  console.log('\nDry run — nothing was written. Re-run with --confirm to apply.')
  await db.$disconnect()
  process.exit(0)
}

mkdirSync(OUTPUT_DIR, { recursive: true })

let written = 0
let attached = 0
let bytes = 0

for (const { file, slug, name } of matched) {
  const url = `/products/${slug}.webp`
  const info = await sharp(join(sourceDir, file))
    .resize(WIDTH, HEIGHT, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    // EXIF is dropped by default, so no camera or location data ships.
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(join(OUTPUT_DIR, `${slug}.webp`))
  written++
  bytes += info.size

  const product = await db.product.findUnique({ where: { slug }, select: { id: true } })
  if (!product) {
    console.warn(`  ${slug}: file converted, but no such product — run import-catalogue first`)
    continue
  }

  // ProductImage has no unique key to upsert on, and the URL is deterministic,
  // so match on it rather than creating a duplicate row on every run.
  const existing = await db.productImage.findFirst({
    where: { productId: product.id, url },
    select: { id: true },
  })
  if (existing) {
    await db.productImage.update({ where: { id: existing.id }, data: { alt: name, sortOrder: 0 } })
  } else {
    await db.productImage.create({ data: { productId: product.id, url, alt: name, sortOrder: 0 } })
  }
  attached++
}

console.log(
  `\nWrote ${written} image(s) to ${OUTPUT_DIR} (${(bytes / 1024 / 1024).toFixed(1)} MB total).`
)
console.log(`Attached ${attached} to products.`)

await db.$disconnect()
