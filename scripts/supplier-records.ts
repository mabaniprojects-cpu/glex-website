import { Incoterm, SupplierKind, SupplierStatus } from '@prisma/client'

/**
 * Suppliers GLEX records itself, rather than waiting for them to register.
 *
 * Most of the companies in the partner strip on the home page have no
 * supplier record at all — they are a logo and nothing more. A record is
 * what lets their products be attributed, priced and quoted, and GLEX
 * already holds the catalogues for several of them.
 *
 * Only what the source documents actually state. A field a catalogue cannot
 * know — CR number, VAT, contact details, Incoterms, lead time — is left
 * out, because those are the questions worth putting to the supplier and an
 * invented answer stops anyone asking.
 */

export type SupplierRecord = {
  /** Matches the partner strip entry where there is one. */
  slug: string
  legalName: string
  tradingName?: string
  country: string
  city?: string
  website?: string
  description?: string
  kind: SupplierKind
  /**
   * APPROVED, not SUBMITTED.
   *
   * GLEX is recording a company it already works with, from documents it
   * already holds — nobody is waiting on a review. Filing it as SUBMITTED
   * would put it in the header's "awaiting review" count and send someone
   * looking for an application that was never made.
   */
  status: SupplierStatus
  isManufacturer: boolean
  isDistributor: boolean
  brands?: string[]
  marketsServed?: string[]
  availableIncoterms?: Incoterm[]
  monthlyCapacity?: string
  qualityControlNotes?: string
  loadingPort?: string
  /** Where these details came from, recorded on the profile. */
  sourceNote: string
}

export const SUPPLIER_RECORDS: readonly SupplierRecord[] = [
  {
    slug: 'bahra-electric',
    legalName: 'Bahra Cables Company',
    tradingName: 'Bahra Cables',
    country: 'Saudi Arabia',
    city: 'Bahra Industrial City',
    website: 'https://bahra-cables.com',
    description:
      'Manufacturer of electric cables serving Saudi Arabia, the GCC and export markets. Established 2008 in Bahra Industrial City, 25 km from Jeddah, on a 200,000 m² site. Products comply with IEC, BS, NF and VDE, and with UL, ANSI and ICEA.',
    kind: SupplierKind.BOTH,
    status: SupplierStatus.APPROVED,
    isManufacturer: true,
    isDistributor: true,
    brands: ['Bahra Cables', 'Bahra TBS'],
    marketsServed: ['Saudi Arabia', 'GCC'],
    monthlyCapacity:
      'Site 200,000 m²; built area 30,000 m² plus a 20,000 m² extension; 20,000 m² stock yard',
    qualityControlNotes:
      'Compliance with IEC, BS, NF and VDE, and with UL, ANSI and ICEA. In-house laboratories.',
    // Jeddah is the nearest port and the catalogues say the factory is 25 km
    // from it, but they do not name a loading point — so this is left for
    // Bahra to confirm rather than assumed.
    sourceNote:
      'Created by GLEX from the 26 Bahra product catalogues (November 2026), not from a supplier registration. CR number, VAT, contacts, Incoterms, lead time and loading port are outstanding and must come from Bahra.',
  },
]
