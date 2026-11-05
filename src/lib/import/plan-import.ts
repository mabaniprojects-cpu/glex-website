import type { Issue, ParsedRow } from '@/lib/import/parse-supplier-sheet'

/**
 * Decides what an import would do, without doing any of it.
 *
 * Separated from the database so the rules that matter — what counts as the
 * same product, when a price supersedes another, what is left alone — can be
 * tested directly rather than through a fixture database and a signed-in
 * user. The action loads the context, calls this, and shows the result.
 *
 * The plan is also what the commit step re-derives. It is never sent from the
 * browser and acted on: a client that can post a plan can post any plan, and
 * this one writes to the catalogue.
 */

/** What already exists, loaded by the caller. */
export type ImportContext = {
  /** Category name as the sheet spells it, to its id. */
  categoryIdByName: Map<string, string>
  /** This supplier's existing products, keyed by matchable name. */
  existingByName: Map<string, ExistingProduct>
  /**
   * Every product in the catalogue by GLEX code, not only this supplier's.
   *
   * A code identifies a product, and GLEX may later source the same one
   * from a second supplier — so a sheet quoting a code we issued should
   * find it wherever it sits.
   */
  existingByCode: Map<string, ExistingProduct>
  supplierId: string
}

export type ExistingProduct = {
  id: string
  name: string
  /** Current, non-superseded price from this supplier, if any. */
  currentPrice: {
    id: string
    amount: number
    currency: string
    incoterm: string
    unit: string
  } | null
  hasDefaultPacking: boolean
}

export type RowAction = 'create' | 'update' | 'skip'
export type PriceAction = 'none' | 'first' | 'supersede' | 'unchanged'

export type RowPlan = {
  rowNumber: number
  action: RowAction
  name: string
  /** Set when the row updates an existing product. */
  productId?: string
  /** Why a row is being skipped, in words a human can act on. */
  skipReason?: string
  /** What changes, for the preview table. */
  changes: string[]
  priceAction: PriceAction
  packingAction: 'none' | 'create' | 'replace'
  issues: Issue[]
}

export type ImportPlan = {
  rows: RowPlan[]
  summary: {
    create: number
    update: number
    skip: number
    pricesAdded: number
    pricesSuperseded: number
    packings: number
  }
}

/**
 * How two spellings of a product name are judged to be the same thing.
 *
 * Case and surrounding space only. Deliberately not fuzzy: "Rebar 16mm" and
 * "Rebar 18mm" are one character apart and are different products, and a
 * matcher that merged them would quietly overwrite one supplier's price with
 * another product's. Anything cleverer belongs behind a human confirmation.
 */
export function matchKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function planImport(rows: ParsedRow[], context: ImportContext): ImportPlan {
  const plans: RowPlan[] = []

  // A sheet listing the same product twice would otherwise create it, then
  // update it, within one import — and the second row would silently win.
  const seenInThisFile = new Map<string, number>()

  for (const row of rows) {
    const issues = [...row.issues]
    const blocked = issues.some((issue) => issue.level === 'error')
    const key = matchKey(row.product.name)

    if (blocked) {
      plans.push(skip(row, 'The row has an error that has to be fixed first.', issues))
      continue
    }

    const duplicateOf = seenInThisFile.get(key)
    if (duplicateOf !== undefined) {
      plans.push(
        skip(row, `Same product name as row ${duplicateOf}. Only the first is imported.`, issues)
      )
      continue
    }
    seenInThisFile.set(key, row.rowNumber)

    const categoryId = context.categoryIdByName.get(row.product.categoryName)
    if (!categoryId) {
      plans.push(
        skip(
          row,
          `No category called "${row.product.categoryName}" exists. It may have been renamed since the sheet was sent.`,
          issues
        )
      )
      continue
    }

    /**
     * By code first, by name only when there is none.
     *
     * A code is exact: the sheet was sent out carrying it, and a supplier
     * who rewords a description still matches. Name matching is the
     * fallback for products we have never coded, and it is the fragile
     * one — "Rebar 16mm" and "Rebar 18mm" are one character apart.
     */
    const code = row.product.glexCode?.trim().toUpperCase()
    const byCode = code ? context.existingByCode.get(code) : undefined

    if (code && !byCode) {
      issues.push({
        level: 'warning',
        column: 'GLEX Code',
        message: `No product has the code ${code}. It may have been typed over, or belong to another catalogue; matching on the name instead.`,
      })
    }

    const existing = byCode ?? context.existingByName.get(key)
    plans.push(existing ? update(row, existing, issues) : create(row, issues))
  }

  return { rows: plans, summary: summarise(plans) }
}

function skip(row: ParsedRow, reason: string, issues: Issue[]): RowPlan {
  return {
    rowNumber: row.rowNumber,
    action: 'skip',
    name: row.product.name,
    skipReason: reason,
    changes: [],
    priceAction: 'none',
    packingAction: 'none',
    issues,
  }
}

function create(row: ParsedRow, issues: Issue[]): RowPlan {
  return {
    rowNumber: row.rowNumber,
    action: 'create',
    name: row.product.name,
    changes: ['New product'],
    priceAction: row.price ? 'first' : 'none',
    packingAction: row.packing ? 'create' : 'none',
    issues,
  }
}

function update(row: ParsedRow, existing: ExistingProduct, issues: Issue[]): RowPlan {
  const changes: string[] = []

  // Only fields the sheet actually carries a value for. A blank cell means
  // "not supplied", never "clear what you have" — a supplier who fills half
  // the sheet must not wipe the half they left alone.
  const field = (label: string, value: unknown) => {
    if (value !== null && value !== '' && value !== undefined) changes.push(label)
  }

  field('HS code', row.product.hsCode)
  field('description', row.product.shortDescription)
  field('brand', row.product.brand)
  field('lead time', row.product.leadTimeDays)
  field('minimum order', row.product.minimumOrderQty)
  if (row.product.certifications.length > 0) changes.push('certifications')

  return {
    rowNumber: row.rowNumber,
    action: 'update',
    name: row.product.name,
    productId: existing.id,
    changes: changes.length > 0 ? changes : ['Nothing on the product itself'],
    priceAction: priceActionFor(row, existing),
    packingAction: row.packing ? (existing.hasDefaultPacking ? 'replace' : 'create') : 'none',
    issues,
  }
}

/**
 * Whether this price is news.
 *
 * An identical price is left alone rather than superseded. Re-importing an
 * unchanged list should not fill the history with rows that all say the same
 * thing — the point of keeping history is to be able to see when a price
 * actually moved.
 */
function priceActionFor(row: ParsedRow, existing: ExistingProduct): PriceAction {
  if (!row.price) return 'none'
  if (!existing.currentPrice) return 'first'

  const same =
    Number(existing.currentPrice.amount) === row.price.amount &&
    existing.currentPrice.currency === row.price.currency &&
    existing.currentPrice.incoterm === row.price.incoterm &&
    existing.currentPrice.unit === row.price.unit

  return same ? 'unchanged' : 'supersede'
}

function summarise(plans: RowPlan[]): ImportPlan['summary'] {
  const count = (predicate: (plan: RowPlan) => boolean) => plans.filter(predicate).length

  return {
    create: count((plan) => plan.action === 'create'),
    update: count((plan) => plan.action === 'update'),
    skip: count((plan) => plan.action === 'skip'),
    pricesAdded: count((plan) => plan.priceAction === 'first' || plan.priceAction === 'supersede'),
    pricesSuperseded: count((plan) => plan.priceAction === 'supersede'),
    packings: count((plan) => plan.packingAction !== 'none'),
  }
}
