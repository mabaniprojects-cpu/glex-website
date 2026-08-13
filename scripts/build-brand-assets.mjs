/**
 * Generates the optimized GLEX brand assets from the single official logo file.
 *
 * The official artwork is NEVER redrawn, recoloured, stretched or distorted here.
 * Every output is either a lossless trim of surrounding empty canvas, a
 * proportional (aspect-preserving) resize, or the untouched logo composited
 * onto a solid brand-palette plate. Run with:  node scripts/build-brand-assets.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SOURCE = process.env.GLEX_LOGO_SOURCE ?? 'C:/Users/ASUS/Downloads/glex (1080 x 1080 px).png'
const OUT = path.resolve(process.cwd(), 'public/brand')

/** Brand palette — must stay in sync with src/styles/brand.css */
const IVORY = { r: 231, g: 234, b: 214, alpha: 1 }
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

async function main() {
  await mkdir(OUT, { recursive: true })

  const src = sharp(SOURCE)
  const meta = await src.metadata()
  console.log(`source: ${meta.width}x${meta.height} channels=${meta.channels} alpha=${meta.hasAlpha}`)

  // 1. Trim the flat white canvas surrounding the artwork, then make that white
  //    fully transparent so the logo sits cleanly on any brand background.
  //    `trim` only removes uniform border pixels — the artwork itself is untouched.
  const trimmed = await sharp(SOURCE)
    .trim({ threshold: 10 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = trimmed
  // Knock out near-white pixels to transparent. The logo contains no white ink,
  // so this only affects background, never the green/gold artwork.
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244) {
      data[i + 3] = 0
    }
  }

  const master = sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  }).png({ compressionLevel: 9 })

  const masterBuf = await master.toBuffer()
  const m = await sharp(masterBuf).metadata()
  console.log(`trimmed master: ${m.width}x${m.height} (aspect ${(m.width / m.height).toFixed(3)})`)

  /** Proportional width-based resize of the transparent master. */
  const byWidth = (w) =>
    sharp(masterBuf).resize({ width: w, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 })

  // 2. The canonical asset required by the brief.
  await writeFile(path.join(OUT, 'glex-logo.png'), masterBuf)

  // 3. Responsive lockups — aspect ratio preserved by `fit: inside`.
  const lockups = [
    ['glex-logo-nav.png', 320],
    ['glex-logo-nav@2x.png', 640],
    ['glex-logo-mobile.png', 200],
    ['glex-logo-mobile@2x.png', 400],
    ['glex-logo-footer.png', 260],
    ['glex-logo-footer@2x.png', 520],
  ]
  for (const [name, width] of lockups) {
    await byWidth(width).toFile(path.join(OUT, name))
  }

  // 4. Dark-background lockup. The logo's deep green (#017A4D) fails contrast on
  //    dark surfaces, so instead of recolouring the mark we place the untouched
  //    logo on a rounded warm-ivory plate — a standard, brand-safe clear-space plate.
  const plateW = 640
  const plateInner = await sharp(masterBuf)
    .resize({ width: plateW - 96, fit: 'inside' })
    .toBuffer()
  const inner = await sharp(plateInner).metadata()
  const plateH = inner.height + 96
  const radius = 32
  const mask = Buffer.from(
    `<svg width="${plateW}" height="${plateH}"><rect x="0" y="0" width="${plateW}" height="${plateH}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  )
  await sharp({
    create: { width: plateW, height: plateH, channels: 4, background: IVORY },
  })
    .composite([
      { input: plateInner, gravity: 'center' },
      { input: mask, blend: 'dest-in' },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'glex-logo-on-dark.png'))

  // 5. Favicons + apple touch icon. Square canvas, logo centred, never stretched.
  const squares = [
    ['favicon-16.png', 16, TRANSPARENT],
    ['favicon-32.png', 32, TRANSPARENT],
    ['favicon-48.png', 48, TRANSPARENT],
    ['icon-192.png', 192, TRANSPARENT],
    ['icon-512.png', 512, TRANSPARENT],
    ['apple-touch-icon.png', 180, IVORY],
  ]
  for (const [name, size, bg] of squares) {
    const pad = Math.round(size * 0.08)
    const art = await sharp(masterBuf)
      .resize({ width: size - pad * 2, height: size - pad * 2, fit: 'inside' })
      .toBuffer()
    await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
      .composite([{ input: art, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, name))
  }

  // 6. Social sharing image (Open Graph 1200x630) on warm ivory.
  const ogArt = await sharp(masterBuf).resize({ width: 760, fit: 'inside' }).toBuffer()
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: IVORY } })
    .composite([{ input: ogArt, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'og-default.png'))

  console.log(`\nwrote assets to ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
