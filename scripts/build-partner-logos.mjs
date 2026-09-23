/**
 * Builds the logo assets for the homepage supplier-network strip.
 *
 *     node scripts/build-partner-logos.mjs [source-dir]
 *
 * Writes optimised images to public/partners/ and their display sizes to
 * src/lib/partners.generated.ts. The supplied originals are not committed:
 * eleven of the twelve are PNGs wrapped in an SVG (11–221KB each, only JOTUN
 * is genuine vector), so the useful artefact is the optimised output.
 *
 * Three things here were learned the hard way:
 *
 * 1. Flatten and trim are TWO pipelines. Chained in one, sharp trimmed before
 *    flattening, so JOTUN's white plate survived, the badge stayed a 1:1 square
 *    and rendered at a third of its size. Flattening to a buffer first fixes it
 *    without changing any of the other eleven.
 *
 * 2. Logos are sized by AREA, not height. These range from a 4.5:1 wordmark
 *    (BAHRA) to a 0.84:1 emblem (Al-Ittefaq); at equal height the wide ones
 *    dominate the row. Equal area gives them similar weight, and the caps stop
 *    any single mark outgrowing the strip.
 *
 * 3. Everything is flattened onto WHITE, and the strip must sit on white. Six of
 *    these files carry an opaque white plate — on brand green they show as
 *    boxes, and the Yanbu and Takween marks all but disappear.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SOURCE = process.argv[2] ?? 'C:/GLEX Website/incoming/docs/GLEX Suppliers Partners logos'
const OUT_DIR = path.resolve(process.cwd(), 'public/partners')
const GENERATED = path.resolve(process.cwd(), 'src/lib/partners.generated.ts')

/**
 * `group` marks GLEX's own group companies. They are shown apart from the
 * supplier network rather than inside it: Mabani Al Jazeera is the parent and
 * Takween a sister company, and listing them as "suppliers" beside SABIC and
 * JOTUN would misstate the relationship — the group backing is its own claim.
 *
 * Network order is deliberate, alternating sectors (petrochemicals, cement,
 * electrical, coatings, steel) so the moving strip never shows three steel
 * mills in a row.
 */
const LOGOS = [
  { file: 11, slug: 'mabani-al-jazeera', name: 'Mabani Al Jazeera', group: 'group' },
  { file: 10, slug: 'takween', name: 'Takween Metal Industries', group: 'group' },
  // Supplied later, as square PNGs rather than as part of the numbered set.
  {
    source: 'mabani-projects.png',
    slug: 'mabani-projects',
    name: 'Mabani for Projects',
    group: 'group',
  },
  {
    source: 'swan-properties.png',
    slug: 'swan-properties',
    name: 'Swan Properties',
    group: 'group',
  },

  { file: 9, slug: 'sabic', name: 'SABIC', group: 'network' },
  { file: 1, slug: 'yanbu-cement', name: 'Yanbu Cement', group: 'network' },
  { file: 2, slug: 'alfanar', name: 'alfanar', group: 'network' },
  { file: 6, slug: 'jotun', name: 'Jotun', group: 'network' },
  { file: 4, slug: 'tameer-steel', name: 'Tameer Steel', group: 'network' },
  { file: 12, slug: 'elsewedy', name: 'Elsewedy Industries', group: 'network' },
  { file: 3, slug: 'naffco', name: 'NAFFCO', group: 'network' },
  { file: 8, slug: 'al-ittefaq-steel', name: 'Al-Ittefaq Steel', group: 'network' },
  { file: 7, slug: 'bahra-electric', name: 'BAHRA Electric', group: 'network' },
  { file: 5, slug: 'manarco', name: 'MANARCO', group: 'network' },
]

/** Display box, in CSS pixels. Assets are written at 2x. */
const TARGET_AREA = 120 * 64
const MAX_H = 76
const MAX_W = 190
const SCALE = 2

await mkdir(OUT_DIR, { recursive: true })

const entries = []

for (const logo of LOGOS) {
  // The original twelve arrived as a numbered set; anything added since names
  // its own file, so a new logo does not have to be renamed to fit a sequence.
  const original = await readFile(path.join(SOURCE, logo.source ?? `${logo.file}.svg`))

  const flattened = await sharp(original, { density: 300 })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer()

  const trimmed = await sharp(flattened)
    .trim({ threshold: 12 })
    .png()
    .toBuffer({ resolveWithObject: true })

  const { width: sw, height: sh } = trimmed.info
  const scale = Math.min(Math.sqrt(TARGET_AREA / (sw * sh)), MAX_H / sh, MAX_W / sw)
  const width = Math.max(1, Math.round(sw * scale))
  const height = Math.max(1, Math.round(sh * scale))

  const file = `${logo.slug}.webp`
  // Lossless: several marks carry fine text (Takween, Elsewedy) that lossy
  // compression smears, and at this size the lossless file is still tiny.
  const info = await sharp(trimmed.data)
    .resize(width * SCALE, height * SCALE)
    .webp({ lossless: true })
    .toFile(path.join(OUT_DIR, file))

  entries.push({ ...logo, src: `/partners/${file}`, width, height })
  console.log(
    `${logo.slug.padEnd(20)} ${String(width).padStart(3)}x${String(height).padEnd(3)}  ${Math.round(info.size / 1024)}KB`
  )
}

const body = entries
  .map(
    (e) =>
      `  { slug: '${e.slug}', name: '${e.name}', group: '${e.group}', src: '${e.src}', width: ${e.width}, height: ${e.height} },`
  )
  .join('\n')

await writeFile(
  GENERATED,
  `// GENERATED by scripts/build-partner-logos.mjs — do not edit by hand.
//
// width and height are the display size in CSS pixels; the image files are
// written at ${SCALE}x that for high-density screens.

export type PartnerGroup = 'group' | 'network'

export type PartnerLogo = {
  readonly slug: string
  readonly name: string
  readonly group: PartnerGroup
  readonly src: string
  readonly width: number
  readonly height: number
}

export const PARTNER_LOGOS: readonly PartnerLogo[] = [
${body}
]
`
)

console.log(`\n${entries.length} logos -> public/partners/, sizes -> src/lib/partners.generated.ts`)
