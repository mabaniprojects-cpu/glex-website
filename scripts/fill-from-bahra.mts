import { readFile } from 'node:fs/promises'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { PRODUCT_COLUMNS } from '../src/lib/import/sheet-columns'
import type { BahraRow } from './extract-bahra.mts'

/**
 * Writes extracted Bahra cables into the GLEX supplier sheet.
 *
 *   npx tsx scripts/fill-from-bahra.mts <rows.json> <out.xlsx>
 *
 * Only what the catalogues state. Nothing is inferred into a cell: a cable
 * with no trustworthy weight gets an empty weight, because an invented one
 * would be quoted and loaded against.
 */

const [, , rowsPath, outPath] = process.argv
if (!rowsPath || !outPath) {
  console.error('usage: fill-from-bahra.mts <rows.json> <out.xlsx>')
  process.exit(1)
}

const { rows } = JSON.parse(await readFile(rowsPath, 'utf8')) as { rows: BahraRow[] }

const TEMPLATE = path.join(process.cwd(), 'public', 'downloads', 'glex-supplier-data-sheet.xlsx')

const book = new ExcelJS.Workbook()
await book.xlsx.readFile(TEMPLATE)

const sheet = book.getWorksheet('Products')!
const columnIndex = new Map(PRODUCT_COLUMNS.map((column, index) => [column.header, index + 1]))

function put(row: ExcelJS.Row, header: string, value: string | number | null) {
  if (value === null || value === '') return
  row.getCell(columnIndex.get(header)!).value = value
}

/** "uPVC" style name built from what the table and its heading say. */
function describe(entry: BahraRow): string {
  const parts = [
    entry.conductor === 'COPPER' ? 'Copper' : 'Aluminium',
    entry.insulation,
    'cable',
    `${entry.crossSectionMm2} mm²`,
  ]
  if (entry.voltage) parts.push(entry.voltage)

  // Core count, screen and armour all distinguish cables that are
  // otherwise the same size and material, and a name that omits any of
  // them collides with a genuinely different product.
  const qualifiers = [entry.cores, entry.screen, entry.armour === 'Unarmoured' ? '' : entry.armour]
    .filter(Boolean)
    .join(', ')
  if (qualifiers) parts.push(`· ${qualifiers}`)

  return parts.join(' ')
}

rows.forEach((entry, index) => {
  const row = sheet.getRow(4 + index)

  // Bahra's own code, in the column that now exists for it. This is the
  // row's identity: 2,531 of these are unique where the composed names
  // collapse to 1,356, so it is what an import matches on.
  put(row, 'Your product code', entry.code)
  put(row, 'Product name (English)', describe(entry))
  put(row, 'Category', 'Electrical & MEP')
  put(row, 'Brand', 'Bahra Cables')
  put(row, 'Manufacturer', 'Bahra Cables Company')
  put(row, 'Country of origin', 'Saudi Arabia')
  put(row, 'Saudi made?', 'Yes')
  put(row, 'Unit of sale', 'Meter')
  put(row, 'Packing method', 'Drum')

  // Weight per kilometre is what the catalogue states; per drum is what
  // ships. Only computed where both figures are known, never guessed.
  const drum = entry.drumMetres ? Number(entry.drumMetres.split('/')[0]) : null
  if (entry.weightKgKm !== null && drum !== null) {
    put(row, 'Pack gross weight (kg)', Math.round((entry.weightKgKm * drum) / 1000))
    put(row, 'Units per pack', drum)
  }

  const notes = [
    entry.weightKgKm !== null ? `${entry.weightKgKm} kg/km` : 'weight not readable from catalogue',
    entry.drumMetres ? `standard drum ${entry.drumMetres} m` : '',
    `${entry.catalogue} p${entry.page}`,
  ].filter(Boolean)

  put(row, 'Notes', notes.join(' · '))
  row.commit()
})

await book.xlsx.writeFile(outPath)

const filled = (header: string) =>
  rows.filter((_, i) => {
    const v = sheet.getRow(4 + i).getCell(columnIndex.get(header)!).value
    return v !== null && v !== undefined && v !== ''
  }).length

console.log(`wrote ${rows.length} rows to ${path.basename(outPath)}\n`)
console.log('column                       filled   blank')
for (const column of PRODUCT_COLUMNS) {
  const n = filled(column.header)
  console.log(
    `  ${column.header.padEnd(26)} ${String(n).padStart(5)}  ${String(rows.length - n).padStart(6)}${n === 0 ? '   <- not in the catalogues' : ''}`
  )
}
