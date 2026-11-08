import { describe, expect, it } from 'vitest'
import {
  CERTIFICATION_CHOICES,
  isSaudiCountry,
  STEP_FIELDS,
  supplierRegistrationSchema,
  type SupplierRegistrationInput,
} from '@/lib/validation/supplier-registration'

/**
 * The registration form validates one step at a time and then validates the
 * whole schema again on submit. Anything the per-step pass cannot reach is a
 * submission that fails with nothing on screen to explain it, so the shape of
 * the step lists matters as much as the rules themselves.
 */

/** A complete, valid application; each test spoils one thing. */
function application(overrides: Partial<SupplierRegistrationInput> = {}) {
  return {
    fullName: 'Test Applicant',
    email: 'applicant@example.com',
    phone: '+966500000000',
    password: 'TestPassw0rd2026',
    confirmPassword: 'TestPassw0rd2026',
    legalName: 'Global Export House Company',
    tradingName: 'GLEX',
    companyType: 'Ltd',
    kind: 'SUPPLIER' as const,
    country: 'Saudi Arabia',
    city: 'Jeddah',
    address: "King Abdulaziz Branch Road, King's Tower",
    website: 'https://www.exporthouse.com.sa',
    crNumber: '7230910332',
    vatNumber: '311361809711000',
    employeeCount: '15',
    description: '',
    categorySlugs: [],
    brands: '',
    isManufacturer: true,
    isDistributor: false,
    distributorName: '',
    certifications: [],
    monthlyCapacity: '',
    minimumOrderNotes: '',
    exportExperience: '',
    marketsServed: '',
    availableIncoterms: [],
    leadTimeNotes: '',
    qualityControlNotes: '',
    documentIds: [],
    contacts: [],
    declaration: true as const,
    website_hp: '',
    ...overrides,
  }
}

function issuePaths(input: ReturnType<typeof application>) {
  const result = supplierRegistrationSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('a complete application', () => {
  it('is accepted', () => {
    expect(supplierRegistrationSchema.safeParse(application()).success).toBe(true)
  })
})

describe('Saudi registration and VAT numbers', () => {
  // The reported defect: a number a digit short was carried to the next step.
  it('refuses a commercial registration number that is not ten digits', () => {
    expect(issuePaths(application({ crNumber: '723091033' }))).toContain('crNumber')
    expect(issuePaths(application({ crNumber: '72309103321' }))).toContain('crNumber')
  })

  it('refuses a VAT number that is not fifteen digits', () => {
    expect(issuePaths(application({ vatNumber: '31136180971100' }))).toContain('vatNumber')
  })

  it('refuses letters in either number', () => {
    expect(issuePaths(application({ crNumber: '72309103A2' }))).toContain('crNumber')
  })

  it('accepts the correct lengths', () => {
    expect(issuePaths(application())).toEqual([])
  })

  it('leaves both optional — a blank field is not an error', () => {
    expect(issuePaths(application({ crNumber: '', vatNumber: '' }))).toEqual([])
  })

  /**
   * The rule is Saudi-specific on purpose. A German VAT number is "DE" and
   * nine digits, and refusing it would lock a foreign supplier out of the
   * form entirely.
   */
  it('does not impose the Saudi shape on a company registered elsewhere', () => {
    const german = application({
      country: 'Germany',
      vatNumber: 'DE123456789',
      crNumber: 'HRB 1234',
    })
    expect(issuePaths(german)).toEqual([])
  })

  it('recognises the country however it is written', () => {
    for (const name of ['Saudi Arabia', 'saudi arabia', ' KSA ', 'السعودية']) {
      expect(isSaudiCountry(name)).toBe(true)
    }
    expect(isSaudiCountry('United Arab Emirates')).toBe(false)
  })
})

describe('manufacturer or distributor', () => {
  it('requires at least one of the two', () => {
    expect(issuePaths(application({ isManufacturer: false, isDistributor: false }))).toContain(
      'isManufacturer'
    )
  })

  it('accepts both together — that is how a company says it does both', () => {
    expect(issuePaths(application({ isManufacturer: true, isDistributor: true }))).toEqual([])
  })

  it('accepts the name of the distributor a manufacturer sells through', () => {
    const input = application({ isDistributor: true, distributorName: 'Al-Najd Trading' })
    expect(issuePaths(input)).toEqual([])
  })
})

describe('quality certificates', () => {
  it('accepts the offered certificates', () => {
    expect(issuePaths(application({ certifications: [...CERTIFICATION_CHOICES] }))).toEqual([])
  })

  it('accepts none of them', () => {
    expect(issuePaths(application({ certifications: [] }))).toEqual([])
  })
})

describe('every validated field belongs to a step', () => {
  /**
   * Both of these are set by the component at submit time rather than typed,
   * and both are permissive enough that they cannot fail on their own.
   * Anything else missing from a step list would make the submit button do
   * nothing at all, with the explanation stranded on an unmounted step.
   */
  const SET_BY_THE_COMPONENT = new Set(['logoFileId', 'website_hp'])

  it('covers the whole schema', () => {
    const covered = new Set(STEP_FIELDS.flat() as readonly string[])
    const declared = Object.keys(application()).filter((key) => !SET_BY_THE_COMPONENT.has(key))

    expect([...declared].filter((field) => !covered.has(field))).toEqual([])
  })

  it('never validates the same field on two steps', () => {
    const all = STEP_FIELDS.flat() as readonly string[]
    expect(all.length).toBe(new Set(all).size)
  })
})
