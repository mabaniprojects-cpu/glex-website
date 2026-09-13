import 'dotenv/config'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'
import { db } from '../src/lib/db'
import { ALL_PRODUCTS } from './catalogue-data'

/**
 * Converts supplied product photographs and attaches them to the catalogue.
 *
 *   npx tsx scripts/import-product-images.mts <source-dir> [--mode contain|crop-top] [--confirm]
 *
 * Images are written into `public/products/` and served same-origin, because
 * `next.config.ts` sets `remotePatterns: []` — next/image will not load an
 * external host.
 *
 * Output is SQUARE. The first imported set was 4:3 cutouts; the branded set is
 * 3:4 portrait, and putting a portrait image in a 4:3 card keeps only 56% of
 * its height. Both automatic crops were tested and both clipped something — the
 * top of the switchgear under one, the base of the air conditioner under the
 * other. A square keeps 75%, and anchored 8% from the top it fitted all 43
 * supplied images with nothing lost. Every product image is square so the grid
 * stays uniform whichever set a product's photo came from.
 *
 * Modes:
 *   contain   letterbox into the square on transparency. For cutouts, where the
 *             product must not be cropped at all.
 *   crop-top  cut a square band anchored 8% from the top. For the branded
 *             portrait set, whose slack is empty wall above and plain podium
 *             face below.
 *
 * Filenames are matched to products rather than assumed. Anything unmatched is
 * REPORTED AND FAILS the run — a silently skipped file is a product with no
 * image that nobody notices until a buyer does.
 */

const OUTPUT_DIR = 'public/products'
const SIZE = 1000
const TOP_ANCHOR = 0.08

const args = process.argv.slice(2)
const sourceDir = args.find((a) => !a.startsWith('--'))
const confirmed = args.includes('--confirm')
const modeIndex = args.indexOf('--mode')
const mode = modeIndex >= 0 ? args[modeIndex + 1] : 'contain'

if (!sourceDir) {
  console.error(
    'Usage: npx tsx scripts/import-product-images.mts <source-dir> [--mode contain|crop-top] [--confirm]'
  )
  process.exit(1)
}
if (mode !== 'contain' && mode !== 'crop-top') {
  console.error(`Unknown --mode "${mode}". Use contain or crop-top.`)
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
 * normalised, except this one: the cutout set says "Steel Wire Rod" where the
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
console.log(`Mode:     ${mode}`)
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

async function convert(input: string, output: string) {
  if (mode === 'contain') {
    return sharp(input)
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80, alphaQuality: 90 })
      .toFile(output)
  }

  const { width = 0, height = 0 } = await sharp(input).metadata()
  const side = Math.min(width, height)
  const top = Math.min(Math.round(height * TOP_ANCHOR), height - side)
  const left = Math.round((width - side) / 2)

  return sharp(input)
    .extract({ left, top, width: side, height: side })
    .resize(SIZE, SIZE)
    .webp({ quality: 80 })
    .toFile(output)
}

let written = 0
let attached = 0
let bytes = 0

for (const { file, slug, name } of matched) {
  const url = `/products/${slug}.webp`
  // EXIF is dropped by default, so no camera or location data ships.
  const info = await convert(join(sourceDir, file), join(OUTPUT_DIR, `${slug}.webp`))
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
