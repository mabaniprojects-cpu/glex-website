import ExcelJS from 'exceljs'
import { PRODUCT_COLUMNS } from '@/lib/import/sheet-columns'

/**
 * Reads a spreadsheet nobody designed for us.
 *
 * A supplier sends the price list they already keep. It has their column
 * names, often in Arabic, a title and a logo above the table, merged cells,
 * blank spacer rows, and a totals row at the bottom. None of that is
 * malformed — it is what a working document looks like — so the job here is
 * to find the table inside it and describe what was found, not to judge it.
 *
 * Nothing is decided finally. The output is a proposal a human confirms,
 * because the cost of a wrong guess is a supplier's prices loaded against
 * the wrong products.
 */

export type DetectedColumn = {
  /** The header text as the supplier wrote it. */
  header: string
  /** 1-based column number in the sheet. */
  index: number
  /** A few values from beneath it, to show what the column actually holds. */
  samples: string[]
  /** Best guess at the GLEX column, or null. Always confirmed by a human. */
  suggested: string | null
  /** 0–1. Shown so a weak guess looks weak. */
  confidence: number
}

export type DetectedSheet = {
  name: string
  rowCount: number
  /** The row the headers were found on. */
  headerRow: number
  /** How many data rows appear to follow. */
  dataRows: number
  columns: DetectedColumn[]
}

export type WorkbookInspection = {
  sheets: DetectedSheet[]
  /** The sheet most likely to hold the products. */
  bestSheet: string | null
}

/** Rows scanned when looking for the header; a title block is rarely deeper. */
const HEADER_SEARCH_DEPTH = 15
const SAMPLE_COUNT = 3

export async function inspectWorkbook(data: ArrayBuffer | Buffer): Promise<WorkbookInspection> {
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(data as ArrayBuffer)

  const sheets: DetectedSheet[] = []

  for (const sheet of book.worksheets) {
    if (sheet.state === 'veryHidden' || sheet.state === 'hidden') continue
    const detected = inspectSheet(sheet)
    if (detected) sheets.push(detected)
  }

  // The sheet with the most mappable columns, not the most rows: a long
  // "Terms and conditions" tab should not beat a short product table.
  const best = [...sheets].sort(
    (a, b) => mappableCount(b) - mappableCount(a) || b.dataRows - a.dataRows
  )[0]

  return { sheets, bestSheet: best?.name ?? null }
}

function mappableCount(sheet: DetectedSheet): number {
  return sheet.columns.filter((column) => column.suggested !== null).length
}

function inspectSheet(sheet: ExcelJS.Worksheet): DetectedSheet | null {
  const headerRow = findHeaderRow(sheet)
  if (!headerRow) return null

  const columns: DetectedColumn[] = []
  const used = new Set<string>()

  // Found once for the sheet, not per column: scanning past banner rows
  // thirteen times over a 3,000-row catalogue is work for nothing.
  const sampleRows = dataRowNumbers(sheet, headerRow, SAMPLE_COUNT)

  sheet.getRow(headerRow).eachCell((cell, index) => {
    const header = text(cell.value)
    if (!header) return

    const samples = sampleBelow(sheet, sampleRows, index)
    const guess = suggestColumn(header, samples, used)
    if (guess.column) used.add(guess.column)

    columns.push({
      header,
      index,
      samples,
      suggested: guess.column,
      confidence: guess.confidence,
    })
  })

  if (columns.length === 0) return null

  return {
    name: sheet.name,
    rowCount: sheet.rowCount,
    headerRow,
    dataRows: Math.max(0, sheet.rowCount - headerRow),
    columns,
  }
}

/**
 * Finds the row the table starts on.
 *
 * Scored rather than assumed: the best header row is the one with the most
 * distinct, short, non-numeric cells that also has data under it. A title
 * ("2026 PRICE LIST") is one long cell and loses; a totals row has numbers
 * and loses; the real header wins on having several distinct words.
 */
function findHeaderRow(sheet: ExcelJS.Worksheet): number | null {
  let best: { row: number; score: number } | null = null
  const depth = Math.min(HEADER_SEARCH_DEPTH, sheet.rowCount)

  for (let rowNumber = 1; rowNumber <= depth; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const values: string[] = []

    row.eachCell((cell) => {
      const value = text(cell.value)
      if (value) values.push(value)
    })

    if (values.length < 2) continue

    const distinct = new Set(values.map((v) => v.toLowerCase())).size
    const wordy = values.filter((v) => v.length <= 60 && !/^-?[\d.,%]+$/.test(v)).length
    const hasDataBelow = rowNumber < sheet.rowCount

    const score = distinct + wordy - (hasDataBelow ? 0 : 10)
    if (!best || score > best.score) best = { row: rowNumber, score }
  }

  return best && best.score >= 3 ? best.row : null
}

