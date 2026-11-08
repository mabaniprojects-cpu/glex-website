import { describe, expect, it } from 'vitest'
import type { ParsedRow } from '@/lib/import/parse-supplier-sheet'
import {
  matchKey,
  planImport,
  supplierCodeKey,
  type ExistingProduct,
  type ImportContext,
} from '@/lib/import/plan-import'

/**
 * What an import would do, before it does it.
 *
 * These are the rules that decide whether a supplier's second sheet updates
 * their catalogue or duplicates it, and whether re-sending an unchanged price
 * list fills the price history with noise. Getting them wrong is expensive to
 * unpick, so they are tested here rather than through the database.
 */

function row(overrides: Partial<ParsedRow['product']> & { rowNumber?: number } = {}): ParsedRow {
  const { rowNumber = 4, ...product } = overrides
  return {
    rowNumber,
    product: {
      glexCode: null,
      supplierCode: null,
      name: 'Steel Rebar 16mm',
      nameAr: null,
      categoryName: 'Steel & Metals',
      brand: null,
      manufacturer: null,
      countryOfOrigin: 'Saudi Arabia',
      isSaudiMade: true,
      hsCode: '7214.20',
      shortDescription: null,
      minimumOrderQty: null,
      leadTimeDays: null,
      certifications: [],
      note: null,
      ...product,
    },
    price: null,
    packing: null,
    issues: [],
  }
}

const PRICE = {
  amount: 2450,
  currency: 'SAR',
  incoterm: 'FOB' as const,
  unit: 'TON' as const,
  validUntil: null,
}

function context(overrides: Partial<ImportContext> = {}): ImportContext {
  return {
    categoryIdByName: new Map([['Steel & Metals', 'cat-1']]),
    existingByName: new Map(),
    existingByCode: new Map(),
    existingBySupplierCode: new Map(),
    supplierId: 'supplier-1',
    ...overrides,
  }
}

function existingProduct(overrides: Partial<ExistingProduct> = {}): ExistingProduct {
  return {
    id: 'prod-1',
    name: 'Steel Rebar 16mm',
    currentPrice: null,
    hasDefaultPacking: false,
    supplierCodes: [],
    ...overrides,
  }
}

describe('matching a sheet row to a product that already exists', () => {
  it('ignores case and surrounding space', () => {
    expect(matchKey('  Steel Rebar 16mm ')).toBe(matchKey('steel rebar 16mm'))
  })

  it('does not treat two sizes as the same product', () => {
    // One character apart, and merging them would overwrite one product's
    // price with another's.
    expect(matchKey('Rebar 16mm')).not.toBe(matchKey('Rebar 18mm'))
  })
})

describe('a product the supplier has not sent before', () => {
  it('is created', () => {
    const plan = planImport([row()], context())
    expect(plan.rows[0]!.action).toBe('create')
    expect(plan.summary.create).toBe(1)
  })

  it('takes its price as the first one', () => {
    const withPrice = { ...row(), price: PRICE }
    const plan = planImport([withPrice], context())
    expect(plan.rows[0]!.priceAction).toBe('first')
  })
})

describe('a product the supplier has sent before', () => {
  const existing = context({
    existingByName: new Map([[matchKey('Steel Rebar 16mm'), existingProduct()]]),
  })

  it('is updated rather than duplicated', () => {
    const plan = planImport([row()], existing)
    expect(plan.rows[0]!.action).toBe('update')
    expect(plan.rows[0]!.productId).toBe('prod-1')
    expect(plan.summary.create).toBe(0)
  })

  it('lists only the fields the sheet actually supplied', () => {
    const plan = planImport([row({ brand: 'Hadeed', shortDescription: null })], existing)
    expect(plan.rows[0]!.changes).toContain('brand')
    expect(plan.rows[0]!.changes).not.toContain('description')
  })
})

