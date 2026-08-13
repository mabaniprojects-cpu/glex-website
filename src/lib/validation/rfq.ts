import { Incoterm, UnitOfMeasure } from '@prisma/client'
import { z } from 'zod'

/**
 * RFQ submission schema, shared by the client form and the server action so
 * both enforce identical rules. The server ALWAYS re-validates.
 */

/**
 * An unselected `<select>` and an empty hidden input both submit `""`, which
 * satisfies neither `z.nativeEnum(...).optional()` nor `z.string().uuid()`.
 *
 * `z.preprocess` would fix it but makes the schema's INPUT type `unknown`,
 * which breaks React Hook Form's resolver typing (the same trap as
 * `z.coerce`). Accepting the empty string as a valid value keeps input and
 * output aligned; the server action treats `""` as absent.
 */
export const rfqItemSchema = z.object({
  productId: z.union([z.string().uuid(), z.literal('')]).optional(),
  /** Free-text lines are allowed for products not yet in the catalogue. */
  name: z.string().trim().min(2).max(200),
  // Plain number, not `z.coerce.number()`: coercion makes the schema's INPUT
  // type `unknown`, which breaks React Hook Form's resolver typing. The form
  // registers this field with `valueAsNumber: true` instead.
  quantity: z.number().positive().max(1_000_000),
  unit: z.nativeEnum(UnitOfMeasure),
  brand: z.string().trim().max(120).optional().or(z.literal('')),
  specification: z.string().trim().max(2000).optional().or(z.literal('')),
})

export const rfqSubmitSchema = z.object({
  items: z.array(rfqItemSchema).min(1, 'atLeastOneItem').max(100),

  // Destination
  destinationCountry: z.string().trim().min(2).max(80),
  destinationCity: z.string().trim().max(80).optional().or(z.literal('')),
  destinationPort: z.string().trim().max(120).optional().or(z.literal('')),
  incoterm: z.union([z.nativeEnum(Incoterm), z.literal('')]).optional(),
  requiredDeliveryDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || !Number.isNaN(Date.parse(value)),
      { message: 'invalidDate' }
    ),

  // Requirements
  preferredBrands: z.string().trim().max(500).optional().or(z.literal('')),
  allowEquivalents: z.boolean(),
  projectName: z.string().trim().max(200).optional().or(z.literal('')),
  projectDetails: z.string().trim().max(4000).optional().or(z.literal('')),
  notes: z.string().trim().max(4000).optional().or(z.literal('')),

  // Guest contact details. Required only when not signed in; the server
  // enforces that rule, since the client cannot be trusted about its session.
  guestName: z.string().trim().max(120).optional().or(z.literal('')),
  guestEmail: z.string().trim().email().max(200).optional().or(z.literal('')),
  guestCompany: z.string().trim().max(160).optional().or(z.literal('')),
  guestPhone: z.string().trim().max(40).optional().or(z.literal('')),

  /**
   * Uploaded drawings, BOQs or specifications.
   *
   * Ids only — the files are stored by `/api/uploads`, which requires a signed-in
   * user. The action re-checks that each id was uploaded by the submitter, so a
   * crafted payload cannot attach someone else's document.
   */
  attachmentIds: z.array(z.string().uuid()).max(5).optional(),

  consent: z.literal(true),
  /** Honeypot — permissive on purpose; the action drops filled values silently. */
  website: z.string().optional(),
})

export type RfqItemInput = z.infer<typeof rfqItemSchema>
export type RfqSubmitInput = z.infer<typeof rfqSubmitSchema>

export const INCOTERM_OPTIONS = [
  Incoterm.EXW,
  Incoterm.FCA,
  Incoterm.FOB,
  Incoterm.CFR,
  Incoterm.CIF,
  Incoterm.CPT,
  Incoterm.CIP,
  Incoterm.DAP,
  Incoterm.DPU,
  Incoterm.DDP,
] as const

export const UNIT_OPTIONS = [
  UnitOfMeasure.PIECE,
  UnitOfMeasure.BOX,
  UnitOfMeasure.CARTON,
  UnitOfMeasure.PACK,
  UnitOfMeasure.PALLET,
  UnitOfMeasure.KILOGRAM,
  UnitOfMeasure.TON,
  UnitOfMeasure.METER,
  UnitOfMeasure.SQUARE_METER,
  UnitOfMeasure.CUBIC_METER,
  UnitOfMeasure.ROLL,
  UnitOfMeasure.SET,
  UnitOfMeasure.CONTAINER,
] as const
