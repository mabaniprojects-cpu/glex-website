import ExcelJS from 'exceljs'
import type { Incoterm, PackingMethod, UnitOfMeasure } from '@prisma/client'
import {
  CATEGORIES,
  CURRENCIES,
  INCOTERM_BY_LABEL,
  PACKING_BY_LABEL,
  PRODUCT_COLUMNS,
  SHEET_LAYOUT,
  UNIT_BY_LABEL,
} from '@/lib/import/sheet-columns'

/**
 * Reads a returned supplier data sheet.
 *
 * Deliberately pure: a buffer in, parsed rows out, no database and no
 * filesystem. Everything hard about reading a spreadsheet someone has edited
 * — a deleted header, a price typed as "2,450 SAR", a category that no longer
 * exists — is decided here, where it can be tested without a fixture
 * database, an upload, or a signed-in user.
 *
 * Nothing is written. The caller shows the result for confirmation first,
 * because a bad import is far more expensive to unpick than to prevent, and a
 * supplier sheet is the one input GLEX does not control the shape of.
 *
 * Two levels of problem, and the distinction matters:
 *   - an ERROR means the row cannot be imported and is skipped
 *   - a WARNING means it imports, with something worth a human glance
 *
 * A missing price is a warning, not an error. Catalogues arrive without
 * prices constantly, and refusing the row would throw away the name, HS code
 * and packing that did arrive.
 */

export type IssueLevel = 'error' | 'warning'

export type Issue = {
  level: IssueLevel
  /** The column header, where the problem belongs to one. */
  column?: string
  message: string
}

export type ParsedProduct = {
  name: string
  nameAr: string | null
  categoryName: string
  brand: string | null
  manufacturer: string | null
  countryOfOrigin: string | null
  isSaudiMade: boolean
  hsCode: string | null
  shortDescription: string | null
  minimumOrderQty: number | null
  leadTimeDays: number | null
  certifications: string[]
  note: string | null
}

export type ParsedPrice = {
  amount: number
  currency: string
  incoterm: Incoterm
  unit: UnitOfMeasure
  validUntil: Date | null
}

export type ParsedPacking = {
  method: PackingMethod
  unit: UnitOfMeasure | null
  unitsPerPack: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  grossWeightKg: number | null
  packsPerPallet: number | null
  isStackable: boolean
}

export type ParsedRow = {
  /** The spreadsheet's own row number, so a message can name it. */
  rowNumber: number
  product: ParsedProduct
  price: ParsedPrice | null
  packing: ParsedPacking | null
  issues: Issue[]
}

export type ParseResult = {
  rows: ParsedRow[]
  /** Problems with the file as a whole rather than with one row. */
  fileIssues: Issue[]
  /** Headers present in the file that this importer does not know. */
  unknownColumns: string[]
}

/** Columns the sheet asks for firmly — a red heading, and a missing-header check. */
const REQUIRED = PRODUCT_COLUMNS.filter((column) => column.required).map((c) => c.header)

/**
 * The only two a row cannot be imported without.
 *
 * Not the same list as the sheet's red headings, and deliberately so. The
 * sheet asks firmly for seven columns because GLEX wants all seven; the
 * parser refuses a row for two, because a name and a category are what a
 * catalogue record structurally needs — the category is a foreign key.
 *
 * Everything else missing is a warning. Rejecting a row over an absent HS
 * code throws away the name, description and packing that did arrive, and a
 * supplier whose catalogue has no HS codes would import nothing at all. That
 * is the same argument already applied to a missing price, and it does not
 * stop being true for the next column.
 */
const CANNOT_IMPORT_WITHOUT = new Set(['Product name (English)', 'Category'])

export async function parseSupplierSheet(data: ArrayBuffer | Buffer): Promise<ParseResult> {
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(data as ArrayBuffer)

  const sheet = book.getWorksheet(SHEET_LAYOUT.productsSheet)
  if (!sheet) {
    return {
      rows: [],
      unknownColumns: [],
      fileIssues: [
        {
          level: 'error',
          message: `No "${SHEET_LAYOUT.productsSheet}" sheet. This does not look like a GLEX supplier data sheet — if the supplier sent their own format, it needs the column mapper instead.`,
        },
      ],
    }
  }

  const { byHeader, unknownColumns, fileIssues } = readHeaders(sheet)
  if (fileIssues.some((issue) => issue.level === 'error')) {
    return { rows: [], fileIssues, unknownColumns }
  }

  const rows: ParsedRow[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < SHEET_LAYOUT.firstDataRow) return

    const read = (header: string) => cellText(row, byHeader.get(header))

    // The worked example ships in every blank sheet. A supplier who typed
    // over it is importing a real product; one who left it is not.
    const first = read(PRODUCT_COLUMNS[0]!.header)
    if (first.toUpperCase().startsWith(SHEET_LAYOUT.examplePrefix)) return

    // Entirely empty rows are the 300 the template ships with, not data.
    const anything = PRODUCT_COLUMNS.some((column) => read(column.header) !== '')
    if (!anything) return

    rows.push(parseRow(rowNumber, read))
  })

  return { rows, fileIssues, unknownColumns }
}