describe('whether a price is news', () => {
  const withPrice = (price: typeof PRICE | null) =>
    context({
      existingByName: new Map([
        [
          matchKey('Steel Rebar 16mm'),
          existingProduct({
            currentPrice: price
              ? {
                  id: 'price-1',
                  amount: price.amount,
                  currency: price.currency,
                  incoterm: price.incoterm,
                  unit: price.unit,
                }
              : null,
          }),
        ],
      ]),
    })

  it('supersedes the old price when the amount moved', () => {
    const plan = planImport([{ ...row(), price: { ...PRICE, amount: 2600 } }], withPrice(PRICE))
    expect(plan.rows[0]!.priceAction).toBe('supersede')
    expect(plan.summary.pricesSuperseded).toBe(1)
  })

  it('supersedes when only the Incoterm changed, because that is a different price', () => {
    const plan = planImport(
      [{ ...row(), price: { ...PRICE, incoterm: 'CIF' as const } }],
      withPrice(PRICE)
    )
    expect(plan.rows[0]!.priceAction).toBe('supersede')
  })

  it('leaves an identical price alone rather than filling the history with noise', () => {
    const plan = planImport([{ ...row(), price: PRICE }], withPrice(PRICE))
    expect(plan.rows[0]!.priceAction).toBe('unchanged')
    expect(plan.summary.pricesAdded).toBe(0)
  })
})

describe('rows that are not imported', () => {
  it('skips a row carrying an error', () => {
    const broken = { ...row(), issues: [{ level: 'error' as const, message: 'bad' }] }
    const plan = planImport([broken], context())

    expect(plan.rows[0]!.action).toBe('skip')
    expect(plan.summary.skip).toBe(1)
  })

  it('skips a category that no longer exists, naming it', () => {
    const plan = planImport([row({ categoryName: 'Timber' })], context())

    expect(plan.rows[0]!.action).toBe('skip')
    expect(plan.rows[0]!.skipReason).toContain('Timber')
  })

  it('keeps only the first of two rows naming the same product', () => {
    // Otherwise the file creates the product and then updates it, and the
    // second row wins silently.
    const plan = planImport([row({ rowNumber: 4 }), row({ rowNumber: 9 })], context())

    expect(plan.rows[0]!.action).toBe('create')
    expect(plan.rows[1]!.action).toBe('skip')
    expect(plan.rows[1]!.skipReason).toContain('row 4')
  })
})

describe('packing', () => {
  const packing = {
    method: 'BAG' as const,
    unit: 'KILOGRAM' as const,
    unitsPerPack: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    grossWeightKg: 20,
    packsPerPallet: null,
    isStackable: true,
  }

  it('creates a default where there is none', () => {
    const plan = planImport([{ ...row(), packing }], context())
    expect(plan.rows[0]!.packingAction).toBe('create')
  })

  it('replaces the default where one exists, rather than adding a second', () => {
    const withPacking = context({
      existingByName: new Map([
        [matchKey('Steel Rebar 16mm'), existingProduct({ hasDefaultPacking: true })],
      ]),
    })

    const plan = planImport([{ ...row(), packing }], withPacking)
    expect(plan.rows[0]!.packingAction).toBe('replace')
  })
})

describe('matching by GLEX code', () => {
  const coded = (code: string): ImportContext =>
    context({
      existingByCode: new Map([
        [code, existingProduct({ id: 'prod-9', name: 'Whatever we called it' })],
      ]),
    })

  it('matches the code even when the supplier renamed the product', () => {
    // The point of the code: a reworded description still finds the record.
    const renamed = row({ name: 'Rebar, deformed, B500B — 16mm' })
    renamed.product.glexCode = 'REB016'

    const plan = planImport([renamed], coded('REB016'))

    expect(plan.rows[0]!.action).toBe('update')
    expect(plan.rows[0]!.productId).toBe('prod-9')
  })

  it('is case-insensitive, because people retype codes', () => {
    const typed = row()
    typed.product.glexCode = 'reb016'

    expect(planImport([typed], coded('REB016')).rows[0]!.action).toBe('update')
  })

  it('warns and falls back to the name when the code is unknown', () => {
    const wrong = row()
    wrong.product.glexCode = 'XXX999'

    const plan = planImport([wrong], context())

    expect(plan.rows[0]!.action).toBe('create')
    expect(plan.rows[0]!.issues).toContainEqual(
      expect.objectContaining({ level: 'warning', column: 'GLEX Code' })
    )
  })

  it('prefers the code over a name that matches a different product', () => {
    // Name matching is the fragile path; the code must win outright.
    const both = row({ name: 'Steel Rebar 16mm' })
    both.product.glexCode = 'REB016'

    const ctx = context({
      existingByCode: new Map([['REB016', existingProduct({ id: 'by-code', name: 'x' })]]),
      existingByName: new Map([
        [matchKey('Steel Rebar 16mm'), existingProduct({ id: 'by-name' })],
      ]),
    })

    expect(planImport([both], ctx).rows[0]!.productId).toBe('by-code')
  })
})

