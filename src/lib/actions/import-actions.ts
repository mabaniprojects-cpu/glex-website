'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { getStorageProvider } from '@/lib/storage'
import { applyRow } from '@/lib/import/apply-import'
import { inspectWorkbook, type WorkbookInspection } from '@/lib/import/inspect-workbook'
import { PRODUCT_COLUMNS } from '@/lib/import/sheet-columns'
import {
  parseMappedSheet,
  parseSupplierSheet,
  type SheetMapping,
  type Issue,
  type ParsedRow,
} from '@/lib/import/parse-supplier-sheet'
import {
  matchKey,
  planImport,
  supplierCodeKey,
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

export type ImportError = 'validation' | 'not_found' | 'unreadable' | 'too_large' | 'server'

/**
 * Three outcomes, not two.
 *
 * "This is not our template" is not a failure — it is the ordinary case, and
 * the one the column mapper exists for. Reporting it as an error would make
 * the commonest path look like something went wrong.
 */
export type ImportResult =
  | { status: 'ready'; plan: ImportPlan; fileIssues: Issue[]; usedMapping: boolean }
  | {
      status: 'needs_mapping'
      inspection: WorkbookInspection
      /** A mapping saved earlier that no longer fits this file, if any. */
      savedMapping: SheetMapping | null
      reason: string
    }
  | { status: 'error'; error: ImportError }

export type CommitResult =
  | { ok: true; created: number; updated: number; skipped: number; pricesAdded: number }
  | {
      ok: false
      error:
        | 'validation'
        | 'not_found'
        | 'unreadable'
        | 'too_large'
        | 'nothing_to_do'
        | 'needs_mapping'
        | 'server'
    }

/** Excel is verbose; a genuine sheet of a few thousand rows stays far below. */
const MAX_BYTES = 10 * 1024 * 1024

const schema = z.object({
  supplierId: z.string().uuid(),
  /**
   * The uploaded workbook, as a `StoredFile` id.
   *
   * The file is kept rather than streamed through the request, so every price
   * it produces can name the sheet it came from — `ProductPrice.sourceFileId`
   * exists for exactly that. A price nobody can trace to a document is a
   * price nobody can defend six months later.
   */
  fileId: z.string().uuid(),
})

export async function previewSupplierImport(input: unknown): Promise<ImportResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { status: 'error', error: 'validation' }

  await requirePermission('product:write')

  const read = await readAndPlan(parsed.data.supplierId, parsed.data.fileId)
  if ('error' in read) return { status: 'error', error: read.error }

  if ('needsMapping' in read) {
    return {
      status: 'needs_mapping',
      inspection: read.needsMapping,
      savedMapping: read.savedMapping,
      reason: read.reason ?? 'This is not the GLEX data sheet, so its columns need matching up once.',
    }
  }

  return {
    status: 'ready',
    plan: read.plan,
    fileIssues: read.fileIssues,
    usedMapping: read.usedMapping,
  }
}

export async function commitSupplierImport(input: unknown): Promise<CommitResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const user = await requirePermission('product:write')

  const read = await readAndPlan(parsed.data.supplierId, parsed.data.fileId)
  if ('error' in read) return { ok: false, error: read.error }

  // A file that still needs its columns matching cannot be committed. The
  // preview is where that is resolved, so reaching here means the mapping
  // was changed or removed between previewing and confirming.
  if ('needsMapping' in read) return { ok: false, error: 'needs_mapping' }

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
          await applyRow(tx, planned, row, categoryId, context.supplierId, read.fileId)
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
  | {
      plan: ImportPlan
      rows: ParsedRow[]
      context: ImportContext
      fileIssues: Issue[]
      fileId: string
      usedMapping: boolean
    }
  | { needsMapping: WorkbookInspection; savedMapping: SheetMapping | null; reason?: string }
  | { error: 'not_found' | 'unreadable' | 'too_large' | 'server' }

async function readAndPlan(supplierId: string, fileId: string): Promise<ReadResult> {
  const [supplier, stored] = await Promise.all([
    db.supplierProfile.findFirst({
      where: { id: supplierId, deletedAt: null },
      select: { id: true },
    }),
    db.storedFile.findFirst({
      where: { id: fileId, deletedAt: null },
      select: { key: true, size: true },
    }),
  ])

  if (!supplier || !stored) return { error: 'not_found' }
  if (stored.size > MAX_BYTES) return { error: 'too_large' }

  const buffer = await getStorageProvider().get(stored.key)
  if (!buffer || buffer.byteLength === 0) return { error: 'unreadable' }

  /**
   * Our template first, then this supplier's saved mapping.
   *
   * In that order because the template needs no mapping to be right, and a
   * supplier who has been sent one sometimes uses it. A saved mapping is
   * only reached when the file is not the template.
   */
  const saved = await loadMapping(supplierId)

  let parsed
  let usedMapping = false

  try {
    parsed = await parseSupplierSheet(buffer)

    const notOurTemplate = parsed.rows.length === 0 && parsed.fileIssues.some((i) => i.level === 'error')

    if (notOurTemplate && saved) {
      parsed = await parseMappedSheet(buffer, saved)
      usedMapping = true
    } else if (notOurTemplate) {
      return { needsMapping: await inspectWorkbook(buffer), savedMapping: null }
    }

    // A mapping that no longer fits is worth showing the mapper for, rather
    // than reporting as a dead end.
    if (usedMapping && parsed.fileIssues.some((i) => i.level === 'error')) {
      return {
        needsMapping: await inspectWorkbook(buffer),
        savedMapping: saved,
        reason: parsed.fileIssues.find((i) => i.level === 'error')!.message,
      }
    }
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
    fileId,
    usedMapping,
  }
}

