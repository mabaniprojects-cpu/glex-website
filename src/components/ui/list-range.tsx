import { getTranslations } from 'next-intl/server'

/**
 * "Showing 26–50 of 137" above a paginated list.
 *
 * These lists used to print the total alone, which gave no indication that the
 * rows on screen were only part of it.
 */
export async function ListRange({
  page,
  take,
  count,
  total,
}: {
  page: number
  take: number
  /** Rows actually rendered on this page. */
  count: number
  total: number
}) {
  const common = await getTranslations('common')

  // A page past the end returns no rows. Reporting its nominal offsets would
  // read as "Showing 126–125 of 113", so an empty page shows a zero range.
  const from = count === 0 ? 0 : (page - 1) * take + 1
  const to = count === 0 ? 0 : from + count - 1

  return (
    <p className="mt-2 text-sm text-glex-green-800/70">
      {common('showingRange', { from, to, total })}
    </p>
  )
}
