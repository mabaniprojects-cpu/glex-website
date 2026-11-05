import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import ExcelJS from 'exceljs'
import {
  CATEGORIES,
  COMPANY_FIELDS,
  CURRENCIES,
  INCOTERMS,
  ORIGINS,
  PACKING_METHODS,
  PRODUCT_COLUMNS,
  UNITS,
  YES_NO,
  type ColumnSpec,
} from '../src/lib/import/sheet-columns'

/**
 * Builds the workbook GLEX sends to a supplier after their account is approved.
 *
 *   npx tsx scripts/build-supplier-workbook.mts
 *
 * Output: public/downloads/glex-supplier-data-sheet.xlsx
 *
 * Generated rather than hand-made, because the dropdown options must match
 * what the importer accepts. Categories change; units and Incoterms are
 * database enums. A template maintained by hand drifts from them within a
 * quarter, and the failure is quiet — a supplier picks a category that no
 * longer exists and the row is rejected weeks later.
 *
 * Conventions, so a supplier can tell at a glance what is wanted:
 *   - green header      a column heading
 *   - yellow cell       you fill this in
 *   - grey italic row   a worked example; delete it or leave it, the importer
 *                       skips any row whose first cell starts with "EXAMPLE"
 *   - a red heading     the column is required
 */

const OUT_DIR = path.join(process.cwd(), 'public', 'downloads')
const OUT_FILE = path.join(OUT_DIR, 'glex-supplier-data-sheet.xlsx')

/** Brand tokens, from src/app/globals.css. */
const GREEN_900 = 'FF0F2B22'
const GREEN_700 = 'FF01603D'
const GREEN_50 = 'FFEEF7F2'
const GOLD_100 = 'FFF9F0D2'
const GOLD_700 = 'FF86671C'
const INPUT_FILL = 'FFFFFDF0'
const GREY = 'FF6B7280'
const RED = 'FFB91C1C'

/** Rows of product entry offered before the supplier has to add their own. */
const PRODUCT_ROWS = 300

const FONT = 'Arial'

const book = new ExcelJS.Workbook()
book.creator = 'GLEX - Global Export House'
book.created = new Date()

// --- Lists -----------------------------------------------------------------
// A hidden sheet holding every dropdown's options. Excel's inline list syntax
// has a 255-character limit that the Incoterm list alone would exceed, so the
// validations point at ranges here instead.

const lists = book.addWorksheet('Lists', { state: 'veryHidden' })

const LIST_COLUMNS: Record<string, readonly string[]> = {
  A: CATEGORIES,
  B: UNITS,
  C: INCOTERMS,
  D: CURRENCIES,
  E: PACKING_METHODS,
  F: ORIGINS,
  G: YES_NO,
}

const rangeFor = new Map<readonly string[], string>()

for (const [column, values] of Object.entries(LIST_COLUMNS)) {
  values.forEach((value, index) => {
    lists.getCell(`${column}${index + 1}`).value = value
  })
  rangeFor.set(values, `Lists!$${column}$1:$${column}$${values.length}`)
}

/** The formula a dropdown points at, or an inline list for anything unlisted. */
function listFormula(values: readonly string[]): string {
  const named = rangeFor.get(values)
  if (named) return named
  return `"${values.join(',')}"`
}

// --- Read me ---------------------------------------------------------------

const readme = book.addWorksheet('Read me', {
  properties: { defaultRowHeight: 18 },
  views: [{ showGridLines: false }],
})

readme.columns = [{ width: 4 }, { width: 34 }, { width: 86 }]

let row = 1

function heading(text: string) {
  const cell = readme.getCell(`B${row}`)
  cell.value = text
  cell.font = { name: FONT, size: 14, bold: true, color: { argb: GREEN_900 } }
  readme.getRow(row).height = 26
  row += 1
}

function para(label: string, text: string) {
  const labelCell = readme.getCell(`B${row}`)
  labelCell.value = label
  labelCell.font = { name: FONT, size: 10, bold: true, color: { argb: GREEN_700 } }
  labelCell.alignment = { vertical: 'top' }

  const textCell = readme.getCell(`C${row}`)
  textCell.value = text
  textCell.font = { name: FONT, size: 10 }
  textCell.alignment = { vertical: 'top', wrapText: true }

  readme.getRow(row).height = Math.max(18, Math.ceil(text.length / 95) * 15 + 6)
  row += 1
}

function spacer() {
  row += 1
}

const title = readme.getCell('B1')
title.value = 'GLEX supplier data sheet'
title.font = { name: FONT, size: 20, bold: true, color: { argb: GREEN_900 } }
readme.getRow(1).height = 32
row = 2

const subtitle = readme.getCell('B2')
subtitle.value = 'Global Export House · exporthouse.com.sa'
subtitle.font = { name: FONT, size: 10, italic: true, color: { argb: GREY } }
row = 4

