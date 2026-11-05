import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Exercise: turn the White Sand product catalogue PDF into rows of the GLEX
 * supplier sheet.
 *
 *   npx tsx scripts/extract-white-sand.mts <catalogue.txt> <out.json>
 *
 * Input is the plain-text rendering of "White Sand Product Cataloge.pdf".
 *
 * The point of this is to find out what a real supplier catalogue actually
 * contains, so read the output's `missing` counts as the result, not the
 * rows. A catalogue is a marketing document: it names products and describes
 * them well, and it is silent on everything a quotation needs.
 *
 * The Arabic in the source is reversed and glyph-mangled by the PDF text
 * layer, so it is discarded rather than imported wrong. English is clean.
 */

const [, , inputPath, outputPath] = process.argv
if (!inputPath || !outputPath) {
  console.error('usage: extract-white-sand.mts <catalogue.txt> <out.json>')
  process.exit(1)
}

const raw = await readFile(inputPath, 'utf8')

/**
 * The PDF drops its ffi/fl ligatures, leaving U+FFFD mid-word, and its Arabic
 * glyphs come out reversed beyond recovery. Repair the first, discard the
 * second: importing mangled Arabic would be worse than importing none, and
 * "High-e?ciency" would otherwise reach the catalogue verbatim.
 */
const english = raw
  .replace(/e�ciency/g, 'efficiency')
  .replace(/e�cient/g, 'efficient')
  .replace(/�/g, '')
  .replace(/[؀-ۿﭐ-﻿]+/g, ' ')
  .replace(/[ \t]+/g, ' ')

const [tableOfContents, ...bodyParts] = english.split('Scan for data sheet')
const body = bodyParts.join('\n')

/**
 * The six systems the catalogue is organised into, and the GLEX category each
 * maps to. These mappings are a judgement call, not data from the document —
 * GLEX has nine categories and White Sand has six systems, and they do not
 * line up one to one. Worth a human check.
 */
const SECTIONS: { heading: string; glexCategory: string }[] = [
  { heading: 'Tilling Systems', glexCategory: 'Chemicals & Special Items' },
  { heading: 'Waterproofing Systems', glexCategory: 'Insulation & Waterproofing' },
  { heading: 'Concrete Repair', glexCategory: 'Chemicals & Special Items' },
  { heading: 'Finishing Systems', glexCategory: 'Finishing Materials' },
  { heading: 'Admixtures for Mortar and Concrete', glexCategory: 'Chemicals & Special Items' },
  { heading: 'Flooring Systems', glexCategory: 'Finishing Materials' },
]

/** Where each section starts in the contents listing. */
const sectionStarts = SECTIONS.map((section) => ({
  ...section,
  at: tableOfContents.indexOf(section.heading),
})).filter((section) => section.at >= 0)

function sectionFor(position: number): string {
  let current = 'Chemicals & Special Items'
  for (const section of sectionStarts) {
    if (section.at <= position) current = section.glexCategory
  }
  return current
}

/**
 * A product name is a run of capitals. The catalogue prints the model code
 * twice on bilingual lines — "WHITE SAND EFS 50 EFS 50" — so a trailing
 * repeat of the tail is collapsed.
 */
function tidyName(name: string): string {
  const words = name.trim().split(/\s+/)
  for (let take = Math.floor(words.length / 2); take >= 1; take -= 1) {
    const tail = words.slice(-take).join(' ')
    const before = words.slice(-take * 2, -take).join(' ')
    if (tail === before) return words.slice(0, -take).join(' ')
  }
  return words.join(' ')
}

const NAME_PATTERN = /\b([A-Z][A-Z0-9&\-/]*(?:\s+[A-Z0-9&\-/]+){1,5})\b/g

type Row = {
  name: string
  description: string
  category: string
  packaging: string
  packSize: string
  standards: string
  coverage: string
}

const found: Row[] = []
const seen = new Set<string>()

const matches = [...tableOfContents.matchAll(NAME_PATTERN)]

