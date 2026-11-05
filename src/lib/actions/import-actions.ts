'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { applyRow } from '@/lib/import/apply-import'
import {
  parseSupplierSheet,
  type Issue,
  type ParsedRow,
} from '@/lib/import/parse-supplier-sheet'
import {
  matchKey,
  planImport,
  type ExistingProduct,
  type ImportContext,
  type ImportPlan,
} from '@/lib/import/plan-import'

/**
 * Loading a supplier's returned data sheet into the catalogue.
 *
 * Two steps on purpose. `previewSupplierImport` reads the file and reports
 * what would happen; `commitSupplierImport` does it. A supplier sheet is the
 * one input GLEX does not control the shape of, and an import that silently
 * overwrote fifty products would be slow and miserable to unpick.
 *
 * The commit re-reads the uploaded file and re-derives the plan rather than
 * accepting one from the browser. A client that can post a plan can post any
 * plan, and this one writes to the catalogue and to prices.
 *
 * Scoped to one supplier, so every product and price created here is
 * attributed without anyone choosing from a dropdown. `Product.supplierId`
 * is what later confines the supplier's own edits to their own rows.
 */

export type ImportResult =
  | { ok: true; plan: ImportPlan; fileIssues: Issue[] }
  | { ok: false; error: 'validation' | 'not_found' | 'unreadable' | 'too_large' | 'server' }

export type CommitResult =
  | { ok: true; created: number; updated: number; skipped: number; pricesAdded: number }
  | {
      ok: false
      error: 'validation' | 'not_found' | 'unreadable' | 'too_large' | 'nothing_to_do' | 'server'
    }

/** Excel is verbose; a genuine sheet of a few thousand rows stays far below. */
const MAX_BYTES = 10 * 1024 * 1024

const schema = z.object({
  supplierId: z.string().uuid(),
  /** The workbook, base64-encoded by the client. */
  file: z.string().min(1),
})

export async function previewSupplierImport(input: unknown): Promise<ImportResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  await requirePermission('product:write')

  const read = await readAndPlan(parsed.data.supplierId, parsed.data.file)
  if ('error' in read) return { ok: false, error: read.error }

  return { ok: true, plan: read.plan, fileIssues: read.fileIssues }
}

export async function commitSupplierImport(input: unknown): Promise<CommitResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const user = await requirePermission('product:write')

  const read = await readAndPlan(parsed.data.supplierId, parsed.data.file)
  if ('error' in read) return { ok: false, error: read.error }

  const { plan, rows, context } = read
  const actionable = plan.rows.filter((row) => row.action !== 'skip')
  if (actionable.length === 0) return { ok: false, error: 'nothing_to_do' }

  const byRowNumber = new Map(rows.map((row) => [row.rowNumber, row]))

  try {
    await db.$transaction(
      async (tx) => {
        for (const planned of actionable) {
          const row = byRowNumber.get(planned.rowNumber)
          if (!row) continue

          const categoryId = context.categoryIdByName.get(row.product.categoryName)!
          await applyRow(tx, planned, row, categoryId, context.supplierId)
        }

        await recordAudit(
          {
            actorId: user.id,
            action: 'supplier.sheet_imported',
            entityType: 'SupplierProfile',
            entityId: context.supplierId,
            after: {
              created: plan.summary.create,
              updated: plan.summary.update,
              skipped: plan.summary.skip,
              pricesAdded: plan.summary.pricesAdded,
            },
          },
          tx
        )
      },
      // Fifty products with prices and packing is a lot of statements; the
      // default five seconds is not enough and a half-applied import is the
      // outcome this whole design exists to avoid.
      { timeout: 120_000 }
    )
  } catch (error) {
    console.error('[import] Supplier sheet commit failed:', error)
    return { ok: false, error: 'server' }
  }

  revalidatePath('/[locale]/marketplace', 'page')
  revalidatePath('/[locale]/admin/products', 'page')
  revalidatePath(`/[locale]/admin/suppliers/${context.supplierId}`, 'page')

  return {
    ok: true,
    created: plan.summary.create,
    updated: plan.summary.update,
    skipped: plan.summary.skip,
    pricesAdded: plan.summary.pricesAdded,
  }
}

// --- Shared reading --------------------------------------------------------

type ReadResult =
  | { plan: ImportPlan; rows: ParsedRow[]; context: ImportContext; fileIssues: Issue[] }
  | { error: 'not_found' | 'unreadable' | 'too_large' | 'server' }

async function readAndPlan(supplierId: string, base64: string): Promise<ReadResult> {
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.byteLength === 0) return { error: 'unreadable' }
  if (buffer.byteLength > MAX_BYTES) return { error: 'too_large' }

  const supplier = await db.supplierProfile.findFirst({
    where: { id: supplierId, deletedAt: null },
    select: { id: true },
  })
  if (!supplier) return { error: 'not_found' }

  let parsed
  try {
    parsed = await parseSupplierSheet(buffer)
  } catch (error) {
    // A corrupt or non-Excel upload throws from inside the reader.
    console.error('[import] Could not read the workbook:', error)
    return { error: 'unreadable' }
  }

  const context = await loadContext(supplierId)
  return {
    plan: planImport(parsed.rows, context),
    rows: parsed.rows,
    context,
    fileIssues: parsed.fileIssues,
  }
}

/** Everything the planner needs to know about what already exists. */
async function loadContext(supplierId: string): Promise<ImportContext> {
  const [categories, products] = await Promise.all([
    db.category.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    db.product.findMany({
      where: { supplierId, deletedAt: null },
      select: {
        id: true,
        name: true,
        packings: { where: { isDefault: true }, select: { id: true }, take: 1 },
        prices: {
          where: { supersededAt: null, supplierId },
          select: { id: true, amount: true, currency: true, incoterm: true, unit: true },
          orderBy: { validFrom: 'desc' },
          take: 1,
        },
      },
    }),
  ])

  const existingByName = new Map<string, ExistingProduct>()
  for (const product of products) {
    const price = product.prices[0]
    existingByName.set(matchKey(product.name), {
      id: product.id,
      name: product.name,
      hasDefaultPacking: product.packings.length > 0,
      currentPrice: price
        ? {
            id: price.id,
            amount: Number(price.amount),
            currency: price.currency,
            incoterm: price.incoterm,
            unit: price.unit,
          }
        : null,
    })
  }

  return {
    categoryIdByName: new Map(categories.map((category) => [category.name, category.id])),
    existingByName,
    supplierId,
  }
}
