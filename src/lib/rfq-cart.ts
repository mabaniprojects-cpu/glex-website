import { UnitOfMeasure } from '@prisma/client'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { db } from '@/lib/db'

/**
 * RFQ cart.
 *
 * Stored in a cookie so a guest can assemble a request without an account —
 * the specification explicitly permits guest RFQs. The cookie holds only
 * product ids, quantities and units; product details are always re-read from
 * the database, so a tampered cookie cannot inject fake names or prices.
 */

export const CART_COOKIE = 'GLEX_RFQ_CART'
const MAX_LINES = 50

const cartLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive().max(1_000_000),
  unit: z.nativeEnum(UnitOfMeasure),
  note: z.string().max(500).optional(),
})

const cartSchema = z.array(cartLineSchema).max(MAX_LINES)

export type CartLine = z.infer<typeof cartLineSchema>

/** Reads and validates the cart cookie. Malformed content yields an empty cart. */
export async function readCart(): Promise<CartLine[]> {
  const raw = (await cookies()).get(CART_COOKIE)?.value
  if (!raw) return []

  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    // A corrupt or hand-edited cookie is treated as empty rather than fatal.
    return []
  }
}

export async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies()
  const trimmed = lines.slice(0, MAX_LINES)

  if (trimmed.length === 0) {
    store.delete(CART_COOKIE)
    return
  }

  store.set(CART_COOKIE, JSON.stringify(trimmed), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export type HydratedCartLine = CartLine & {
  slug: string
  name: string
  brand: string | null
  imageUrl: string | null
  availableUnits: UnitOfMeasure[]
  minimumOrderQty: number | null
}

/**
 * Joins the cookie lines against the database.
 *
 * Products that have since been hidden or deleted are dropped silently — the
 * cart must never reference something a client can no longer request.
 */
export async function hydrateCart(lines: CartLine[]): Promise<HydratedCartLine[]> {
  if (lines.length === 0) return []

  const products = await db.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) }, isVisible: true, deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      brand: true,
      availableUnits: true,
      minimumOrderQty: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
    },
  })

  const byId = new Map(products.map((product) => [product.id, product]))

  return lines.flatMap((line) => {
    const product = byId.get(line.productId)
    if (!product) return []

    return [
      {
        ...line,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        imageUrl: product.images[0]?.url ?? null,
        availableUnits: product.availableUnits,
        minimumOrderQty: product.minimumOrderQty,
      },
    ]
  })
}

export async function getCartCount(): Promise<number> {
  return (await readCart()).length
}

/** Adds or merges a line. Returns the resulting cart. */
export function upsertLine(lines: CartLine[], line: CartLine): CartLine[] {
  const index = lines.findIndex((existing) => existing.productId === line.productId)
  if (index === -1) return [...lines, line]

  const next = [...lines]
  next[index] = line
  return next
}

export function removeLine(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((line) => line.productId !== productId)
}

export { cartLineSchema }