for (const [index, match] of matches.entries()) {
  const name = tidyName(match[1])
  if (name === 'WHITE SAND PRODUCT CATALOG' || name.length < 5) continue
  if (seen.has(name)) continue
  seen.add(name)

  // The description runs from the end of this name to the start of the next.
  const from = match.index! + match[1].length
  const to = matches[index + 1]?.index ?? tableOfContents.length
  const description = tableOfContents
    .slice(from, to)
    .replace(/\s+/g, ' ')
    // Stripping the Arabic leaves its brackets and separators behind.
    .replace(/\(\s*\)/g, '')
    .replace(/\s*,\s*(?=,|$)/g, '')
    .replace(/^[\s.,\-–—]+|[\s.,\-–—]+$/g, '')
    .trim()

  // A model code in mixed case — "Fix B2" — is not caught by the capitals
  // pattern, so it lands at the front of the description, printed twice by
  // the bilingual layout. Fold one copy back into the name where that
  // happens, or the row reads "WHITE SAND" with no model at all.
  const repeated = /^((?:[A-Za-z][A-Za-z0-9]*\s?){1,3}?)\s*\1\s*/.exec(description)
  const model = repeated ? repeated[1].trim() : ''
  const fullName = model ? `${name} ${model.toUpperCase()}` : name
  const cleanDescription = repeated ? description.slice(repeated[0].length).trim() : description

  found.push({
    name: fullName,
    description: cleanDescription,
    category: sectionFor(match.index!),
    ...packagingFor(name),
  })
}

/**
 * Pack details, read from the product's own page in the body.
 *
 * The PDF's text layer emits each page's boxes in layout order rather than
 * reading order, so the data block lands near the name but not reliably
 * before or after it. A window either side is the honest way to read it.
 */
function packagingFor(name: string): { packaging: string; packSize: string; standards: string; coverage: string } {
  const at = body.indexOf(name)
  const blank = { packaging: '', packSize: '', standards: '', coverage: '' }
  if (at < 0) return blank

  const window = body.slice(Math.max(0, at - 1200), at + 1200)

  const container = /\b(Paper Bags?|Bags?|Pails?|Drums?|Sausages?|Cartridges?|Buckets?|Tins?)\b/i.exec(window)
  // Anchored to the container word rather than loose in the window. The
  // coverage line carries a kilogram figure too — "4.0 - 5.5 m2 / 20 Kg" —
  // and reading that one invents a product shipping in 2/20 kg bags.
  const size = container
    ? new RegExp(
        container[1] + '\\s*(\\d+(?:\\s*/\\s*\\d+)*)\\s*(kg|liter|litre|ml|l)\\b',
        'i'
      ).exec(window)
    : null
  const standard = /\b((?:BS\s*)?EN\s*\d{3,5}[^.\n]{0,24})/.exec(window)
  const cover = /≈?\s*([\d.]+\s*[–-]\s*[\d.]+\s*m2[^.\n]{0,18})/.exec(window)

  return {
    packaging: container ? container[1].replace(/\s+/g, ' ') : '',
    packSize: size ? `${size[1].replace(/\s+/g, '')} ${size[2].toLowerCase()}` : '',
    standards: standard ? standard[1].replace(/\s+/g, ' ').trim() : '',
    coverage: cover ? cover[1].replace(/\s+/g, ' ').trim() : '',
  }
}

const missing = {
  price: found.length,
  hsCode: found.length,
  packDimensions: found.length,
  grossWeight: found.filter((r) => !r.packSize).length,
  packaging: found.filter((r) => !r.packaging).length,
  description: found.filter((r) => !r.description).length,
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify({ products: found, missing }, null, 2) + '\n', 'utf8')

console.log(`products extracted: ${found.length}`)
console.log(`  with a description:  ${found.length - missing.description}`)
console.log(`  with a pack type:    ${found.length - missing.packaging}`)
console.log(`  with a pack size:    ${found.length - missing.grossWeight}`)
console.log()
console.log('present in the catalogue for NO product:')
console.log(`  price, HS code, pack length/width/height — ${found.length} of ${found.length} rows blank`)
console.log()
console.log(`wrote ${outputPath}`)