/** This supplier's confirmed mapping, if they have one. */
async function loadMapping(supplierId: string): Promise<SheetMapping | null> {
  const row = await db.supplierSheetMapping.findUnique({
    where: { supplierId },
    select: { sheetName: true, headerRow: true, columns: true },
  })
  if (!row) return null

  return {
    sheetName: row.sheetName,
    headerRow: row.headerRow,
    columns: (row.columns ?? {}) as Record<string, string>,
  }
}

/** Everything the planner needs to know about what already exists. */
async function loadContext(supplierId: string): Promise<ImportContext> {
  /**
   * What the planner needs to know about a product that already exists.
   *
   * `supplierCodes` is filtered to THIS supplier in the query, so a part
   * number another supplier uses never appears here — their numbering is
   * their own commercial information and would match the wrong row.
   */
  const productShape = {
    id: true,
    name: true,
    glexCode: true,
    packings: { where: { isDefault: true }, select: { id: true }, take: 1 },
    supplierCodes: { where: { supplierId }, select: { code: true } },
    prices: {
      where: { supersededAt: null, supplierId },
      select: { id: true, amount: true, currency: true, incoterm: true, unit: true },
      orderBy: { validFrom: 'desc' as const },
      take: 1,
    },
  }

  const [categories, products, coded] = await Promise.all([
    db.category.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    db.product.findMany({ where: { supplierId, deletedAt: null }, select: productShape }),
    // Catalogue-wide, because a code identifies a product wherever it sits.
    db.product.findMany({
      where: { glexCode: { not: null }, deletedAt: null },
      select: productShape,
    }),
  ])

  type Loaded = (typeof products)[number]

  const toExisting = (product: Loaded): ExistingProduct => {
    const price = product.prices[0]
    return {
      id: product.id,
      name: product.name,
      hasDefaultPacking: product.packings.length > 0,
      supplierCodes: product.supplierCodes.map((row) => supplierCodeKey(row.code)),
      currentPrice: price
        ? {
            id: price.id,
            amount: Number(price.amount),
            currency: price.currency,
            incoterm: price.incoterm,
            unit: price.unit,
          }
        : null,
    }
  }

  const existingByName = new Map<string, ExistingProduct>()
  const existingBySupplierCode = new Map<string, ExistingProduct>()
  for (const product of products) {
    const existing = toExisting(product)
    existingByName.set(matchKey(product.name), existing)
    // A name can collide; a part number cannot, so these are not the same
    // map with two keys — the code map stays complete where names overwrite.
    for (const code of existing.supplierCodes) existingBySupplierCode.set(code, existing)
  }

  const existingByCode = new Map<string, ExistingProduct>()
  for (const product of coded) {
    existingByCode.set(product.glexCode!.toUpperCase(), toExisting(product))
  }

  return {
    categoryIdByName: new Map(categories.map((category) => [category.name, category.id])),
    existingByName,
    existingByCode,
    existingBySupplierCode,
    supplierId,
  }
}

// --- The mapping ------------------------------------------------------------

export type SaveMappingResult =
  | { ok: true }
  | { ok: false; error: 'validation' | 'not_found' | 'server' }

const mappingSchema = z.object({
  supplierId: z.string().uuid(),
  sheetName: z.string().min(1).max(120),
  headerRow: z.number().int().min(1).max(100),
  /**
   * GLEX column header to the supplier's own header.
   *
   * Validated against the real column list rather than accepted as free
   * text: a key that is not a GLEX column would be written, stored, and
   * silently ignored at every future import.
   */
  columns: z.record(z.string().min(1), z.string().min(1)),
})

const GLEX_HEADERS = new Set(PRODUCT_COLUMNS.map((column) => column.header))

/**
 * Remembers how this supplier's spreadsheet lines up with ours.
 *
 * One per supplier, replaced rather than versioned: when a supplier changes
 * their format, the old mapping is wrong and keeping it helps nobody.
 */
export async function saveSupplierMapping(input: unknown): Promise<SaveMappingResult> {
  const parsed = mappingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const user = await requirePermission('product:write')
  const { supplierId, sheetName, headerRow, columns } = parsed.data

  const unknown = Object.keys(columns).filter((header) => !GLEX_HEADERS.has(header))
  if (unknown.length > 0) return { ok: false, error: 'validation' }

  // Two GLEX columns reading the same cell is always a mistake, and it is
  // the mistake a dropdown-per-row invites.
  const theirs = Object.values(columns)
  if (new Set(theirs).size !== theirs.length) return { ok: false, error: 'validation' }

  const supplier = await db.supplierProfile.findFirst({
    where: { id: supplierId, deletedAt: null },
    select: { id: true },
  })
  if (!supplier) return { ok: false, error: 'not_found' }

  try {
    await db.$transaction(async (tx) => {
      await tx.supplierSheetMapping.upsert({
        where: { supplierId },
        create: { supplierId, sheetName, headerRow, columns, lastUsedAt: new Date() },
        update: { sheetName, headerRow, columns, lastUsedAt: new Date() },
      })

      await recordAudit(
        {
          actorId: user.id,
          action: 'supplier.sheet_mapping_saved',
          entityType: 'SupplierProfile',
          entityId: supplierId,
          after: { sheetName, headerRow, mapped: Object.keys(columns).length },
        },
        tx
      )
    })
  } catch (error) {
    console.error('[import] Could not save the column mapping:', error)
    return { ok: false, error: 'server' }
  }

  revalidatePath(`/[locale]/admin/suppliers/${supplierId}/import`, 'page')
  return { ok: true }
}
