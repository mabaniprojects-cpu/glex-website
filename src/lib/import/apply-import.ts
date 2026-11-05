import { Prisma } from '@prisma/client'
import type { ParsedRow } from '@/lib/import/parse-supplier-sheet'
import type { RowPlan } from '@/lib/import/plan-import'
import { slugify } from '@/lib/utils'

/**
 * The writing half of the supplier import.
 *
 * Kept out of the server action so it can be run against a database without
 * an HTTP request, a session or a permission check — which is the only way to
 * find out that a Decimal was passed a string, or an enum a label. Those do
 * not fail type-checking and do not fail until the first real import.
 *
 * Every function here takes a transaction client. The caller owns the
 * transaction, because a half-applied import is the outcome the whole
 * preview-then-commit design exists to avoid.
 */

export type Tx = Prisma.TransactionClient

/** Applies one planned row. Returns the product it created or updated. */
export async function applyRow(
  tx: Tx,
  planned: RowPlan,
  row: ParsedRow,
  categoryId: string,
  supplierId: string
): Promise<string> {
  const productId =
    planned.action === 'create'
      ? await createProduct(tx, row, categoryId, supplierId)
      : planned.productId!

  if (planned.action === 'update') await updateProduct(tx, productId, row)

  await applyPrice(tx, productId, row, planned.priceAction, supplierId)
  await applyPacking(tx, productId, row, planned.packingAction)

  return productId
}

export async function createProduct(
  tx: Tx,
  row: ParsedRow,
  categoryId: string,
  supplierId: string
): Promise<string> {
  const product = await tx.product.create({
    data: {
      slug: await uniqueSlug(tx, row.product.name),
      name: row.product.name,
      shortDescription: row.product.shortDescription,
      description: row.product.note,
      brand: row.product.brand,
      manufacturer: row.product.manufacturer,
      countryOfOrigin: row.product.countryOfOrigin,
      isSaudiMade: row.product.isSaudiMade,
      hsCode: row.product.hsCode,
      minimumOrderQty: row.product.minimumOrderQty,
      leadTimeDays: row.product.leadTimeDays,
      certifications: row.product.certifications,
      categoryId,
      supplierId,
      // Imported products are not published until someone has looked at them.
      // A sheet can carry a typo into the public catalogue otherwise.
      isVisible: false,
    },
    select: { id: true },
  })

  if (row.product.nameAr) {
    await tx.productTranslation.create({
      data: { productId: product.id, locale: 'ar', name: row.product.nameAr },
    })
  }

  return product.id
}

/**
 * Updates only what the sheet supplied.
 *
 * A blank cell means "not supplied", never "clear this". A supplier who fills
 * in prices and leaves the descriptions alone must not wipe the descriptions.
 */
export async function updateProduct(tx: Tx, productId: string, row: ParsedRow): Promise<void> {
  const data: Prisma.ProductUpdateInput = {}

  if (row.product.hsCode) data.hsCode = row.product.hsCode
  if (row.product.shortDescription) data.shortDescription = row.product.shortDescription
  if (row.product.brand) data.brand = row.product.brand
  if (row.product.manufacturer) data.manufacturer = row.product.manufacturer
  if (row.product.countryOfOrigin) data.countryOfOrigin = row.product.countryOfOrigin
  if (row.product.minimumOrderQty !== null) data.minimumOrderQty = row.product.minimumOrderQty
  if (row.product.leadTimeDays !== null) data.leadTimeDays = row.product.leadTimeDays
  if (row.product.certifications.length > 0) data.certifications = row.product.certifications

  if (Object.keys(data).length > 0) {
    await tx.product.update({ where: { id: productId }, data })
  }
}

export async function applyPrice(
  tx: Tx,
  productId: string,
  row: ParsedRow,
  action: string,
  supplierId: string
): Promise<void> {
  if (!row.price || action === 'none' || action === 'unchanged') return

  // Supersede rather than delete: the previous price is the history.
  if (action === 'supersede') {
    await tx.productPrice.updateMany({
      where: { productId, supplierId, supersededAt: null },
      data: { supersededAt: new Date() },
    })
  }

  await tx.productPrice.create({
    data: {
      productId,
      supplierId,
      amount: new Prisma.Decimal(row.price.amount),
      currency: row.price.currency,
      incoterm: row.price.incoterm,
      unit: row.price.unit,
      validUntil: row.price.validUntil,
      source: 'SUPPLIER_SHEET',
    },
  })
}

export async function applyPacking(
  tx: Tx,
  productId: string,
  row: ParsedRow,
  action: string
): Promise<void> {
  if (!row.packing || action === 'none') return

  // The sheet describes one way of packing, so it owns the default row. Any
  // further configurations are added by hand and are left alone.
  if (action === 'replace') {
    await tx.productPacking.deleteMany({ where: { productId, isDefault: true } })
  }

  await tx.productPacking.create({
    data: {
      productId,
      method: row.packing.method,
      unit: row.packing.unit ?? 'PIECE',
      unitsPerPack: decimalOrNull(row.packing.unitsPerPack),
      lengthCm: decimalOrNull(row.packing.lengthCm),
      widthCm: decimalOrNull(row.packing.widthCm),
      heightCm: decimalOrNull(row.packing.heightCm),
      grossWeightKg: decimalOrNull(row.packing.grossWeightKg),
      packsPerPallet: row.packing.packsPerPallet,
      isStackable: row.packing.isStackable,
      isDefault: true,
    },
  })
}

function decimalOrNull(value: number | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value)
}

/** Product slugs are unique across the catalogue, not only per supplier. */
async function uniqueSlug(tx: Tx, name: string): Promise<string> {
  const base = slugify(name) || 'product'

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const taken = await tx.product.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!taken) return candidate
  }

  // Fifty collisions means something is wrong with the name, not the counter.
  return `${base}-${Date.now()}`
}
