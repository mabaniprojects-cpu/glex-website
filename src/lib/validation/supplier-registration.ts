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

/**
 * Quality certificates a Saudi exporter is routinely asked to evidence at
 * customs. Standards keep their published names in every language, so these
 * are constants rather than message keys; anything else goes in the
 * free-text quality-control notes.
 */
export const CERTIFICATION_CHOICES = [
  'SASO / SABER',
  'Saudi Quality Mark',
  'G-Mark (Gulf Conformity)',
  'ISO 9001',
  'ISO 14001',
  'ISO 45001',
  'ISO 50001',
  'Halal',
] as const

/**
 * Saudi commercial registration numbers are ten digits and VAT numbers are
 * fifteen. The rule is applied only to Saudi companies: elsewhere the
 * numbering follows that country's own rules, and a valid German VAT number
 * such as "DE123456789" must not be refused.
 */
const SAUDI_COUNTRY_NAMES = new Set([
  'saudi arabia',
  'saudi',
  'ksa',
  'sa',
  'kingdom of saudi arabia',
  'المملكة العربية السعودية',
  'السعودية',
])

export function isSaudiCountry(country: string): boolean {
  return SAUDI_COUNTRY_NAMES.has(country.trim().toLowerCase().replace(/\s+/g, ' '))
}

/** Required digit counts, shared with the form so it can name the number. */
export const CR_NUMBER_DIGITS = 10
export const VAT_NUMBER_DIGITS = 15

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
    distributorName: optionalText(160),
    certifications: z.array(z.string().max(80)).max(20),
    monthlyCapacity: optionalText(200),
    minimumOrderNotes: optionalText(300),
    exportExperience: optionalText(500),
    marketsServed: optionalText(500),
    availableIncoterms: z.array(z.nativeEnum(Incoterm)).max(10),
    leadTimeNotes: optionalText(300),
    qualityControlNotes: optionalText(2000),

    /**
     * Company logo, an id returned by POST /api/uploads.
     *
     * Optional: a supplier without their logo to hand should still be able
     * to finish registering, and chasing it later is cheaper than losing the
     * application.
     */
    logoFileId: z.string().uuid().optional(),

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
  .superRefine((data, ctx) => {
    if (!isSaudiCountry(data.country)) return

    const rules = [
      { field: 'crNumber', value: data.crNumber, digits: CR_NUMBER_DIGITS },
      { field: 'vatNumber', value: data.vatNumber, digits: VAT_NUMBER_DIGITS },
    ] as const

    for (const rule of rules) {
      // Both fields stay optional; it is only a value that is present and
      // the wrong length that is refused.
      if (!rule.value) continue
      const trimmed = rule.value.trim()
      if (trimmed.length === rule.digits && /^[0-9]+$/.test(trimmed)) continue

      ctx.addIssue({ code: 'custom', path: [rule.field], message: 'digits' })
    }
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
    'distributorName',
    'certifications',
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