heading('Why we are asking')
para(
  'The short version',
  'When a buyer asks us for a quotation, the time we spend is almost entirely spent asking suppliers for information we could already have had. This sheet front-loads that. Once we hold it, we can price your products into an enquiry the same day, and your items appear on exporthouse.com.sa where buyers find them directly.'
)
para(
  'What we do with it',
  'Your products are loaded into our catalogue and shown to international buyers. Prices are never published; they are used internally to build quotations. Packing dimensions let us calculate how an order fills a shipping container, so the freight we quote is accurate rather than padded.'
)

spacer()
heading('How to fill it in')
para('1. Company tab', 'Confirm or correct your company details. Some may already be filled from your registration.')
para(
  '2. Products tab',
  'One row per product. There are 300 blank rows — add more if you need them, and leave the rest empty.'
)
para(
  'Yellow cells',
  'Every cell you should type in is shaded pale yellow. Everything else is a heading or a note.'
)
para(
  'Red headings',
  'A column heading in red is required. A row missing one of those cannot be loaded, and we will have to come back to you.'
)
para(
  'Dropdowns',
  'Several columns are dropdown lists — click the cell and a small arrow appears. Please pick from the list rather than typing your own wording, so the data lines up with our system. Country of origin accepts anything if your country is not listed.'
)
para(
  'The example row',
  'Row 3 of the Products tab is a worked example, shown in grey italics. Leave it or delete it — we ignore any row that begins with "EXAMPLE".'
)

spacer()
heading('Things that are easy to get wrong')
para(
  'Price needs an Incoterm',
  'A price with no delivery basis cannot be compared with another supplier\'s. EXW and CIF for the same product can differ by a quarter. Please always set the Price basis column.'
)
para(
  'Dimensions are of the PACK',
  'We need the size and weight of the thing that gets loaded — the bundle, pallet or carton — not the bare product. This is what the container calculation uses.'
)
para(
  'Weight matters as much as size',
  'A 20ft container reaches its weight limit long before it is full of steel. Gross weight per pack, including packing, is the number that decides.'
)
para(
  'HS codes',
  'Please check rather than guess. The HS code drives customs classification at the destination, and a wrong one costs the buyer time at the port.'
)

spacer()
heading('Sending it back')
para('Email', 'Reply to the message that brought you this sheet, or send it to info@exporthouse.com.sa.')
para('File name', 'Please keep the file as .xlsx and put your company name in the file name.')
para(
  'Updating later',
  'Send a fresh copy whenever prices or products change. We replace your previous sheet rather than merging, so always send the complete list, not only what changed.'
)
para('Questions', 'Reply to the same email. A half-filled sheet with a question attached is more useful to us than a delay.')

// --- Company ---------------------------------------------------------------

const company = book.addWorksheet('Company', {
  properties: { defaultRowHeight: 18 },
  views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }],
})

company.columns = [{ width: 4 }, { width: 38 }, { width: 46 }, { width: 52 }]

const companyTitle = company.getCell('B1')
companyTitle.value = 'Your company'
companyTitle.font = { name: FONT, size: 16, bold: true, color: { argb: GREEN_900 } }
company.getRow(1).height = 28

const companyNote = company.getCell('B2')
companyNote.value = 'Fill the yellow column. A heading in red is required.'
companyNote.font = { name: FONT, size: 10, italic: true, color: { argb: GREY } }

const companyHeaderRow = company.getRow(3)
;['', 'Question', 'Your answer', 'Notes'].forEach((text, index) => {
  const cell = companyHeaderRow.getCell(index + 1)
  cell.value = text
  cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_700 } }
  cell.alignment = { vertical: 'middle' }
})
companyHeaderRow.height = 22

COMPANY_FIELDS.forEach((field, index) => {
  const r = 4 + index
  const label = company.getCell(`B${r}`)
  label.value = field.label
  label.font = {
    name: FONT,
    size: 10,
    bold: field.required,
    color: { argb: field.required ? RED : GREEN_900 },
  }
  label.alignment = { vertical: 'middle', wrapText: true }

  const answer = company.getCell(`C${r}`)
  answer.value = null
  answer.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } }
  answer.font = { name: FONT, size: 10 }
  answer.border = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  }

  if (field.list) {
    answer.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [listFormula(field.list)],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Not from the list',
      error: 'Please pick one of the offered values if you can.',
    }
  }

  const note = company.getCell(`D${r}`)
  note.value = field.help ?? `e.g. ${field.example}`
  note.font = { name: FONT, size: 9, italic: true, color: { argb: GREY } }
  note.alignment = { vertical: 'middle', wrapText: true }
})

// --- Products --------------------------------------------------------------

const products = book.addWorksheet('Products', {
  properties: { defaultRowHeight: 16 },
  views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }],
})

products.columns = PRODUCT_COLUMNS.map((column) => ({ width: column.width }))

const intro = products.getCell('A1')
intro.value =
  'One row per product. Yellow cells are yours to fill. A heading in red is required. Row 3 is an example — we ignore it.'
intro.font = { name: FONT, size: 10, italic: true, color: { argb: GOLD_700 } }
products.getRow(1).height = 22
products.mergeCells(1, 1, 1, PRODUCT_COLUMNS.length)
intro.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD_100 } }
intro.alignment = { vertical: 'middle', indent: 1 }