describe("matching by the supplier's own part number", () => {
  const withCode = (code: string, overrides: Partial<ExistingProduct> = {}) =>
    context({
      existingBySupplierCode: new Map([
        [code, existingProduct({ id: 'prod-7', supplierCodes: [code], ...overrides })],
      ]),
    })

  const coded = (code: string, overrides: Partial<ParsedRow['product']> = {}) => {
    const built = row(overrides)
    built.product.supplierCode = code
    return built
  }

  it('ignores case and stray spaces, because people retype these', () => {
    expect(supplierCodeKey('  abc 123 ')).toBe(supplierCodeKey('ABC 123'))
  })

  it('keeps punctuation significant, because ABC-123 may not be ABC123', () => {
    expect(supplierCodeKey('ABC-123')).not.toBe(supplierCodeKey('ABC123'))
  })

  it('matches the code even when the supplier renamed the product', () => {
    const renamed = coded('21010002', { name: 'Cu/XLPE/PVC 35sqmm, wire screened' })
    const plan = planImport([renamed], withCode('21010002'))

    expect(plan.rows[0]!.action).toBe('update')
    expect(plan.rows[0]!.productId).toBe('prod-7')
  })

  it('records a code the product does not carry yet', () => {
    const plan = planImport([coded('21010002')], withCode('21010002', { supplierCodes: [] }))

    expect(plan.rows[0]!.supplierCodeAction).toBe('record')
    expect(plan.rows[0]!.changes).toContain('product code')
    expect(plan.summary.supplierCodes).toBe(1)
  })

  it('leaves a code the product already carries alone', () => {
    const plan = planImport([coded('21010002')], withCode('21010002'))

    expect(plan.rows[0]!.supplierCodeAction).toBe('unchanged')
    expect(plan.summary.supplierCodes).toBe(0)
  })

  it('yields to the GLEX code, which we issued and they cannot change', () => {
    const both = coded('21010002')
    both.product.glexCode = 'REB016'

    const ctx = context({
      existingByCode: new Map([['REB016', existingProduct({ id: 'by-glex', name: 'x' })]]),
      existingBySupplierCode: new Map([
        ['21010002', existingProduct({ id: 'by-supplier', name: 'y' })],
      ]),
    })

    expect(planImport([both], ctx).rows[0]!.productId).toBe('by-glex')
  })

  it('beats the name, which is the fragile match', () => {
    const ctx = context({
      existingBySupplierCode: new Map([
        ['21010002', existingProduct({ id: 'by-supplier', name: 'y' })],
      ]),
      existingByName: new Map([
        [matchKey('Steel Rebar 16mm'), existingProduct({ id: 'by-name' })],
      ]),
    })

    expect(planImport([coded('21010002')], ctx).rows[0]!.productId).toBe('by-supplier')
  })
})

describe('two rows a catalogue cannot tell apart by name', () => {
  // The Bahra case: 2,544 cables composed to 482 distinct names because core
  // count, screen and insulation compound are not all recoverable from a
  // catalogue's text layer. Each still carries its own part number.
  const pair = (firstCode: string | null, secondCode: string | null) => {
    const first = row({ rowNumber: 4 })
    first.product.supplierCode = firstCode
    const second = row({ rowNumber: 9 })
    second.product.supplierCode = secondCode
    return [first, second]
  }

  it('imports both when their part numbers differ', () => {
    const plan = planImport(pair('21010002', '21020002'), context())

    expect(plan.rows.map((r) => r.action)).toEqual(['create', 'create'])
    expect(plan.summary.create).toBe(2)
  })

  it('warns that buyers will see one name twice', () => {
    const plan = planImport(pair('21010002', '21020002'), context())

    expect(plan.rows[1]!.issues).toContainEqual(
      expect.objectContaining({ level: 'warning', column: 'Product name (English)' })
    )
    expect(plan.rows[1]!.issues[0]!.message).toContain('Row 4')
  })

  it('still skips the second when the part number is the same', () => {
    const plan = planImport(pair('21010002', '21010002'), context())

    expect(plan.rows[1]!.action).toBe('skip')
    expect(plan.rows[1]!.skipReason).toContain('product code 21010002')
  })

  it('falls back to the name when neither row has a part number', () => {
    const plan = planImport(pair(null, null), context())

    expect(plan.rows[1]!.action).toBe('skip')
    expect(plan.rows[1]!.skipReason).toContain('product name')
  })
})
