import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { NEWS } from './news-data.ts'

/**
 * Pulls the lead photograph from each news item's source post.
 *
 *   node scripts/fetch-news-images.mjs            # list what it would fetch
 *   node scripts/fetch-news-images.mjs --confirm  # download and convert
 *
 * Only runs for posts published by GLEX, by Mabani Al Jazeera, or by someone
 * who works there: those photographs belong to the group. Posts written by
 * people outside it are skipped, because their photographs are theirs — see
 * EXTERNAL below.
 *
 * Output is a 16:9 webp per article in public/news/, at the source image's own
 * width and never wider: LinkedIn serves these at 800px, and enlarging one to
 * 1600 only produces a bigger, softer file.
 */

/** Source posts written by someone outside the group. Not ours to republish. */
const EXTERNAL = new Set(['johnson-controls-arabia-visit', 'logistics-agreement-q-saudi-trading'])

const confirmed = process.argv.includes('--confirm')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

async function leadImageUrl(postUrl) {
  const response = await fetch(postUrl, { headers: { 'user-agent': UA } })
  if (!response.ok) return null

  const html = await response.text()
  const match = html.match(/<meta[^>]+property="og:image"[^>]*content="([^"]+)"/)
  if (!match) return null

  // The meta tag arrives HTML-escaped; the signed query string breaks if it is
  // used as-is.
  return match[1].replace(/&amp;/g, '&')
}

const targets = NEWS.filter((item) => !EXTERNAL.has(item.slug))

console.log(`Articles: ${NEWS.length}`)
console.log(`Ours to use: ${targets.length}`)
console.log(`Skipped (posted by someone outside the group): ${EXTERNAL.size}\n`)

if (!confirmed) {
  for (const item of targets) console.log(`  would fetch  ${item.slug}`)
  for (const slug of EXTERNAL) console.log(`  skip         ${slug}`)
  console.log('\nRe-run with --confirm to download.')
  process.exit(0)
}

await mkdir('public/news', { recursive: true })

for (const item of targets) {
  const imageUrl = await leadImageUrl(item.source)

  if (!imageUrl) {
    console.log(`  no image   ${item.slug}`)
    continue
  }

  const response = await fetch(imageUrl, { headers: { 'user-agent': UA } })
  if (!response.ok) {
    console.log(`  failed ${response.status}  ${item.slug}`)
    continue
  }

  const input = Buffer.from(await response.arrayBuffer())
  const output = `public/news/${item.slug}.webp`
  const { width, height } = await sharp(input).metadata()

  // 16:9, the ratio the article header and the card both crop to, at the
  // source's own width. Attention rather than centre: these are photographs of
  // people at events, and a centre crop takes the middle of a room.
  const targetWidth = Math.min(1600, width ?? 1600)
  const webp = await sharp(input)
    .resize(targetWidth, Math.round((targetWidth * 9) / 16), {
      fit: 'cover',
      position: sharp.strategy.attention,
    })
    .webp({ quality: 82 })
    .toBuffer()

  await writeFile(output, webp)
  console.log(
    `  saved      ${item.slug}  (source ${width}x${height}, ${Math.round(webp.length / 1024)} KB)`
  )
}

console.log('\nDone. Set featuredImage in scripts/news-data.ts for the ones that saved.')
