/**
 * GLEX catalogue numbers.
 *
 * `PIP012630-UPA` — three-letter type, then the size as digits, then the
 * material and a variant letter. Type first so a listing groups by product
 * kind; size as digits so it sorts within the type.
 *
 * This is the number a buyer sees on the website, quotes back in an enquiry,
 * and reads off a quotation months later. Three consequences:
 *
 *   It names no supplier. GLEX is the face of the catalogue; which factory
 *   makes an item is commercial information, and two suppliers may make the
 *   same one.
 *
 *   It is assigned once and frozen. The variant letter is positional, so
 *   regenerating a catalogue with one product inserted would shift every
 *   letter after it. `nextVariant` therefore takes the codes already issued
 *   and continues the sequence rather than renumbering.
 *
 *   It is not parsed to recover meaning. The code identifies; the product
 *   record describes. Reading a size back out of a code would make the code
 *   a second, worse copy of the data.
 */

/** Three-letter type codes. Customer-facing, so additions are deliberate. */
export const TYPE_CODES = {
  // Piping and fittings — already in use.
  PIP: 'Pipe',
  ELB: 'Elbow',
  TEE: 'Tee',
  RED: 'Reducer',
  CAP: 'Cap',
  ADP: 'Adaptor',
  CPL: 'Coupling',
  UNI: 'Union',
  FLG: 'Flange',
  CRS: 'Cross',
  YBR: 'Y-branch',
  CND: 'Conduit',

  // Cables and electrical.
  CBL: 'Power cable',
  CBC: 'Control and auxiliary cable',
  CBI: 'Instrumentation cable',
  CBS: 'Solar cable',
  CBF: 'Fire-resistant cable',
  CBH: 'Low-smoke halogen-free cable',
  CBM: 'Submersible cable',
  CBO: 'Overhead line conductor',
  CBB: 'Bare conductor',
  LUG: 'Cable lug',
  GLD: 'Cable gland',
  BUS: 'Busbar and busway',
  TRF: 'Transformer',
  SWG: 'Switchgear',
  ERT: 'Earthing',
  WDV: 'Wiring device',
  ENC: 'Enclosure',

  // Anything not yet given a type of its own.
  GEN: 'General',
} as const

export type TypeCode = keyof typeof TYPE_CODES

/**
 * The digits of a size, for the middle of a code.
 *
 * A size arrives as prose — "12 – 630 mm (PN2.5 – PN32)", "½\" – 12\"",
 * "240" — so only the leading numbers are taken, zero-padded to three
 * digits each so that 25 sorts before 240 rather than after it.
 *
 * Fractions are dropped rather than rounded: 1.5 mm² and 1 mm² would
 * otherwise collide, and the variant letter is what separates them.
 */
export function sizeDigits(size: string | number | null | undefined, parts = 2): string {
  if (size === null || size === undefined || size === '') return ''

  const numbers = String(size)
    .match(/\d+(?:\.\d+)?/g)
    ?.slice(0, parts)
    .map((value) => Math.round(Number(value)))
    .filter((value) => Number.isFinite(value) && value >= 0)

  if (!numbers || numbers.length === 0) return ''

  return numbers.map((value) => String(Math.min(value, 999)).padStart(3, '0')).join('')
}

/** A–Z then AA, AB… so a crowded type and size never runs out. */
export function variantLetter(index: number): string {
  let value = index
  let letters = ''

  do {
    letters = String.fromCharCode(65 + (value % 26)) + letters
    value = Math.floor(value / 26) - 1
  } while (value >= 0)

  return letters
}

export type CodeParts = {
  type: TypeCode
  /** Free text; only its digits are used. */
  size?: string | number | null
  /** Short material tag, e.g. UP for uPVC, CU for copper. */
  material?: string | null
}

/**
 * The next free code for a product.
 *
 * `issued` is every code already in the catalogue. The variant letter walks
 * forward from A until one is free, so an existing code is never reused and
 * never reassigned — which is the whole point of the scheme.
 */
export function nextCode(parts: CodeParts, issued: ReadonlySet<string>): string {
  const material = (parts.material ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3)
  const stem = `${parts.type}${sizeDigits(parts.size)}`

  // Without a material tag there is nothing to put after the dash, and a
  // trailing dash in a printed code looks like a mistake.
  const base = material ? `${stem}-${material}` : stem

  if (!issued.has(base)) return base

  for (let index = 0; index < 1000; index += 1) {
    const candidate = `${base}${material ? '' : '-'}${variantLetter(index)}`
    if (!issued.has(candidate)) return candidate
  }

  // A thousand variants of one type and size is not a catalogue problem to
  // solve with a longer suffix; it means the stem is wrong.
  throw new Error(`No free variant for ${base}`)
}

/** Whether a string looks like one of ours, for validating typed input. */
export function isCatalogueCode(value: string): boolean {
  return /^[A-Z]{3}\d{0,12}(-[A-Z0-9]{1,6})?$/.test(value.trim())
}