const headerRow = products.getRow(2)
PRODUCT_COLUMNS.forEach((column, index) => {
  const cell = headerRow.getCell(index + 1)
  cell.value = column.header
  cell.font = {
    name: FONT,
    size: 10,
    bold: true,
    color: { argb: column.required ? 'FFFFD9D9' : 'FFFFFFFF' },
  }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_700 } }
  cell.alignment = { vertical: 'middle', wrapText: true, horizontal: 'left', indent: 1 }
  cell.note = {
    texts: [
      { font: { bold: true, size: 9, name: FONT }, text: `${column.header}\n` },
      { font: { size: 9, name: FONT }, text: column.help },
    ],
  }
})
headerRow.height = 34

/** The worked example, in grey italics so nobody mistakes it for their data. */
const exampleRow = products.getRow(3)
PRODUCT_COLUMNS.forEach((column, index) => {
  const cell = exampleRow.getCell(index + 1)
  cell.value = index === 0 ? `EXAMPLE — ${column.example}` : column.example === '' ? null : column.example
  cell.font = { name: FONT, size: 9, italic: true, color: { argb: GREY } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_50 } }
  cell.alignment = { vertical: 'middle', wrapText: false, indent: 1 }
})
exampleRow.height = 18

const FIRST_DATA_ROW = 4
const LAST_DATA_ROW = FIRST_DATA_ROW + PRODUCT_ROWS - 1

for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r += 1) {
  const sheetRow = products.getRow(r)
  sheetRow.height = 16

  PRODUCT_COLUMNS.forEach((column, index) => {
    const cell = sheetRow.getCell(index + 1)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } }
    cell.font = { name: FONT, size: 10 }
    cell.alignment = { vertical: 'middle', indent: 1 }
    cell.border = {
      top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
    }

    applyValidation(cell, column)

    if (column.numeric) cell.numFmt = '#,##0.##'
    if (column.date) cell.numFmt = 'dd/mm/yyyy'
  })
}

function applyValidation(cell: ExcelJS.Cell, column: ColumnSpec) {
  if (column.list) {
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [listFormula(column.list)],
      showErrorMessage: true,
      // A suggestion list warns and lets the typed value stand; a strict one
      // refuses, because the importer cannot map a value it does not know.
      errorStyle: column.listIsSuggestion ? 'warning' : 'stop',
      errorTitle: column.listIsSuggestion ? 'Not in the list' : 'Please pick from the list',
      error: column.listIsSuggestion
        ? 'Not one of the offered values. That is fine if your country is not listed.'
        : 'This column only accepts the values in its dropdown, so that it loads into our system correctly.',
    }
    return
  }

  if (column.numeric) {
    cell.dataValidation = {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Numbers only',
      error: 'Please enter a number with no units or currency symbols. Put any wording in Notes.',
    }
    return
  }

  if (column.date) {
    cell.dataValidation = {
      type: 'date',
      operator: 'greaterThan',
      formulae: [new Date(2020, 0, 1)],
      allowBlank: true,
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Date expected',
      error: 'Please enter a date, for example 31/03/2027.',
    }
  }
}

products.autoFilter = {
  from: { row: 2, column: 1 },
  to: { row: 2, column: PRODUCT_COLUMNS.length },
}

// --- Write -----------------------------------------------------------------

await mkdir(OUT_DIR, { recursive: true })
await book.xlsx.writeFile(OUT_FILE)

const required = PRODUCT_COLUMNS.filter((c) => c.required).length
const dropdowns = PRODUCT_COLUMNS.filter((c) => c.list).length
const pending = PRODUCT_COLUMNS.filter((c) => c.needsSchema).length

console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}`)
console.log(`  sheets:          Read me, Company, Products (+ hidden Lists)`)
console.log(`  product columns: ${PRODUCT_COLUMNS.length} (${required} required, ${dropdowns} dropdowns)`)
console.log(`  company fields:  ${COMPANY_FIELDS.length}`)
console.log(`  blank rows:      ${PRODUCT_ROWS}`)
console.log(`  columns with no database field yet: ${pending}`)

// A machine-readable companion, so the importer and any later tooling read the
// same column definitions the workbook was built from rather than re-deriving
// them from its headers.
const manifest = {
  generatedAt: new Date().toISOString(),
  file: path.basename(OUT_FILE),
  productColumns: PRODUCT_COLUMNS.map((c) => ({
    header: c.header,
    maps: c.maps,
    required: Boolean(c.required),
    list: c.list ?? null,
    needsSchema: Boolean(c.needsSchema),
  })),
  companyFields: COMPANY_FIELDS.map((f) => ({
    label: f.label,
    maps: f.maps,
    required: Boolean(f.required),
  })),
}

await writeFile(
  path.join(OUT_DIR, 'glex-supplier-data-sheet.manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8'
)

console.log(`  manifest:        ${path.basename(OUT_FILE)}.manifest.json`)
