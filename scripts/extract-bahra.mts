import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Exercise: turns Bahra Cables' catalogue PDFs into rows of the GLEX
 * supplier sheet.
 *
 *   npx tsx scripts/extract-bahra.mts <folder of PDFs> <out.json>
 *
 * Named after the supplier because it knows their table layout, their code
 * format and their section headings. It is a worked example of what PDF
 * extraction costs, not a general parser.
 *
 * What the catalogues give that a price list never does: net weight per
 * kilometre and standard drum lengths, for roughly 2,800 cables. That is
 * precisely the data a container-loading calculation needs and the data
 * suppliers are least likely to type into a form.
 *
 * What they do not give: prices, HS codes, descriptions.
 *
 * Two hazards, both found by running it:
 *
 *   1. The weight column prints OUT OF STEP with the product rows in the
 *      text layer — on a real page the 1.5mm² cable's line carries the
 *      4mm² cable's weight. Weights are therefore paired with products by
 *      ORDER within a page, never by the line they appear on.
 *
 *   2. A weight is only trustworthy if it exceeds the conductor's own mass,
 *      so each page's conductor material is read from its heading first.
 *      Checking an aluminium cable against copper density reports a third
 *      of the range as impossible, and a validator that cries wolf is one
 *      people switch off.
 */

const [, , folder, outputPath] = process.argv
if (!folder || !outputPath) {
  console.error('usage: extract-bahra.mts <folder of PDFs> <out.json>')
  process.exit(1)
}

/** kg per mm² per km. */
const DENSITY = { COPPER: 8.96, ALUMINIUM: 2.7 } as const

export type BahraRow = {
  catalogue: string
  page: number
  code: string
  crossSectionMm2: number
  conductor: 'COPPER' | 'ALUMINIUM'
  insulation: string
  armour: string
  voltage: string
  /** "Single core", "Three cores" — from the table's own sub-heading. */
  cores: string
  /** "Copper wire screened" / "Copper tape screened", likewise. */
  screen: string
  weightKgKm: number | null
  drumMetres: string | null
  /** False when the weight is below the conductor's own mass. */
  weightPlausible: boolean | null
}

const rows: BahraRow[] = []
const skipped: string[] = []

for (const file of readdirSync(folder).filter((name) => name.toLowerCase().endsWith('.pdf'))) {
  const full = path.join(folder, file)

  let text: string
  try {
    text = execFileSync('pdftotext', ['-layout', full, '-'], {
      encoding: 'latin1',
      maxBuffer: 128 * 1024 * 1024,
    })
  } catch {
    skipped.push(`${file} — could not be read`)
    continue
  }

  const before = rows.length
  text.split('\f').forEach((page, index) => readPage(file, index + 1, page))
  if (rows.length === before) skipped.push(`${file} — no cable tables recognised`)
}