/**
 * Which rows below the header are actually data.
 *
 * A sectioned catalogue puts a banner between groups — "Section 01: uPVC
 * pipes and fittings" — as one merged cell across the width. Sampled
 * naively, every column reports that banner as its first value, and since
 * the samples are what support or veto a suggestion, every column is then
 * judged on the same irrelevant string. Found on a real 3,145-row catalogue
 * where all thirteen columns showed identical samples.
 *
 * A banner is a row carrying one distinct value, however many cells repeat
 * it. Real data varies across its columns.
 */
function dataRowNumbers(sheet: ExcelJS.Worksheet, headerRow: number, want: number): number[] {
  const rows: number[] = []

  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    if (rows.length >= want) break

    const values: string[] = []
    sheet.getRow(rowNumber).eachCell((cell) => {
      const value = text(cell.value)
      if (value) values.push(value)
    })

    if (values.length < 2) continue
    if (new Set(values).size < 2) continue

    rows.push(rowNumber)
  }

  return rows
}

function sampleBelow(sheet: ExcelJS.Worksheet, rowNumbers: number[], column: number): string[] {
  const samples: string[] = []

  for (const rowNumber of rowNumbers) {
    const value = text(sheet.getRow(rowNumber).getCell(column).value)
    if (value) samples.push(value.slice(0, 60))
  }

  return samples
}

/**
 * What GLEX column a supplier's heading probably means.
 *
 * Matched on the words in the heading, plus what the column actually
 * contains — "Code" alone is ambiguous, but "Code" above 7214.20 is an HS
 * code. Deliberately conservative: a wrong suggestion a human waves through
 * is worse than no suggestion, because no suggestion gets looked at.
 */
const SYNONYMS: Record<string, string[]> = {
  // The multi-word entries matter: "Item Description" is the commonest
  // heading for a product name in a price list, and on the single words
  // alone it loses to "description" and lands in the wrong column.
  'Product name (English)': [
    'item description',
    'material description',
    'product description',
    'product',
    'item',
    'description',
    'material',
    'name',
    'goods',
  ],
  'Product name (Arabic)': ['arabic', 'عربي', 'الاسم', 'المنتج'],
  Category: ['category', 'group', 'family', 'type', 'الفئة', 'القسم'],
  Brand: ['brand', 'make', 'trademark', 'الماركة'],
  Manufacturer: ['manufacturer', 'maker', 'factory', 'producer', 'المصنع'],
  'Country of origin': ['origin', 'country', 'made in', 'بلد', 'المنشأ'],
  // "code" alone is ambiguous — item code, SKU, HS code — so it is listed
  // here and then settled by what the column actually contains.
  'HS code': ['hs', 'hscode', 'code', 'tariff', 'customs', 'الجمركي'],
  'Short description': ['description', 'details', 'spec', 'specification', 'الوصف'],
  'Unit of sale': ['unit', 'uom', 'measure', 'الوحدة'],
  'Minimum order qty': ['moq', 'minimum', 'min order', 'min qty'],
  'Price per unit': ['price', 'rate', 'cost', 'amount', 'unit price', 'السعر'],
  Currency: ['currency', 'curr', 'ccy', 'العملة'],
  'Price basis (Incoterm)': ['incoterm', 'basis', 'terms', 'delivery term', 'fob', 'cif', 'exw'],
  'Price valid until': ['valid', 'expiry', 'expires', 'until', 'validity'],
  'Lead time (days)': ['lead', 'delivery time', 'production time'],
  'Packing method': ['packing', 'package', 'packaging', 'pack type', 'pack', 'التعبئة'],
  'Units per pack': ['per pack', 'per carton', 'per box', 'qty per'],
  'Pack length (cm)': ['length', 'الطول'],
  'Pack width (cm)': ['width', 'العرض'],
  'Pack height (cm)': ['height', 'الارتفاع'],
  'Pack gross weight (kg)': ['weight', 'gross', 'kg', 'الوزن'],
  'Packs per pallet': ['per pallet', 'pallet'],
  'Stackable?': ['stack'],
  Certifications: ['certif', 'standard', 'iso', 'saso', 'الشهادات'],
  Notes: ['note', 'remark', 'comment', 'ملاحظات'],
}

