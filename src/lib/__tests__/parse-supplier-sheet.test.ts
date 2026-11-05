import ExcelJS from 'exceljs'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseSupplierSheet, type ParseResult } from '@/lib/import/parse-supplier-sheet'
import { PRODUCT_COLUMNS, SHEET_LAYOUT } from '@/lib/import/sheet-columns'

/**
 * Reading a sheet a supplier has filled in and emailed back.
 *
 * Every case here is something a real returned sheet does, not a synthetic
 * edge: a price typed with its currency attached, a dropdown typed over by
 * hand, the worked example left in place, a date in the British order, a
 * column renamed by someone tidying up.
 *
 * The parser never writes, so these run without a database.
 */

/** Builds a workbook shaped like the template, with the given data rows. */
async function sheetWith(
  rows: Record<string, string | number>[],
  options: { headers?: string[]; keepExample?: boolean } = {}
): Promise<ParseResult> {
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet(SHEET_LAYOUT.productsSheet)

  const headers = options.headers ?? PRODUCT_COLUMNS.map((column) => column.header)
  sheet.getRow(1).getCell(1).value = 'instruction banner'
  headers.forEach((header, index) => {
    sheet.getRow(SHEET_LAYOUT.headerRow).getCell(index + 1).value = header
  })

  if (options.keepExample) {
    sheet.getRow(SHEET_LAYOUT.exampleRow).getCell(1).value = 'EXAMPLE — Steel Rebar B500B, 16mm'
  }

  rows.forEach((values, index) => {
    const row = sheet.getRow(SHEET_LAYOUT.firstDataRow + index)
    for (const [header, value] of Object.entries(values)) {
      const column = headers.indexOf(header)
      if (column >= 0) row.getCell(column + 1).value = value
    }
  })

  return parseSupplierSheet(await book.xlsx.writeBuffer())
}

/** A row with everything required, for tests that vary one thing. */
const COMPLETE = {
  'Product name (English)': 'Steel Rebar B500B, 16mm',
  Category: 'Steel & Metals',
  'Country of origin': 'Saudi Arabia',
  'Saudi made?': 'Yes',
  'HS code': '7214.20',
  'Unit of sale': 'Ton',
  'Packing method': 'Bundle',
  'Price per unit': 2450,
  Currency: 'SAR',
  'Price basis (Incoterm)': 'FOB - Free On Board',
}

describe('a sheet that was filled in properly', () => {
  let result: ParseResult

  beforeAll(async () => {
    result = await sheetWith([COMPLETE])
  })

  it('reads the product', () => {
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.product.name).toBe('Steel Rebar B500B, 16mm')
    expect(result.rows[0]!.product.isSaudiMade).toBe(true)
  })

  it('reads the price with its basis and unit', () => {
    expect(result.rows[0]!.price).toMatchObject({
      amount: 2450,
      currency: 'SAR',
      incoterm: 'FOB',
      unit: 'TON',
    })
  })

  it('maps the packing label to the enum', () => {
    expect(result.rows[0]!.packing?.method).toBe('BUNDLE')
  })

  it('raises nothing that needs a human', () => {
    expect(result.rows[0]!.issues.filter((i) => i.level === 'error')).toEqual([])
  })
})

describe('rows that are not data', () => {
  it('skips the worked example the template ships with', async () => {
    const result = await sheetWith([COMPLETE], { keepExample: true })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.product.name).toBe('Steel Rebar B500B, 16mm')
  })

  it('skips the blank rows below the data', async () => {
    const result = await sheetWith([COMPLETE, {}, {}])
    expect(result.rows).toHaveLength(1)
  })
})

describe('a price that cannot be trusted', () => {
  it('refuses a price with no Incoterm, rather than importing a bare number', async () => {
    const { 'Price basis (Incoterm)': _omitted, ...noBasis } = COMPLETE
    const result = await sheetWith([noBasis])

    expect(result.rows[0]!.price).toBeNull()
    expect(result.rows[0]!.issues).toContainEqual(
      expect.objectContaining({ level: 'error', column: 'Price basis (Incoterm)' })
    )
  })

  it('refuses a price with no unit', async () => {
    const { 'Unit of sale': _omitted, ...noUnit } = COMPLETE
    const result = await sheetWith([noUnit])
    expect(result.rows[0]!.price).toBeNull()
  })

  it('still imports the product when the price is missing', async () => {
    const { 'Price per unit': _omitted, ...noPrice } = COMPLETE
    const result = await sheetWith([noPrice])

    expect(result.rows[0]!.product.name).toBe('Steel Rebar B500B, 16mm')
    expect(result.rows[0]!.price).toBeNull()
    expect(result.rows[0]!.issues.some((i) => i.level === 'error')).toBe(false)
  })

  it('reads a price typed with separators and a currency', async () => {
    const result = await sheetWith([{ ...COMPLETE, 'Price per unit': '2,450 SAR' }])
    expect(result.rows[0]!.price?.amount).toBe(2450)
  })

  it('rejects a price that is not a number at all', async () => {
    const result = await sheetWith([{ ...COMPLETE, 'Price per unit': 'on request' }])
    expect(result.rows[0]!.price).toBeNull()
    expect(result.rows[0]!.issues).toContainEqual(
      expect.objectContaining({ level: 'error', column: 'Price per unit' })
    )
  })
})

