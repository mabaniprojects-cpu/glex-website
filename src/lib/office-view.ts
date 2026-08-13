/**
 * The office shape and its pure formatting helpers.
 *
 * Deliberately free of any database import. `OfficeCard` is a Client Component,
 * and importing these from `src/lib/offices.ts` would pull Prisma — and through
 * it `pg`, which needs `dns` — into the browser bundle. TypeScript and ESLint
 * both accept that happily; only the bundler rejects it.
 */

export type OfficeView = {
  id: string
  name: string
  addressLines: string[]
  city: string
  country: string
  phone: string | null
  latitude: number | null
  longitude: number | null
  isPrimary: boolean
}

export const officeAddressOneLine = (office: OfficeView) => office.addressLines.join(', ')

export const officeMapsUrl = (office: OfficeView) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${office.name}, ${officeAddressOneLine(office)}`
  )}`
