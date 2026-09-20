/**
 * The office shape and its pure formatting helpers.
 *
 * Deliberately free of any database import. `OfficeCard` is a Client Component,
 * and importing these from `src/lib/offices.ts` would pull Prisma — and through
 * it `pg`, which needs `dns` — into the browser bundle. TypeScript and ESLint
 * both accept that happily; only the bundler rejects it.
 */

/** One day's opening, as stored on the office. A closed day has no times. */
export type BusinessHour = { day: string; open: string | null; close: string | null }

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
  businessHours: BusinessHour[]
}

const DAY_ORDER = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

/**
 * The opening hours as one line: "Sunday – Thursday, 08:00 – 17:00".
 *
 * Collapses consecutive days that share the same hours, because a contact page
 * listing seven lines to say one thing is a worse answer to "when are you
 * open?" than a sentence. Days are ordered from Sunday, the start of the
 * working week in Saudi Arabia.
 *
 * Returns null when nothing is recorded, so the caller can omit the row rather
 * than print an empty one.
 */
export function formatBusinessHours(
  hours: BusinessHour[],
  dayName: (day: string) => string,
  /** Between the days and the times. Arabic writes its comma differently. */
  separator = ', '
): string | null {
  const open = hours
    .filter((entry) => entry.open && entry.close)
    .sort((a, b) => DAY_ORDER.indexOf(a.day as 'sunday') - DAY_ORDER.indexOf(b.day as 'sunday'))

  if (open.length === 0) return null

  const runs: Array<{ from: BusinessHour; to: BusinessHour }> = []

  for (const entry of open) {
    const last = runs.at(-1)
    const isNextDay =
      last !== undefined &&
      DAY_ORDER.indexOf(entry.day as 'sunday') === DAY_ORDER.indexOf(last.to.day as 'sunday') + 1
    const sameHours =
      last !== undefined && last.to.open === entry.open && last.to.close === entry.close

    if (last && isNextDay && sameHours) last.to = entry
    else runs.push({ from: entry, to: entry })
  }

  return runs
    .map(({ from, to }) => {
      const days =
        from.day === to.day ? dayName(from.day) : `${dayName(from.day)} – ${dayName(to.day)}`
      return `${days}${separator}${from.open} – ${from.close}`
    })
    .join(' · ')
}

export const officeAddressOneLine = (office: OfficeView) => office.addressLines.join(', ')

export const officeMapsUrl = (office: OfficeView) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${office.name}, ${officeAddressOneLine(office)}`
  )}`