/** Locates each known column, and notices any that have gone missing. */
function readHeaders(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(SHEET_LAYOUT.headerRow)
  const byHeader = new Map<string, number>()
  const seen: string[] = []

  headerRow.eachCell((cell, columnNumber) => {
    const text = String(cell.value ?? '').trim()
    if (!text) return
    seen.push(text)
    byHeader.set(text, columnNumber)
  })

  const known = new Set(PRODUCT_COLUMNS.map((column) => column.header))
  const unknownColumns = seen.filter((header) => !known.has(header))
  const missingRequired = REQUIRED.filter((header) => !byHeader.has(header))

  const fileIssues: Issue[] = []

  if (byHeader.size === 0) {
    fileIssues.push({
      level: 'error',
      message: `Row ${SHEET_LAYOUT.headerRow} of the Products sheet is empty, so there are no column headings to read.`,
    })
  } else if (missingRequired.length > 0) {
    fileIssues.push({
      level: 'error',
      message: `Required column(s) missing or renamed: ${missingRequired.join(', ')}. The sheet cannot be read without them.`,
    })
  }

  for (const header of unknownColumns) {
    fileIssues.push({
      level: 'warning',
      column: header,
      message: `Column "${header}" is not part of the sheet and will be ignored. If the supplier added it, the information in it is being dropped.`,
    })
  }

  return { byHeader, unknownColumns, fileIssues }
}

function parseRow(rowNumber: number, read: (header: string) => string): ParsedRow {
  const issues: Issue[] = []

  const expect = (header: string): string => {
    const value = read(header)
    if (!value) {
      issues.push({
        level: CANNOT_IMPORT_WITHOUT.has(header) ? 'error' : 'warning',
        column: header,
        message: CANNOT_IMPORT_WITHOUT.has(header)
          ? `${header} is required; the row cannot be imported without it.`
          : `${header} is missing. The product imports without it, but someone has to chase it.`,
      })
    }
    return value
  }

  const name = expect('Product name (English)')
  const categoryName = expect('Category')
  const hsCode = expect('HS code')
  expect('Country of origin')
  expect('Unit of sale')

  if (categoryName && !CATEGORIES.includes(categoryName as (typeof CATEGORIES)[number])) {
    issues.push({
      level: 'error',
      column: 'Category',
      message: `"${categoryName}" is not one of the GLEX categories. Someone typed over the dropdown, or the category has been renamed.`,
    })
  }

  // An HS code drives customs classification at the destination; a value that
  // is obviously not one is worth stopping on rather than importing.
  if (hsCode && !/^\d{4}(\.\d{2}){0,2}(\s*\/\s*\d{4}(\.\d{2}){0,2})*$/.test(hsCode)) {
    issues.push({
      level: 'warning',
      column: 'HS code',
      message: `"${hsCode}" does not look like an HS code. Expected something like 7214.20.`,
    })
  }

  const product: ParsedProduct = {
    name,
    nameAr: read('Product name (Arabic)') || null,
    categoryName,
    brand: read('Brand') || null,
    manufacturer: read('Manufacturer') || null,
    countryOfOrigin: read('Country of origin') || null,
    isSaudiMade: read('Saudi made?').toLowerCase() === 'yes',
    hsCode: hsCode || null,
    shortDescription: read('Short description') || null,
    minimumOrderQty: integer(read('Minimum order qty'), 'Minimum order qty', issues),
    leadTimeDays: integer(read('Lead time (days)'), 'Lead time (days)', issues),
    certifications: read('Certifications')
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean),
    note: read('Notes') || null,
  }

  return {
    rowNumber,
    product,
    price: parsePrice(read, issues),
    packing: parsePacking(read, issues),
    issues,
  }
}

/**
 * A price is only taken when it carries the three things that make it mean
 * something: an amount, a delivery basis and the unit it buys. A bare number
 * is worse than no number, because it looks usable in a quotation.
 */
function parsePrice(read: (header: string) => string, issues: Issue[]): ParsedPrice | null {
  const raw = read('Price per unit')
  if (!raw) {
    issues.push({
      level: 'warning',
      column: 'Price per unit',
      message: 'No price. The product imports, but cannot be quoted without going back to the supplier.',
    })
    return null
  }

  const amount = decimal(raw, 'Price per unit', issues)
  if (amount === null) return null

  const incotermLabel = read('Price basis (Incoterm)')
  const incoterm = INCOTERM_BY_LABEL[incotermLabel]
  if (!incoterm) {
    issues.push({
      level: 'error',
      column: 'Price basis (Incoterm)',
      message: incotermLabel
        ? `"${incotermLabel}" is not a known Incoterm.`
        : 'A price needs a delivery basis. EXW and CIF for the same goods are different numbers, so a price without one cannot be compared or quoted.',
    })
    return null
  }

  const unitLabel = read('Unit of sale')
  const unit = UNIT_BY_LABEL[unitLabel]
  if (!unit) {
    issues.push({
      level: 'error',
      column: 'Unit of sale',
      message: unitLabel ? `"${unitLabel}" is not a known unit.` : 'A price needs the unit it is per.',
    })
    return null
  }

  const currency = read('Currency') || 'SAR'
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) {
    issues.push({
      level: 'warning',
      column: 'Currency',
      message: `"${currency}" is outside the offered currencies; importing it as given.`,
    })
  }

  return {
    amount,
    currency,
    incoterm,
    unit,
    validUntil: date(read('Price valid until'), 'Price valid until', issues),
  }
}