describe('what stops a row, and what only flags it', () => {
  // The sheet asks firmly for seven columns. The parser refuses a row for
  // two. Conflating them means a supplier whose catalogue carries no HS codes
  // imports nothing at all — which is what the White Sand sheet did until
  // this was separated.
  it.each([
    ['Product name (English)', 'error'],
    ['Category', 'error'],
    ['HS code', 'warning'],
    ['Country of origin', 'warning'],
    ['Unit of sale', 'warning'],
  ])('a missing %s is an %s', async (column, level) => {
    const incomplete = { ...COMPLETE }
    delete (incomplete as Record<string, unknown>)[column]
    const result = await sheetWith([incomplete])

    expect(result.rows[0]!.issues).toContainEqual(expect.objectContaining({ column, level }))
  })

  it('still imports a product with no HS code', async () => {
    const { 'HS code': _omitted, ...noCode } = COMPLETE
    const result = await sheetWith([noCode])

    expect(result.rows[0]!.product.name).toBe('Steel Rebar B500B, 16mm')
    expect(result.rows[0]!.issues.some((i) => i.level === 'error')).toBe(false)
  })
})

describe('dropdowns someone typed over', () => {
  it('refuses a category that is not ours', async () => {
    const result = await sheetWith([{ ...COMPLETE, Category: 'Steel and Metals' }])
    expect(result.rows[0]!.issues).toContainEqual(
      expect.objectContaining({ level: 'error', column: 'Category' })
    )
  })

  it('refuses an unknown packing method', async () => {
    const result = await sheetWith([{ ...COMPLETE, 'Packing method': 'in bags' }])
    expect(result.rows[0]!.packing).toBeNull()
  })
})

describe('dates', () => {
  it('reads DD/MM/YYYY the British way round', async () => {
    const result = await sheetWith([{ ...COMPLETE, 'Price valid until': '03/11/2027' }])
    // 3 November, not 11 March — reading it American expires a price early.
    expect(result.rows[0]!.price?.validUntil?.toISOString()).toMatch(/^2027-11-03/)
  })

  it('warns and carries on when the date is unreadable', async () => {
    const result = await sheetWith([{ ...COMPLETE, 'Price valid until': 'end of Q1' }])
    expect(result.rows[0]!.price?.validUntil).toBeNull()
    expect(result.rows[0]!.price?.amount).toBe(2450)
  })
})

describe('packing that cannot be loaded', () => {
  it('warns when only some dimensions are given', async () => {
    const result = await sheetWith([
      { ...COMPLETE, 'Pack length (cm)': 120, 'Pack width (cm)': 60 },
    ])
    expect(result.rows[0]!.issues).toContainEqual(
      expect.objectContaining({ level: 'warning', column: 'Pack length (cm)' })
    )
  })

  it('warns when a packing method arrives with no measurements at all', async () => {
    const result = await sheetWith([COMPLETE])
    expect(result.rows[0]!.issues.some((i) => i.message.includes('container plan'))).toBe(true)
  })
})

describe('a file that is not the sheet', () => {
  it('says so when the Products sheet is absent', async () => {
    const book = new ExcelJS.Workbook()
    book.addWorksheet('Sheet1')
    const result = await parseSupplierSheet(await book.xlsx.writeBuffer())

    expect(result.rows).toEqual([])
    expect(result.fileIssues[0]!.level).toBe('error')
    expect(result.fileIssues[0]!.message).toContain('column mapper')
  })

  it('stops when a required column has been renamed', async () => {
    const headers = PRODUCT_COLUMNS.map((c) =>
      c.header === 'HS code' ? 'HS Code (customs)' : c.header
    )
    const result = await sheetWith([COMPLETE], { headers })

    expect(result.rows).toEqual([])
    expect(result.fileIssues[0]!.message).toContain('HS code')
  })

  it('warns about a column the supplier added, rather than ignoring it silently', async () => {
    const headers = [...PRODUCT_COLUMNS.map((c) => c.header), 'Discount %']
    const result = await sheetWith([COMPLETE], { headers })

    expect(result.unknownColumns).toEqual(['Discount %'])
    expect(result.fileIssues).toContainEqual(
      expect.objectContaining({ level: 'warning', column: 'Discount %' })
    )
  })
})

describe('every dropdown in the sheet can be read back', () => {
  // The generator and the parser share one module, but the lists and the enum
  // maps are separate objects in it. A label added to one and not the other
  // produces a sheet a supplier can fill and the importer silently rejects.
  it('has a mapping for every offered value', async () => {
    const { UNITS, INCOTERMS, PACKING_METHODS, UNIT_BY_LABEL, INCOTERM_BY_LABEL, PACKING_BY_LABEL } =
      await import('@/lib/import/sheet-columns')

    expect(UNITS.filter((label) => !UNIT_BY_LABEL[label])).toEqual([])
    expect(INCOTERMS.filter((label) => !INCOTERM_BY_LABEL[label])).toEqual([])
    expect(PACKING_METHODS.filter((label) => !PACKING_BY_LABEL[label])).toEqual([])
  })
})
