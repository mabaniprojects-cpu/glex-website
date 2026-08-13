'use server'

import { UnitOfMeasure } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { cartLineSchema, readCart, removeLine, upsertLine, writeCart } from '@/lib/rfq-cart'

/**
 * Cart mutations.
 *
 * Server Actions are reachable by direct POST, so each one re-validates its
 * input and confirms the product is genuinely visible before accepting it.
 */

export type CartActionResult = { ok: true; count: number } | { ok: false; error: string }

const addSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive().max(1_000_000).optional(),
  unit: z.nativeEnum(UnitOfMeasure).optional(),
})

export async function addToCart(input: unknown): Promise<CartActionResult> {
  const parsed = addSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  try {
    // Confirm the product exists and is offerable; never trust the client.
    const product = await db.product.findFirst({
      where: { id: parsed.data.productId, isVisible: true, deletedAt: null },
      select: { id: true, availableUnits: true, minimumOrderQty: true },
    })
    if (!product) return { ok: false, error: 'not_found' }

    const unit =
      parsed.data.unit && product.availableUnits.includes(parsed.data.unit)
        ? parsed.data.unit
        : (product.availableUnits[0] ?? UnitOfMeasure.PIECE)

    const quantity = parsed.data.quantity ?? product.minimumOrderQty ?? 1

    const lines = upsertLine(await readCart(), { productId: product.id, quantity, unit })
    await writeCart(lines)

    return { ok: true, count: lines.length }
  } catch (error) {
    console.error('[cart] addToCart failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function updateCartLine(input: unknown): Promise<CartActionResult> {
  const parsed = cartLineSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  try {
    const product = await db.product.findFirst({
      where: { id: parsed.data.productId, isVisible: true, deletedAt: null },
      select: { availableUnits: true },
    })
    if (!product) return { ok: false, error: 'not_found' }

    // Reject a unit the product does not offer.
    if (product.availableUnits.length > 0 && !product.availableUnits.includes(parsed.data.unit)) {
      return { ok: false, error: 'validation' }
    }

    const lines = upsertLine(await readCart(), parsed.data)
    await writeCart(lines)

    return { ok: true, count: lines.length }
  } catch (error) {
    console.error('[cart] updateCartLine failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function removeFromCart(productId: unknown): Promise<CartActionResult> {
  const parsed = z.string().uuid().safeParse(productId)
  if (!parsed.success) return { ok: false, error: 'validation' }

  try {
    const lines = removeLine(await readCart(), parsed.data)
    await writeCart(lines)

    return { ok: true, count: lines.length }
  } catch (error) {
    console.error('[cart] removeFromCart failed:', error)
    return { ok: false, error: 'server' }
  }
}

export async function clearCart(): Promise<CartActionResult> {
  try {
    await writeCart([])
    return { ok: true, count: 0 }
  } catch (error) {
    console.error('[cart] clearCart failed:', error)
    return { ok: false, error: 'server' }
  }
}