function parsePacking(read: (header: string) => string, issues: Issue[]): ParsedPacking | null {
  const label = read('Packing method')
  if (!label) return null

  const method = PACKING_BY_LABEL[label]
  if (!method) {
    issues.push({
      level: 'error',
      column: 'Packing method',
      message: `"${label}" is not one of the packing methods.`,
    })
    return null
  }

  const lengthCm = decimal(read('Pack length (cm)'), 'Pack length (cm)', issues)
  const widthCm = decimal(read('Pack width (cm)'), 'Pack width (cm)', issues)
  const heightCm = decimal(read('Pack height (cm)'), 'Pack height (cm)', issues)
  const grossWeightKg = decimal(read('Pack gross weight (kg)'), 'Pack gross weight (kg)', issues)

  // Partial dimensions cannot be loaded into anything. Say so once, here,
  // rather than letting a container calculation quietly skip the item later.
  const given = [lengthCm, widthCm, heightCm].filter((value) => value !== null).length
  if (given > 0 && given < 3) {
    issues.push({
      level: 'warning',
      column: 'Pack length (cm)',
      message: 'Only some of length, width and height are given. Container loading needs all three.',
    })
  }
  if (given === 0 && grossWeightKg === null) {
    issues.push({
      level: 'warning',
      column: 'Packing method',
      message: 'Packing method given with no dimensions or weight, so this cannot be loaded into a container plan.',
    })
  }

  const unitLabel = read('Unit of sale')

  return {
    method,
    unit: UNIT_BY_LABEL[unitLabel] ?? null,
    unitsPerPack: decimal(read('Units per pack'), 'Units per pack', issues),
    lengthCm,
    widthCm,
    heightCm,
    grossWeightKg,
    packsPerPallet: integer(read('Packs per pallet'), 'Packs per pallet', issues),
    // Absent means stackable, matching the column's default in the template.
    isStackable: read('Stackable?').toLowerCase() !== 'no',
  }
}

// --- Cells -----------------------------------------------------------------

/**
 * One cell as trimmed text.
 *
 * ExcelJS hands back a tagged object for anything that is not a plain scalar —
 * a formula carries its result, rich text its runs, a hyperlink its caption.
 * Reading `String(value)` on those yields "[object Object]", which then
 * imports as a product name.
 */
function cellText(row: ExcelJS.Row, columnNumber: number | undefined): string {
  if (!columnNumber) return ''
  const value = row.getCell(columnNumber).value

  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim()
    if ('result' in value) return String(value.result ?? '').trim()
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim()
    }
    if ('hyperlink' in value) return String(value.hyperlink ?? '').trim()
    return ''
  }

  return String(value).trim()
}

/**
 * A number from a cell someone may have typed into.
 *
 * Thousands separators and a trailing currency or unit are what people
 * actually write. Stripping them is safer than rejecting the row, but an
 * Arabic-Indic numeral or a range ("20-25") is not something to guess at.
 */
function decimal(raw: string, column: string, issues: Issue[]): number | null {
  if (!raw) return null

  const cleaned = raw.replace(/[,\s]/g, '').replace(/(SAR|USD|EUR|kg|cm|mm|m)$/i, '')
  const value = Number(cleaned)

  if (!Number.isFinite(value)) {
    issues.push({
      level: 'error',
      column,
      message: `"${raw}" is not a number.`,
    })
    return null
  }
  if (value < 0) {
    issues.push({ level: 'error', column, message: `"${raw}" is negative.` })
    return null
  }

  return value
}

function integer(raw: string, column: string, issues: Issue[]): number | null {
  const value = decimal(raw, column, issues)
  if (value === null) return null
  if (!Number.isInteger(value)) {
    issues.push({
      level: 'warning',
      column,
      message: `"${raw}" is not a whole number; rounding to ${Math.round(value)}.`,
    })
  }
  return Math.round(value)
}

/**
 * A date, accepting both what Excel stores and what people type.
 *
 * The sheet formats the column as DD/MM/YYYY, so a typed value is read that
 * way round. Reading it as American would turn 03/11 into March and expire a
 * price four months early.
 */
function date(raw: string, column: string, issues: Issue[]): Date | null {
  if (!raw) return null

  // cellText already converted a real Excel date to ISO.
  const iso = Date.parse(raw)
  if (!Number.isNaN(iso) && /^\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(iso)

  const typed = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw)
  if (typed) {
    const [, day, month, year] = typed
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (parsed.getUTCMonth() === Number(month) - 1) return parsed
  }

  issues.push({
    level: 'warning',
    column,
    message: `"${raw}" is not a date this can read. Expected DD/MM/YYYY. Ignoring it.`,
  })
  return null
}
