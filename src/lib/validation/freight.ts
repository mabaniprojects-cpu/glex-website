import { Incoterm, ShipmentMode } from '@prisma/client'
import { z } from 'zod'

/**
 * Freight quote request.
 *
 * The contact fields mirror `contactSchema` so the submission can reuse the
 * proven contact pipeline — reference, consent record, rate limiting, honeypot
 * and notifications — while the freight fields carry the structure a logistics
 * team actually needs.
 *
 * There is no price or budget field. GLEX quotes freight in a written offer,
 * exactly as it quotes goods.
 */

/**
 * A decimal figure entered as text. Empty means "not stated", never zero.
 *
 * Accepts `null` as well as `''` so the schema is **idempotent** — parsing its
 * own output has to succeed. The same schema validates on the client (through
 * `zodResolver`, which hands `onSubmit` the *transformed* values) and again on
 * the server, so a shape that only accepts raw form input rejects everything
 * the client already normalised.
 */
const optionalAmount = (max: number) =>
  z
    .union([z.literal(''), z.null(), z.coerce.number().positive().max(max)])
    .optional()
    .transform((value) =>
      value === '' || value === null || value === undefined ? null : value
    )

export const freightInquirySchema = z.object({
  // --- Who is asking ---
  fullName: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(100).optional(),

  // --- The shipment ---
  mode: z.nativeEnum(ShipmentMode),
  incoterm: z.union([z.literal(''), z.nativeEnum(Incoterm)]).optional(),

  originCountry: z.string().trim().min(2).max(100),
  originCity: z.string().trim().max(100).optional(),
  originPort: z.string().trim().max(100).optional(),
  destinationCountry: z.string().trim().min(2).max(100),
  destinationCity: z.string().trim().max(100).optional(),
  destinationPort: z.string().trim().max(100).optional(),

  // --- The cargo ---
  cargoDescription: z.string().trim().min(10).max(4000),
  weightKg: optionalAmount(10_000_000),
  volumeCbm: optionalAmount(100_000),
  containerType: z.string().trim().max(100).optional(),
  /**
   * Dangerous goods are declared, never inferred.
   *
   * Getting this wrong is a safety and legal matter, not a preference, so the
   * box is unticked by default and the label says what it commits the sender to.
   */
  isHazardous: z.boolean().optional(),
  readyDate: z.union([z.literal(''), z.string().max(40)]).optional(),

  consent: z.literal(true),
  /** Honeypot — permissive on purpose; the action drops filled values silently. */
  website: z.string().optional(),
})

export type FreightInquiryInput = z.input<typeof freightInquirySchema>
