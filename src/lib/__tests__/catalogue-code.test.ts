import { describe, expect, it } from 'vitest'
import { isCatalogueCode, nextCode, sizeDigits, variantLetter } from '@/lib/catalogue-code'

/**
 * GLEX catalogue numbers.
 *
 * The property that matters most is not the format — it is that a code,
 * once issued, is never reassigned to something else. It goes on
 * quotations and buyers quote it back.
 */

describe('the size in the middle', () => {
  it('pads so that 25 sorts before 240', () => {
    expect(sizeDigits('25')).toBe('025')
    expect(sizeDigits('240')).toBe('240')
    expect(sizeDigits('025') < sizeDigits('240')).toBe(true)
  })

  it('takes a range as two numbers', () => {
    expect(sizeDigits('12 – 630 mm (PN2.5 – PN32)')).toBe('012630')
  })

  it('reads a size written in inches and fractions', () => {
    expect(sizeDigits('½" – 12"')).toBe('012')
  })

  it('is empty when the size says nothing numeric', () => {
    expect(sizeDigits('assorted')).toBe('')
    expect(sizeDigits(null)).toBe('')
  })
})

describe('variant letters', () => {
  it('counts A, B, C', () => {
    expect([0, 1, 2].map(variantLetter)).toEqual(['A', 'B', 'C'])
  })

  it('carries past Z rather than running out', () => {
    expect(variantLetter(25)).toBe('Z')
    expect(variantLetter(26)).toBe('AA')
  })
})

describe('issuing a code', () => {
  it('uses the bare stem when it is free', () => {
    expect(nextCode({ type: 'PIP', size: '12 – 630 mm', material: 'uPVC' }, new Set())).toBe(
      'PIP012630-UPV'
    )
  })

  it('never reuses a code that has been issued', () => {
    const issued = new Set(['CBL240', 'CBL240-A'])
    const code = nextCode({ type: 'CBL', size: '240' }, issued)

    expect(issued.has(code)).toBe(false)
    expect(code).toBe('CBL240-B')
  })

  it('keeps separating products that share a type and size', () => {
    // Four cables at 240mm² differing only by insulation must each get a
    // code, and none may collide.
    const issued = new Set<string>()
    const codes = [1, 2, 3, 4].map(() => {
      const code = nextCode({ type: 'CBL', size: '240' }, issued)
      issued.add(code)
      return code
    })

    expect(new Set(codes).size).toBe(4)
  })

  it('omits the dash when there is no material, rather than trailing it', () => {
    expect(nextCode({ type: 'LUG', size: '16' }, new Set())).toBe('LUG016')
  })

  it('names no supplier anywhere in the code', () => {
    // The code is customer-facing; sourcing is commercial information.
    const code = nextCode({ type: 'CBL', size: '240', material: 'CU' }, new Set())
    expect(code).not.toMatch(/bahra|white|sand/i)
  })
})

describe('recognising one of ours', () => {
  it.each(['PIP012630-UPA', 'CBL240', 'LUG016', 'CBL240-B'])('accepts %s', (code) => {
    expect(isCatalogueCode(code)).toBe(true)
  })

  it.each(['pip012630', '12630-UPA', 'PI12', ''])('rejects %s', (code) => {
    expect(isCatalogueCode(code)).toBe(false)
  })
})

describe('guessing a type from a product name', () => {
  // Each case here mis-typed a real product in the existing catalogue
  // before it was fixed, and a code is permanent once issued.
  it('reads the product name, not the category it sits in', async () => {
    const { guessType } = await import('@/lib/import/product-type')

    // GLEX's categories are pairs, so searching name and category together
    // filed every concrete block as precast and every EPS sheet as
    // waterproofing — on a word never present in the product's own name.
    expect(guessType('Concrete Blocks (Hollow/Solid)', 'Blocks & Precast')).toBe('BLK')
    expect(guessType('EPS Insulation', 'Insulation & Waterproofing')).toBe('INS')
    expect(guessType('Precast Panels', 'Blocks & Precast')).toBe('PCP')
    expect(guessType('Waterproofing Membrane', 'Insulation & Waterproofing')).toBe('WPM')
  })

  it('matches names written in the plural, as catalogues write them', async () => {
    const { guessType } = await import('@/lib/import/product-type')

    expect(guessType('Electrical Power Cables')).toBe('CBL')
    expect(guessType('Cable Lugs')).toBe('LUG')
    expect(guessType('Steel Pipes (Welded)')).toBe('PIP')
  })

  it('prefers the more specific cable type', async () => {
    const { guessType } = await import('@/lib/import/product-type')

    // A fire-resistant power cable is bought for its fire resistance.
    expect(guessType('Fire Resistant Power Cable')).toBe('CBF')
    expect(guessType('Instrumentation Cable')).toBe('CBI')
    expect(guessType('Solar Cable')).toBe('CBS')
  })

  it('falls back to the category only when the name says nothing', async () => {
    const { guessType } = await import('@/lib/import/product-type')

    expect(guessType('Type I', 'Cement & Related')).toBe('CEM')
  })
})
