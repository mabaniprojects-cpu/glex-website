import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { inspectWorkbook } from '@/lib/import/inspect-workbook'

/**
 * Reading a spreadsheet nobody designed for us.
 *
 * The fixtures here are shaped like real supplier price lists rather than
 * like clean tables: a title block above the headers, a totals row below the
 * data, Arabic column names, and an extra sheet of terms that must not win.
 */

type Cells = (string | number | null)[][]

async function inspect(sheets: Record<string, Cells>) {
  const book = new ExcelJS.Workbook()

  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = book.addWorksheet(name)
    rows.forEach((cells, rowIndex) => {
      cells.forEach((value, columnIndex) => {
        if (value !== null) sheet.getRow(rowIndex + 1).getCell(columnIndex + 1).value = value
      })
    })
  }

  return inspectWorkbook(await book.xlsx.writeBuffer())
}

/** A price list with a title block above the table, as most of them have. */
const TYPICAL: Cells = [
  ['AL-NAJD TRADING — PRICE LIST 2026', null, null, null],
  [null, null, null, null],
  ['Item Description', 'HS Code', 'Unit Price', 'UOM'],
  ['Steel Rebar 16mm', '7214.20', 2450, 'Ton'],
  ['Steel Rebar 18mm', '7214.20', 2460, 'Ton'],
  ['Wire Rod', '7213.91', 2300, 'Ton'],
]

describe('finding the table inside a working document', () => {
  it('skips the title block and finds the real header row', async () => {
    const result = await inspect({ 'Price List': TYPICAL })
    const sheet = result.sheets[0]!

    expect(sheet.headerRow).toBe(3)
    expect(sheet.columns.map((c) => c.header)).toEqual([
      'Item Description',
      'HS Code',
      'Unit Price',
      'UOM',
    ])
  })

  it('shows what each column actually holds', async () => {
    const result = await inspect({ 'Price List': TYPICAL })
    const hsColumn = result.sheets[0]!.columns.find((c) => c.header === 'HS Code')

    expect(hsColumn?.samples).toEqual(['7214.20', '7214.20', '7213.91'])
  })
})

describe('suggesting what a supplier heading means', () => {
  it('reads their words, not ours', async () => {
    const result = await inspect({ 'Price List': TYPICAL })
    const suggestions = Object.fromEntries(
      result.sheets[0]!.columns.map((c) => [c.header, c.suggested])
    )

    expect(suggestions['Item Description']).toBe('Product name (English)')
    expect(suggestions['HS Code']).toBe('HS code')
    expect(suggestions['Unit Price']).toBe('Price per unit')
    expect(suggestions['UOM']).toBe('Unit of sale')
  })

  it('recognises our own template with full confidence', async () => {
    const result = await inspect({
      Products: [
        ['Product name (English)', 'HS code', 'Category'],
        ['Steel Rebar 16mm', '7214.20', 'Steel & Metals'],
      ],
    })

    const columns = result.sheets[0]!.columns
    expect(columns.every((c) => c.confidence === 1)).toBe(true)
  })

  it('reads Arabic headings', async () => {
    const result = await inspect({
      'قائمة الأسعار': [
        ['المنتج', 'السعر', 'الوزن'],
        ['حديد تسليح', 2450, 20],
      ],
    })

    const suggestions = result.sheets[0]!.columns.map((c) => c.suggested)
    expect(suggestions).toContain('Price per unit')
  })

  it('never suggests the same GLEX column twice', async () => {
    const result = await inspect({
      Sheet1: [
        ['Price', 'Unit Price', 'Net Price'],
        [100, 110, 120],
      ],
    })

    const used = result.sheets[0]!.columns.map((c) => c.suggested).filter(Boolean)
    expect(new Set(used).size).toBe(used.length)
  })

  it('reads the abbreviations price lists actually use', async () => {
    const result = await inspect({
      Sheet1: [
        ['Pack', 'Curr.', 'UOM'],
        ['Paper Bags', 'SAR', 'Ton'],
      ],
    })

    const columns = Object.fromEntries(
      result.sheets[0]!.columns.map((c) => [c.header, c.suggested])
    )
    expect(columns['Pack']).toBe('Packing method')
    expect(columns['Curr.']).toBe('Currency')
    expect(columns['UOM']).toBe('Unit of sale')
  })

  it('leaves a heading it cannot place alone, rather than guessing', async () => {
    const result = await inspect({
      Sheet1: [
        ['Zone', 'Rack', 'Bin'],
        ['A', '12', '4'],
      ],
    })

    expect(result.sheets[0]!.columns.every((c) => c.suggested === null)).toBe(true)
  })
})

describe('the values back the guess up, or undermine it', () => {
  it('trusts a Code column holding HS codes', async () => {
    const result = await inspect({
      Sheet1: [
        ['Code', 'Item'],
        ['7214.20', 'Rebar'],
      ],
    })

    const code = result.sheets[0]!.columns.find((c) => c.header === 'Code')
    expect(code?.suggested).toBe('HS code')
  })

  it('does not call a column of part numbers a product name', async () => {
    // The most damaging wrong guess available: "Item Code" matches the word
    // "item", and every row would then import titled with a SKU.
    const result = await inspect({
      Sheet1: [
        ['Item Code', 'Item Description'],
        ['WS-0001', 'SUPER WHITE SAND'],
        ['WS-0002', 'PORCELAIN WHITE SAND'],
      ],
    })

    const columns = Object.fromEntries(
      result.sheets[0]!.columns.map((c) => [c.header, c.suggested])
    )
    expect(columns['Item Code']).toBeNull()
    expect(columns['Item Description']).toBe('Product name (English)')
  })

  it('does not call a column of numbers a product name', async () => {
    const result = await inspect({
      Sheet1: [
        ['Name', 'Qty'],
        [1001, 5],
        [1002, 7],
      ],
    })

    const name = result.sheets[0]!.columns.find((c) => c.header === 'Name')
    expect(name?.suggested).not.toBe('Product name (English)')
  })
})

describe('choosing between sheets', () => {
  it('prefers the product table over a longer sheet of prose', async () => {
    const terms: Cells = [['Terms and Conditions'], ...Array.from({ length: 80 }, (_, i) => [`Clause ${i + 1}`])]

    const result = await inspect({ Terms: terms, Products: TYPICAL })
    expect(result.bestSheet).toBe('Products')
  })

  it('ignores a hidden sheet', async () => {
    const book = new ExcelJS.Workbook()
    const hidden = book.addWorksheet('Lists', { state: 'veryHidden' })
    hidden.getRow(1).getCell(1).value = 'Ton'
    const visible = book.addWorksheet('Products')
    TYPICAL.forEach((cells, r) =>
      cells.forEach((v, c) => {
        if (v !== null) visible.getRow(r + 1).getCell(c + 1).value = v
      })
    )

    const result = await inspectWorkbook(await book.xlsx.writeBuffer())
    expect(result.sheets.map((s) => s.name)).toEqual(['Products'])
  })
})
