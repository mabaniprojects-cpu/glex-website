import { Incoterm, SupplierKind } from '@prisma/client'
import { z } from 'zod'
import { isStrongPassword } from '@/lib/password'

/**
 * Supplier / distributor registration.
 *
 * NOTE (spec §11): banking details are NEVER requested during public
 * registration. Do not add IBAN, account or SWIFT fields to this schema.
 *
 * Optional text fields accept `""` rather than using `.optional()` alone, so
 * the schema's input and output types stay aligned for React Hook Form.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))

export const supplierContactSchema = z.object({
  kind: z.enum(['SALES', 'EXPORT', 'TECHNICAL', 'LOGISTICS']),
  name: optionalText(120),
  email: z.union([z.string().trim().email().max(200), z.literal('')]).optional(),
  phone: optionalText(40),
  position: optionalText(120),
})

export const supplierRegistrationSchema = z
  .object({
    // Step 1 — account
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    phone: optionalText(40),
    password: z.string().min(10).max(200).refine(isStrongPassword, { message: 'passwordWeak' }),
    confirmPassword: z.string(),

    // Step 2 — company
    legalName: z.string().trim().min(2).max(160),
    tradingName: optionalText(160),
    companyType: optionalText(120),
    kind: z.nativeEnum(SupplierKind),
    country: z.string().trim().min(2).max(80),
    city: optionalText(80),
    address: optionalText(300),
    website: z.union([z.string().trim().url().max(200), z.literal('')]).optional(),
    crNumber: optionalText(60),
    vatNumber: optionalText(60),
    yearEstablished: z
      .union([z.number().int().min(1800).max(new Date().getFullYear()), z.nan()])
      .optional(),
    employeeCount: optionalText(60),
    description: optionalText(4000),

    // Step 3 — products and capabilities
    categorySlugs: z.array(z.string().max(120)).max(30),
    brands: optionalText(500),
    isManufacturer: z.boolean(),
    isDistributor: z.boolean(),
    monthlyCapacity: optionalText(200),
    minimumOrderNotes: optionalText(300),
    exportExperience: optionalText(500),
    marketsServed: optionalText(500),
    availableIncoterms: z.array(z.nativeEnum(Incoterm)).max(10),
    leadTimeNotes: optionalText(300),
    qualityControlNotes: optionalText(2000),

    // Step 4 — documents (ids returned by POST /api/uploads)
    documentIds: z.array(z.string().uuid()).max(20),

    // Step 5 — contacts
    contacts: z.array(supplierContactSchema).max(4),

    // Step 6 — declaration
    declaration: z.literal(true),
    /** Honeypot — permissive on purpose; the action drops filled values silently. */
    website_hp: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordMismatch',
    path: ['confirmPassword'],
  })
  .refine((data) => data.isManufacturer || data.isDistributor, {
    message: 'selectOne',
    path: ['isManufacturer'],
  })

export type SupplierRegistrationInput = z.infer<typeof supplierRegistrationSchema>
export type SupplierContactInput = z.infer<typeof supplierContactSchema>

export const SUPPLIER_KINDS = [
  SupplierKind.SUPPLIER,
  SupplierKind.DISTRIBUTOR,
  SupplierKind.BOTH,
] as const

export const CONTACT_KINDS = ['SALES', 'EXPORT', 'TECHNICAL', 'LOGISTICS'] as const

export const INCOTERM_CHOICES = [
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

/** Field groups per step, used to validate one step before advancing. */
export const STEP_FIELDS = [
  ['fullName', 'email', 'phone', 'password', 'confirmPassword'],
  [
    'legalName',
    'tradingName',
    'companyType',
    'kind',
    'country',
    'city',
    'address',
    'website',
    'crNumber',
    'vatNumber',
    'yearEstablished',
    'employeeCount',
    'description',
  ],
  [
    'categorySlugs',
    'brands',
    'isManufacturer',
    'isDistributor',
    'monthlyCapacity',
    'minimumOrderNotes',
    'exportExperience',
    'marketsServed',
    'availableIncoterms',
    'leadTimeNotes',
    'qualityControlNotes',
  ],
  ['documentIds'],
  ['contacts'],
  ['declaration'],
] as const satisfies ReadonlyArray<ReadonlyArray<keyof SupplierRegistrationInput>>
