'use server'

import { UnitOfMeasure } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import {
  canSetEditorialFlags,
  productWriteScope,
  supplierIdForNewProduct,
} from '@/lib/product-scope'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { slugify } from '@/lib/utils'

/**
 * Catalogue content management.
 *
 * Every action re-checks its own permission: Server Actions POST to the page's
 * own URL, so the admin layout guard is not a security boundary. Every write is
 * audited in the same transaction that performs it.
 *
 * NOTE: there is deliberately no price field anywhere. The catalogue is
 * quotation-based (spec §7) and the schema has no column to hold one.
 */

export type ContentActionResult =
  | { ok: true; slug?: string }
  | { ok: false; error: 'validation' | 'not_found' | 'duplicate' | 'in_use' | 'server' }

/**
 * A unique slug derived from a name.
 *
 * Slugs are user-visible URLs, so collisions get a numeric suffix rather than a
 * random token. `excludeId` lets an edit keep its own slug.
 */
async function uniqueSlug(
  table: 'product' | 'category',
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(name)

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`

    const existing =
      table === 'product'
        ? await db.product.findUnique({ where: { slug: candidate }, select: { id: true } })
        : await db.category.findUnique({ where: { slug: candidate }, select: { id: true } })

    if (!existing || existing.id === excludeId) return candidate
  }

  // Extremely unlikely; keeps the caller from looping forever.
  return `${base}-${Date.now().toString(36)}`
}

/** Trimmed text that treats an empty submission as "not provided". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))

/**
 * An empty `<input type="number">` submits `""`. Accept it as "not provided"
 * rather than letting Zod reject the whole form.
 */
const optionalPositiveInt = z
  .union([z.literal(''), z.coerce.number().int().positive().max(1_000_000)])
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value))

// --- Categories -------------------------------------------------------------

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: optionalText(2000),
  parentId: z.union([z.string().uuid(), z.literal('')]).optional(),
  sortOrder: z.union([z.literal(''), z.coerce.number().int().min(0).max(9999)]).optional(),
  isActive: z.boolean().optional(),
})

export async function saveCategory(input: unknown): Promise<ContentActionResult> {
  const user = await requirePermission('category:write')

  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, name, description, parentId, sortOrder, isActive } = parsed.data

  try {
    // A category cannot be its own parent, which would orphan the tree.
    const parent = parentId && parentId !== id ? parentId : null

    const data = {
      name,
      description: description ?? null,
      parentId: parent,
      sortOrder: sortOrder === '' || sortOrder === undefined ? 0 : sortOrder,
      isActive: isActive ?? true,
    }

    if (id) {
      const before = await db.category.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, name: true, isActive: true, parentId: true, slug: true },
      })
      if (!before) return { ok: false, error: 'not_found' }

      const slug = await uniqueSlug('category', name, id)

      await db.$transaction(async (tx) => {
        await tx.category.update({ where: { id }, data: { ...data, slug } })
        await recordAudit(
          {
            actorId: user.id,
            action: 'category.updated',
            entityType: 'Category',
            entityId: id,
            before,
            after: { ...data, slug },
          },
          tx
        )
      })

      revalidateCatalogue()
      return { ok: true, slug }
    }

    const slug = await uniqueSlug('category', name)

    await db.$transaction(async (tx) => {
      const row = await tx.category.create({ data: { ...data, slug }, select: { id: true } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'category.created',
          entityType: 'Category',
          entityId: row.id,
          after: { ...data, slug },
        },
        tx
      )
    })

    revalidateCatalogue()
    return { ok: true, slug }
  } catch (error) {
    console.error('[content] saveCategory failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function deleteCategory(input: unknown): Promise<ContentActionResult> {
  const user = await requirePermission('category:write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id } = parsed.data

  try {
    const category = await db.category.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: true, children: true } },
      },
    })
    if (!category) return { ok: false, error: 'not_found' }

    // Products reference the category with `onDelete: Restrict`. Refuse rather
    // than orphan a catalogue entry or cascade a delete the operator did not
    // ask for.
    if (category._count.products > 0 || category._count.children > 0) {
      return { ok: false, error: 'in_use' }
    }

    await db.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
      await recordAudit(
        {
          actorId: user.id,
          action: 'category.deleted',
          entityType: 'Category',
          entityId: id,
          before: { name: category.name, slug: category.slug },
        },
        tx
      )
    })

    revalidateCatalogue()
    return { ok: true }
  } catch (error) {
    console.error('[content] deleteCategory failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Products ---------------------------------------------------------------

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(200),
  categoryId: z.string().uuid(),
  shortDescription: optionalText(500),
  description: optionalText(8000),
  brand: optionalText(120),
  manufacturer: optionalText(120),
  countryOfOrigin: optionalText(80),
  hsCode: optionalText(20),
  packaging: optionalText(200),
  minimumOrderQty: optionalPositiveInt,
  leadTimeDays: optionalPositiveInt,
  isSaudiMade: z.boolean().optional(),
  allowEquivalents: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  availableUnits: z.array(z.nativeEnum(UnitOfMeasure)).max(20).optional(),
  certifications: z.array(z.string().trim().max(80)).max(20).optional(),
})

/**
 * The acting supplier's profile id, if they have one.
 *
 * Staff do not need it — `productWriteScope` leaves them unrestricted.
 */
async function actingSupplierProfileId(userId: string): Promise<string | null> {
  const profile = await db.supplierProfile.findFirst({
    where: { organization: { users: { some: { id: userId } } }, deletedAt: null },
    select: { id: true },
  })
  return profile?.id ?? null
}

export async function saveProduct(input: unknown): Promise<ContentActionResult> {
  const user = await requirePermission('product:write')
  const supplierProfileId = await actingSupplierProfileId(user.id)

  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, name, categoryId, availableUnits, certifications, ...rest } = parsed.data

  try {
    // The category must exist and be live, or the product would be unreachable.
    const category = await db.category.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true },
    })
    if (!category) return { ok: false, error: 'validation' }

    const data = {
      name,
      categoryId,
      shortDescription: rest.shortDescription ?? null,
      description: rest.description ?? null,
      brand: rest.brand ?? null,
      manufacturer: rest.manufacturer ?? null,
      countryOfOrigin: rest.countryOfOrigin ?? null,
      hsCode: rest.hsCode ?? null,
      packaging: rest.packaging ?? null,
      minimumOrderQty: rest.minimumOrderQty,
      leadTimeDays: rest.leadTimeDays,
      isSaudiMade: rest.isSaudiMade ?? false,
      allowEquivalents: rest.allowEquivalents ?? true,
      isVisible: rest.isVisible ?? true,
      // Homepage promotion is an editorial decision. A supplier cannot grant it
      // to themselves, whatever the submitted payload says.
      isFeatured: canSetEditorialFlags(user) ? (rest.isFeatured ?? false) : false,
      availableUnits: availableUnits ?? [],
      certifications: (certifications ?? []).filter(Boolean),
    }

    if (id) {
      // Scoped: a supplier can only reach their own products, and someone
      // else's id is indistinguishable from one that does not exist.
      const before = await db.product.findFirst({
        where: {
          id,
          deletedAt: null,
          ...productWriteScope(user, supplierProfileId),
        },
        select: { id: true, name: true, slug: true, isVisible: true, categoryId: true },
      })
      if (!before) return { ok: false, error: 'not_found' }

      const slug = await uniqueSlug('product', name, id)

      await db.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: { ...data, slug } })
        await recordAudit(
          {
            actorId: user.id,
            action: 'product.updated',
            entityType: 'Product',
            entityId: id,
            before,
            after: { name, slug, isVisible: data.isVisible, categoryId },
          },
          tx
        )
      })

      revalidateCatalogue()
      return { ok: true, slug }
    }

    const slug = await uniqueSlug('product', name)

    // A supplier's new product is always attributed to them, so it cannot be
    // created unowned and thereby escape the scope above on every later edit.
    const supplierId = supplierIdForNewProduct(user, supplierProfileId)

    await db.$transaction(async (tx) => {
      const row = await tx.product.create({
        data: { ...data, slug, supplierId },
        select: { id: true },
      })
      await recordAudit(
        {
          actorId: user.id,
          action: 'product.created',
          entityType: 'Product',
          entityId: row.id,
          after: { name, slug, isVisible: data.isVisible, categoryId },
        },
        tx
      )
    })

    revalidateCatalogue()
    return { ok: true, slug }
  } catch (error) {
    console.error('[content] saveProduct failed:', error)
    return { ok: false, error: 'server' }
  }
}

/** Publish / unpublish. Separate from `saveProduct` so it can be one click. */
export async function setProductVisibility(input: unknown): Promise<ContentActionResult> {
  const user = await requirePermission('product:publish')

  const parsed = z
    .object({ id: z.string().uuid(), isVisible: z.boolean() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id, isVisible } = parsed.data

  try {
    const product = await db.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, isVisible: true },
    })
    if (!product) return { ok: false, error: 'not_found' }
    if (product.isVisible === isVisible) return { ok: true, slug: product.slug }

    await db.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { isVisible } })
      await recordAudit(
        {
          actorId: user.id,
          action: isVisible ? 'product.published' : 'product.unpublished',
          entityType: 'Product',
          entityId: id,
          before: { isVisible: product.isVisible },
          after: { isVisible },
        },
        tx
      )
    })

    revalidateCatalogue()
    return { ok: true, slug: product.slug }
  } catch (error) {
    console.error('[content] setProductVisibility failed:', error)
    return { ok: false, error: 'server' }
  }
}

/**
 * Soft delete.
 *
 * The row stays so historical RFQ line items keep resolving; every catalogue
 * query already filters on `deletedAt: null`.
 */
export async function deleteProduct(input: unknown): Promise<ContentActionResult> {
  const user = await requirePermission('product:write')
  const supplierProfileId = await actingSupplierProfileId(user.id)

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { id } = parsed.data

  try {
    // Scoped exactly as the edit path is — otherwise a supplier could delete a
    // competitor's listing even though they could not edit it.
    const product = await db.product.findFirst({
      where: { id, deletedAt: null, ...productWriteScope(user, supplierProfileId) },
      select: { id: true, name: true, slug: true },
    })
    if (!product) return { ok: false, error: 'not_found' }

    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { deletedAt: new Date(), isVisible: false, isFeatured: false },
      })
      await recordAudit(
        {
          actorId: user.id,
          action: 'product.deleted',
          entityType: 'Product',
          entityId: id,
          before: { name: product.name, slug: product.slug },
        },
        tx
      )
    })

    revalidateCatalogue()
    return { ok: true }
  } catch (error) {
    console.error('[content] deleteProduct failed:', error)
    return { ok: false, error: 'server' }
  }
}

/**
 * Refreshes every public surface a catalogue change can affect.
 *
 * NOTE: a dynamic route must be revalidated by its ROUTE PATTERN, not by an
 * interpolated URL — `/[locale]/products/cement` matches nothing and silently
 * does nothing.
 */
function revalidateCatalogue() {
  revalidatePath('/[locale]/marketplace', 'page')
  revalidatePath('/[locale]/marketplace/[category]', 'page')
  revalidatePath('/[locale]/products/[slug]', 'page')
  revalidatePath('/[locale]/admin/products', 'page')
  revalidatePath('/[locale]/admin/categories', 'page')
}
