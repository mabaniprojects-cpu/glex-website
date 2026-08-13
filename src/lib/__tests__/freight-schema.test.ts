import { describe, expect, it } from 'vitest'
import { freightInquirySchema } from '@/lib/validation/freight'

/**
 * Freight quote validation.
 *
 * The case that matters most is **idempotency**. `zodResolver` validates on the
 * client and hands `onSubmit` the *transformed* values, which the Server Action
 * then re-validates with the same schema. A schema that only accepts raw form
 * input therefore rejects everything the client already normalised — an empty
 * weight became `null`, and `null` coerced to `0`, which failed `.positive()`.
 *
 * The symptom was a generic "unexpected error" on every submission that left a
 * number field blank, which is most of them.
 */

const RAW_FORM_INPUT = {
  fullName: 'Freight Tester',
  company: '',
  email: 'freight@example.com',
  phone: '',
  country: '',
  mode: 'OCEAN' as const,
  incoterm: '' as const,
  originCountry: 'Saudi Arabia',
  originCity: '',
  originPort: '',
  destinationCountry: 'United Arab Emirates',
  destinationCity: '',
  destinationPort: '',
  cargoDescription: 'Ordinary ceramic tiles, palletised and shrink-wrapped.',
  weightKg: '',
  volumeCbm: '',
  containerType: '',
  isHazardous: false,
  readyDate: '',
  consent: true as const,
  website: '',
}

describe('freightInquirySchema', () => {
  it('accepts raw form input with the optional numbers left blank', () => {
    const result = freightInquirySchema.safeParse(RAW_FORM_INPUT)

    expect(result.success).toBe(true)
    expect(result.success && result.data.weightKg).toBeNull()
    expect(result.success && result.data.volumeCbm).toBeNull()
  })

  it('parses its own output — the client transforms before the server re-parses', () => {
    const first = freightInquirySchema.parse(RAW_FORM_INPUT)

    // This is the round trip that actually happens in the browser → server
    // path. It must not throw.
    const second = freightInquirySchema.parse(first)

    expect(second.weightKg).toBeNull()
    expect(second.volumeCbm).toBeNull()
    expect(second).toEqual(first)
  })

  it('is idempotent for filled numbers too', () => {
    const filled = { ...RAW_FORM_INPUT, weightKg: '24000', volumeCbm: '58.5' }

    const first = freightInquirySchema.parse(filled)
    expect(first.weightKg).toBe(24000)
    expect(first.volumeCbm).toBe(58.5)

    expect(freightInquirySchema.parse(first)).toEqual(first)
  })

  it('rejects a negative or zero weight rather than storing it', () => {
    // Zero is not "unknown" — it is a claim about the cargo, and a false one.
    expect(freightInquirySchema.safeParse({ ...RAW_FORM_INPUT, weightKg: '0' }).success).toBe(
      false
    )
    expect(freightInquirySchema.safeParse({ ...RAW_FORM_INPUT, weightKg: '-5' }).success).toBe(
      false
    )
  })

  it('requires an origin and a destination', () => {
    expect(
      freightInquirySchema.safeParse({ ...RAW_FORM_INPUT, destinationCountry: '' }).success
    ).toBe(false)
    expect(freightInquirySchema.safeParse({ ...RAW_FORM_INPUT, originCountry: '' }).success).toBe(
      false
    )
  })

  it('defaults dangerous goods to absent rather than false-positive', () => {
    const { isHazardous: _omitted, ...withoutFlag } = RAW_FORM_INPUT
    const result = freightInquirySchema.safeParse(withoutFlag)

    expect(result.success).toBe(true)
    // Undefined, which the action stores as `false`. Never inferred from the
    // cargo description.
    expect(result.success && result.data.isHazardous).toBeUndefined()
  })

  it('refuses a submission without consent', () => {
    expect(
      freightInquirySchema.safeParse({ ...RAW_FORM_INPUT, consent: false }).success
    ).toBe(false)
  })
})