const KNOWN_HEADERS = new Set(PRODUCT_COLUMNS.map((column) => column.header))

function suggestColumn(
  header: string,
  samples: string[],
  alreadyUsed: Set<string>
): { column: string | null; confidence: number } {
  const normalised = header.trim().toLowerCase()

  // Our own template, unchanged.
  if (KNOWN_HEADERS.has(header.trim()) && !alreadyUsed.has(header.trim())) {
    return { column: header.trim(), confidence: 1 }
  }

  let best: { column: string; score: number } | null = null

  for (const [column, words] of Object.entries(SYNONYMS)) {
    if (alreadyUsed.has(column)) continue

    for (const word of words) {
      if (!normalised.includes(word)) continue

      // A heading that is the word alone is a better match than one that
      // merely contains it: "Price" beats "Price list reference".
      const score = word.length / Math.max(normalised.length, 1)
      if (!best || score > best.score) best = { column, score }
    }
  }

  if (!best) return { column: null, confidence: 0 }

  // Contents can veto outright, not merely lower the score. A heading that
  // matches a GLEX column word-for-word scores 1.0, and no sane weighting
  // lets evidence outvote that — but "Name" above a column of part numbers
  // is not a product name, however the heading reads.
  if (contradicts(best.column, samples)) return { column: null, confidence: 0 }

  const confidence = Math.min(1, best.score + sampleSupport(best.column, samples))
  return confidence >= 0.3 ? { column: best.column, confidence } : { column: null, confidence }
}

const ALL_NUMERIC = (samples: string[]) =>
  samples.length > 0 && samples.every((value) => /^-?[\d.,\s]+$/.test(value))

/**
 * When the values rule a guess out entirely.
 *
 * Only applied where the contradiction is categorical. A missing sample
 * proves nothing, so an empty column never vetoes.
 */
function contradicts(column: string, samples: string[]): boolean {
  if (samples.length === 0) return false

  // Category belongs here too: a sectioned catalogue numbers its sections,
  // and "Sec." above a column of 1, 2, 3 is not a category name.
  const wordColumn = /name|description|Notes|Certifications|Category|Brand|Manufacturer/i.test(
    column
  )

  // Names, descriptions and notes are words.
  if (wordColumn && ALL_NUMERIC(samples)) return true

  /**
   * An identifier is not a name.
   *
   * "Item Code" holding WS-0001 matched the word "item" and was proposed as
   * the product name — the most damaging wrong guess available, because
   * every row would import titled with a part number. A product name has
   * spaces; a SKU has digits and does not.
   */
  if (
    wordColumn &&
    samples.every((value) => !value.includes(' ') && /\d/.test(value) && value.length <= 24)
  ) {
    return true
  }

  // A code column that holds no code-shaped value is somebody else's code.
  if (column === 'HS code' && !samples.some((value) => /\b\d{4}\.?\d{0,2}\b/.test(value))) {
    return true
  }

  // Money and measurements are numbers.
  const numericColumn =
    column === 'Price per unit' ||
    column.startsWith('Pack ') ||
    column === 'Units per pack' ||
    column === 'Packs per pallet' ||
    column === 'Minimum order qty' ||
    column === 'Lead time (days)'

  if (numericColumn && !ALL_NUMERIC(samples)) return true

  return false
}

/** Evidence from the values themselves, worth up to 0.4. */
function sampleSupport(column: string, samples: string[]): number {
  if (samples.length === 0) return 0
  const joined = samples.join(' ')

  if (column === 'HS code') return 0.4
  if (column === 'Currency' && /\b(SAR|USD|EUR|AED)\b/i.test(joined)) return 0.4
  if (column === 'Price basis (Incoterm)' && /\b(EXW|FOB|CIF|CFR|DDP|DAP)\b/i.test(joined)) {
    return 0.4
  }
  if (column === 'Unit of sale' && /\b(ton|kg|piece|pcs|m2|m3|roll|bag)\b/i.test(joined)) return 0.3
  if ((column === 'Price per unit' || column.startsWith('Pack ')) && ALL_NUMERIC(samples)) {
    return 0.3
  }

  return 0
}

/** One cell as text, handling the tagged objects ExcelJS returns. */
function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim()
    if ('result' in value) return String(value.result ?? '').trim()
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim()
    }
    return ''
  }
  return String(value).trim()
}
