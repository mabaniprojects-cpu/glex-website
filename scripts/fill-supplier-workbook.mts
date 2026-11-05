import { readFile } from 'node:fs/promises'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { PRODUCT_COLUMNS } from './supplier-workbook-data'

/**
 * Fills the blank supplier sheet from extracted rows.
 *
 *   npx tsx scripts/fill-supplier-workbook.mts <rows.json> <out.xlsx> "<Supplier>"
 *
 * The inverse of the importer, and a useful check on it: if the template
 * cannot be filled by a machine it will not be read by one either.
 *
 * Anything the source did not state is left blank rather than guessed. A
 * plausible invented HS code or price is far more dangerous than an empty
 * cell — the empty cell gets queried, the invented one gets quoted.
 */

const [, , rowsPath, outPath, supplierName = 'Supplier', companyPath] = process.argv
if (!rowsPath || !outPath) {
  console.error('usage: fill-supplier-workbook.mts <rows.json> <out.xlsx> "<Supplier>"')
  process.exit(1)
}

type Row = {
  name: string
  description: string
  category: string
  packaging: string
  packSize: string
  standards: string
  coverage: string
}

const { products } = JSON.parse(await readFile(rowsPath, 'utf8')) as { products: Row[] }

const TEMPLATE = path.join(process.cwd(), 'public', 'downloads', 'glex-supplier-data-sheet.xlsx')

const book = new ExcelJS.Workbook()
await book.xlsx.readFile(TEMPLATE)

const sheet = book.getWorksheet('Products')
if (!sheet) throw new Error('The template has no Products sheet.')

const columnIndex = new Map(PRODUCT_COLUMNS.map((column, index) => [column.header, index + 1]))

function put(row: ExcelJS.Row, header: string, value: string | number | null) {
  const index = columnIndex.get(header)
  if (!index) throw new Error(`Unknown column: ${header}`)
  if (value === null || value === '') return
  row.getCell(index).value = value
}

/** Row 3 is the worked example; real data starts at 4. */
const FIRST_DATA_ROW = 4

/**
 * A pack size such as "20 kg" is the gross weight of one bag, which is the
 * one dimension-ish figure the catalogue does state. It goes in the weight
 * column; length, width and height stay empty because nothing in the source
 * gives them.
 */
function weightKg(packSize: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*kg$/i.exec(packSize.trim())
  return match ? Number(match[1]) : null
}

/** The catalogue's own container wording, mapped to the sheet's dropdown. */
function packingMethod(packaging: string): string | null {
  const text = packaging.toLowerCase()
  if (text.includes('bag')) return 'Bag'
  if (text.includes('drum')) return 'Drum'
  if (text.includes('pail') || text.includes('bucket') || text.includes('tin')) return 'Drum'
  if (text.includes('sausage') || text.includes('cartridge')) return 'Carton'
  return null
}

products.forEach((product, index) => {
  const row = sheet.getRow(FIRST_DATA_ROW + index)

  put(row, 'Product name (English)', product.name)
  put(row, 'Category', product.category)
  put(row, 'Brand', 'White Sand')
  put(row, 'Manufacturer', supplierName)
  put(row, 'Country of origin', 'Saudi Arabia')
  put(row, 'Saudi made?', 'Yes')
  put(row, 'Short description', product.description)
  put(row, 'Packing method', packingMethod(product.packaging))
  put(row, 'Pack gross weight (kg)', weightKg(product.packSize))
  put(row, 'Certifications', product.standards)

  // What the catalogue states that the sheet has no column for.
  const extras = [
    product.coverage ? `Coverage: ${product.coverage}` : '',
    product.packSize && !weightKg(product.packSize) ? `Pack size: ${product.packSize}` : '',
  ].filter(Boolean)
  put(row, 'Notes', extras.join(' · '))

  row.commit()
})

// The company tab, where a profile document was supplied. Only values the
// document states; a company's registration number is not something to infer.
if (companyPath) {
  const { fields } = JSON.parse(await readFile(companyPath, 'utf8')) as {
    fields: Record<string, string>
  }
  const company = book.getWorksheet('Company')
  if (!company) throw new Error('The template has no Company sheet.')

  let written = 0
  company.eachRow((row) => {
    const label = String(row.getCell(2).value ?? '').trim()
    const value = fields[label]
    if (value) {
      row.getCell(3).value = value
      written += 1
    }
  })
  console.log(`Company tab: ${written} of ${Object.keys(fields).length} fields written\n`)
}

await book.xlsx.writeFile(outPath)

const filled = (header: string) =>
  products.filter((_, index) => {
    const cell = sheet.getRow(FIRST_DATA_ROW + index).getCell(columnIndex.get(header)!)
    return cell.value !== null && cell.value !== undefined && cell.value !== ''
  }).length

console.log(`Filled ${products.length} rows into ${path.basename(outPath)}\n`)
console.log('column                     filled   blank')
for (const column of PRODUCT_COLUMNS) {
  const count = filled(column.header)
  const flag = count === 0 ? '  <- nothing in the source' : ''
  console.log(
    `  ${column.header.padEnd(24)} ${String(count).padStart(5)}  ${String(products.length - count).padStart(6)}${flag}`
  )
}
