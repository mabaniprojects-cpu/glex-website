/**
 * Generates the white (knockout) logo variants used on the green footer.
 *
 *     node scripts/build-white-logo.mjs
 *
 * Sources are the official knockout artwork in brand-source/: a white
 * wordmark and a gold-and-white roundel on a transparent canvas, drawn for
 * dark backgrounds. They replace the earlier treatment of the green logo on
 * an ivory plate, which read as a sticker on the footer rather than a mark.
 *
 * Output is transparent PNG at 2x the footer's display size, trimmed to the
 * artwork. `density` is high because sharp rasterises SVG at 72dpi by default
 * and the wordmark comes out soft. Trim runs on the transparent canvas, so no
 * flatten step is involved (see build-partner-logos.mjs for why that order
 * matters when there is one).
 */
import path from 'node:path'
import sharp from 'sharp'

const SRC = path.resolve(process.cwd(), 'brand-source')
const OUT = path.resolve(process.cwd(), 'public/brand')

/** Twice the widest footer rendering, so it stays sharp on high-density screens. */
const WIDTH = 640

for (const [source, name] of [
  ['glex-logo-white.svg', 'glex-logo-white.png'],
  ['glex-logo-ar-white.svg', 'glex-logo-ar-white.png'],
]) {
  const trimmed = await sharp(path.join(SRC, source), { density: 600 })
    .resize({ width: WIDTH * 4 })
    .trim({ threshold: 10 })
    .png()
    .toBuffer()

  const info = await sharp(trimmed)
    .resize({ width: WIDTH })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, name))

  console.log(`${name}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)}KB`)
}