function readPage(catalogue: string, page: number, text: string) {
  // Bahra's own product code: eight digits at the start of a line.
  const products = [...text.matchAll(/^(\d{8})\s+([\d.]+)\s*(rmc?|se|sm|re)?\b/gm)]
  if (products.length === 0) return

  // The page heading says what the cable is; every row on it shares that.
  //
  // Everything before the first product code, not a fixed number of
  // characters: a 400-character window cut off the voltage on the pages
  // that carry a cutaway diagram above the table, and a cable without its
  // voltage class is indistinguishable from the same size at another one.
  const heading = text.slice(0, products[0]!.index).toUpperCase()
  const conductor = heading.includes('ALUMINUM') || heading.includes('ALUMINIUM')
    ? 'ALUMINIUM'
    : 'COPPER'

  /**
   * Sub-headings inside the page.
   *
   * A single page prints several tables — "SINGLE CORE | COPPER WIRE
   * SCREENED" then "SINGLE CORE | COPPER TAPE SCREENED" — and the only
   * difference between their rows is the screen. Reading the page heading
   * alone made the two tables' 35mm² cables the same product, so the
   * heavier one's drum weight silently won.
   */
  const sections = [
    ...text.matchAll(
      /^[ \t]*(SINGLE|TWO|THREE|FOUR|FIVE|SEVEN|TWELVE)[ \t]+CORES?[ \t]*\|[ \t]*(COPPER[ \t]+(?:WIRE|TAPE)[ \t]+SCREENED)/gim
    ),
  ].map((match) => ({
    index: match.index,
    cores: sentence(`${match[1]!} core${/^SINGLE$/i.test(match[1]!) ? '' : 's'}`),
    screen: sentence(match[2]!.replace(/[ \t]+/g, ' ')),
  }))

  /** The table a product sits under, or none on a single-table page. */
  const sectionAt = (at: number) =>
    sections.reduce<(typeof sections)[number] | null>(
      (found, section) => (section.index < at ? section : found),
      null
    )

  /**
   * Weights and drum lengths, in printed order.
   *
   * Matched as a pair because a drum length always follows its weight on
   * the same line, which is the only reliable thing about where either sits.
   */
  const pairs = [...text.matchAll(/(\d{2,6})\s+(\d{3,4}(?:\/\d{3,4})?)\s*$/gm)].map((m) => ({
    weight: Number(m[1]),
    drum: m[2]!,
  }))

  products.forEach((match, index) => {
    const crossSectionMm2 = Number(match[2])
    const pair = pairs[index]
    const weight = pair?.weight ?? null
    const section = sectionAt(match.index)

    rows.push({
      catalogue,
      page,
      code: match[1]!,
      crossSectionMm2,
      conductor,
      insulation: heading.includes('XLPE') ? 'XLPE' : heading.includes('LS0H') ? 'LS0H' : 'PVC',
      armour: armourFrom(heading),
      voltage: voltageFrom(heading),
      cores: section?.cores ?? '',
      screen: section?.screen ?? '',
      weightKgKm: weight,
      drumMetres: pair?.drum ?? null,
      // A cable cannot weigh less than the metal inside it.
      weightPlausible:
        weight === null ? null : weight > crossSectionMm2 * DENSITY[conductor] * 0.95,
    })
  })
}

/** "Three Cores" -> "Three cores". */
function sentence(words: string): string {
  const lower = words.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * The cable's voltage class, as "3.6/6 kV".
 *
 * Bahra print the rated value in brackets between the pair and the unit —
 * "3.6/6 (7.2)kV" — so a pattern expecting kV to follow the numbers
 * directly matched nothing on most pages. The bracketed figure is the
 * highest voltage for equipment, derivable from the pair, so it is read
 * and discarded rather than kept.
 */
function voltageFrom(heading: string): string {
  const match = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:\(\s*[\d.]+\s*\)\s*)?K\s?V/.exec(
    heading
  )
  return match ? `${match[1]}/${match[2]} kV` : ''
}

function armourFrom(heading: string): string {
  if (heading.includes('STEEL TAPE ARMOURED')) return 'Steel tape armoured'
  if (heading.includes('STEEL WIRE ARMOURED')) return 'Steel wire armoured'
  if (heading.includes('ALUMINUM WIRE ARMOURED')) return 'Aluminium wire armoured'
  if (heading.includes('UNARMOURED')) return 'Unarmoured'
  return ''
}

// A weight below its own conductor mass means the column slipped on that
// page. Dropping it is right: a wrong weight produces a confident, wrong
// container plan, which is worse than an empty cell someone has to chase.
const suspect = rows.filter((row) => row.weightPlausible === false)
for (const row of suspect) row.weightKgKm = null

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify({ rows, skipped }, null, 2) + '\n', 'utf8')

const withWeight = rows.filter((r) => r.weightKgKm !== null).length

console.log(`catalogues read   : ${readdirSync(folder).filter((n) => n.endsWith('.pdf')).length}`)
console.log(`cable rows found  : ${rows.length}`)
console.log(`  with a weight   : ${withWeight}`)
console.log(`  with a drum     : ${rows.filter((r) => r.drumMetres).length}`)
console.log(`  weights dropped : ${suspect.length} (below their own conductor mass)`)
console.log(`  copper          : ${rows.filter((r) => r.conductor === 'COPPER').length}`)
console.log(`  aluminium       : ${rows.filter((r) => r.conductor === 'ALUMINIUM').length}`)
console.log()
console.log(`catalogues with no cable table (${skipped.length}):`)
skipped.forEach((s) => console.log('   ' + s))
console.log()
console.log(`wrote ${outputPath}`)
