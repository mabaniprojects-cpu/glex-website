/**
 * Generates the Arabic logo variants.
 *
 *     node scripts/build-arabic-logo.mjs
 *
 * Arabic pages had no Arabic logo: `/ar` rendered the Latin "GLEX / GLOBAL
 * EXPORT HOUSE" lockup, so the one locale with its own wordmark was the one
 * not using it.
 *
 * Output matches the Latin variants exactly in size, so the header and footer
 * need no layout change — only a different file.
 *
 * The source SVGs are hybrids: a vector wordmark plus ONE embedded PNG for the
 * gold roundel (156x156 in the Arabic files). That bitmap is the ceiling on
 * sharpness, which is why these are rendered to fixed PNGs at the sizes the
 * site actually uses rather than shipped as SVG — an SVG would imply it scales
 * indefinitely, and past ~156px of roundel it does not. It also avoids sending
 * 72KB of mostly-base64 to every visitor.
 *
 * `density` is set high so the vector paths rasterise crisply; sharp otherwise
 * renders SVGs at 72dpi and the wordmark comes out soft.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SRC = path.resolve(process.cwd(), 'brand-source')
const OUT = path.resolve(process.cwd(), 'public/brand')

/** Warm ivory plate, matching the Latin onDark variant. */
const IVORY = { r: 231, g: 234, b: 214, alpha: 1 }

/**
 * Dimensions copied from the Latin set in src/components/brand/glex-logo.tsx.
 * The Arabic artwork has its own aspect ratio, so width is honoured and height
 * follows from it — forcing both would distort the wordmark.
 */
const VARIANTS = [
  { name: 'glex-logo-ar-nav', width: 320 },
  { name: 'glex-logo-ar-mobile', width: 200 },
  { name: 'glex-logo-ar-footer', width: 260 },
]

async function render(source, width) {
  // 4x the target width, so the embedded roundel and the vector paths are
  // rasterised well above the output size before downsampling.
  return sharp(source, { density: 600 })
    .resize({ width: width * 4, withoutEnlargement: false })
    .trim({ threshold: 10 })
    .resize({ width })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true })
}

await mkdir(OUT, { recursive: true })

for (const { name, width } of VARIANTS) {
  const { data, info } = await render(path.join(SRC, 'glex-logo-ar.svg'), width)
  await sharp(data).toFile(path.join(OUT, `${name}.png`))
  await sharp((await render(path.join(SRC, 'glex-logo-ar.svg'), width * 2)).data).toFile(
    path.join(OUT, `${name}@2x.png`)
  )
  console.log(`${name}.png  ${info.width}x${info.height}  ${Math.round(data.length / 1024)}KB`)
}

/*
 * On-dark uses the GREEN artwork on an ivory plate, exactly as the Latin
 * variant does — not the knockout file, despite its name.
 *
 * Rendering the knockout onto ivory was the first attempt and it was wrong in
 * a way only visible by looking: its wordmark and half its roundel are white,
 * so both vanished into the plate. The knockout is for placing directly on
 * green; it is kept in brand-source for that, and is unused here.
 */
{
  const width = 640
  const { data, info } = await render(path.join(SRC, 'glex-logo-ar.svg'), width)
  const meta = await sharp(data).metadata()
  const padding = Math.round(width * 0.06)

  await sharp({
    create: {
      width: width + padding * 2,
      height: (meta.height ?? 0) + padding * 2,
      channels: 4,
      background: IVORY,
    },
  })
    .composite([{ input: data, left: padding, top: padding }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'glex-logo-ar-on-dark.png'))

  const out = await sharp(path.join(OUT, 'glex-logo-ar-on-dark.png')).metadata()
  console.log(
    `glex-logo-ar-on-dark.png  ${out.width}x${out.height}  (artwork ${info.width}x${info.height} on ivory)`
  )
}
