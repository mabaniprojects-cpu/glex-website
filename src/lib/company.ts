/**
 * Canonical GLEX company details.
 *
 * These are real registration facts and must not be altered without
 * instruction from the business. Office address, business hours and social
 * links are ALSO editable through the admin portal (Office / SocialLink
 * models); the values here are the fallback used before any record exists and
 * the source for structured data.
 */
export const GLEX_COMPANY = {
  legalName: 'Global Export House',
  brandName: 'GLEX',
  displayName: 'GLEX – Global Export House',
  tagline: 'From KSA to the World',

  crNumber: '4030472336',
  paidUpCapitalSar: 1_000_000,

  phoneDisplay: '+966 9200 31827',
  /** Digits only, for `tel:` links. */
  phoneE164: '+966920031827',

  website: 'https://www.exporthouse.com.sa',

  office: {
    name: 'Global Export House',
    addressLines: [
      'King Road Tower',
      'Floor 15, Offices 03 and 04',
      'Ash Shati District',
      'P.O. Box 442',
      'Jeddah 21411',
      'Kingdom of Saudi Arabia',
    ],
    city: 'Jeddah',
    country: 'Saudi Arabia',
    countryCode: 'SA',
    poBox: '442',
    postalCode: '21411',
    /** Approximate coordinates for King Road Tower, Ash Shati, Jeddah. */
    latitude: 21.6009,
    longitude: 39.1077,
  },
} as const

// NOTE: `officeAddressOneLine` and `officeMapsUrl` used to live here, hard-wired
// to the constant above. Offices are now editable records, so those helpers take
// an office and live in `src/lib/office-view.ts` — which, unlike this module,
// stays free of any database import so Client Components can use it.

/** schema.org Organization JSON-LD. */
export function organizationJsonLd(appUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: GLEX_COMPANY.displayName,
    legalName: GLEX_COMPANY.legalName,
    alternateName: GLEX_COMPANY.brandName,
    slogan: GLEX_COMPANY.tagline,
    url: appUrl,
    logo: `${appUrl}/brand/glex-logo.png`,
    image: `${appUrl}/brand/og-default.png`,
    telephone: GLEX_COMPANY.phoneDisplay,
    identifier: {
      '@type': 'PropertyValue',
      name: 'Commercial Registration',
      value: GLEX_COMPANY.crNumber,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'King Road Tower, Floor 15, Offices 03 and 04',
      addressLocality: GLEX_COMPANY.office.city,
      addressRegion: 'Makkah Province',
      postalCode: GLEX_COMPANY.office.postalCode,
      postOfficeBoxNumber: GLEX_COMPANY.office.poBox,
      addressCountry: GLEX_COMPANY.office.countryCode,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: GLEX_COMPANY.office.latitude,
      longitude: GLEX_COMPANY.office.longitude,
    },
  }
}
