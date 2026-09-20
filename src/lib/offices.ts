import { GLEX_COMPANY } from '@/lib/company'
import { db } from '@/lib/db'
import type { OfficeView } from '@/lib/office-view'

/**
 * Office locations.
 *
 * The `Office` table is the source of truth so staff can add or correct a
 * location without a deploy. `GLEX_COMPANY` remains the fallback: it holds the
 * real, verified Jeddah address, so an empty or unreachable table degrades to
 * correct data rather than to a blank contact page.
 *
 * Company *identity* — legal name, commercial registration —
 * deliberately stays in `src/lib/company.ts` and is not editable here. It is
 * legally fixed, and a typo in it is a different class of problem.
 */

/** The hard-coded head office, used when the table has nothing to show. */
function fallbackOffice(): OfficeView {
  return {
    id: 'fallback',
    name: GLEX_COMPANY.office.name,
    addressLines: [...GLEX_COMPANY.office.addressLines],
    city: GLEX_COMPANY.office.city,
    country: GLEX_COMPANY.office.country,
    phone: GLEX_COMPANY.phoneDisplay,
    latitude: GLEX_COMPANY.office.latitude,
    longitude: GLEX_COMPANY.office.longitude,
    isPrimary: true,
    businessHours: [...GLEX_COMPANY.office.businessHours],
  }
}

/**
 * Every office, head office first.
 *
 * Never returns an empty array — a contact page with no address is worse than
 * a slightly stale one.
 */
export async function listOffices(): Promise<OfficeView[]> {
  try {
    const rows = await db.office.findMany({
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        addressLines: true,
        city: true,
        country: true,
        phone: true,
        latitude: true,
        longitude: true,
        isPrimary: true,
        businessHours: true,
      },
    })

    // `businessHours` is a JSON column, so it arrives as `unknown` and is
    // narrowed here rather than trusted.
    const offices: OfficeView[] = rows.map((row) => ({
      ...row,
      businessHours: Array.isArray(row.businessHours)
        ? (row.businessHours as OfficeView['businessHours'])
        : [],
    }))

    return offices.length > 0 ? offices : [fallbackOffice()]
  } catch (error) {
    console.error('[offices] Falling back to the hard-coded head office:', error)
    return [fallbackOffice()]
  }
}
