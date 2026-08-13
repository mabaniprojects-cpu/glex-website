/**
 * Shared list pagination.
 *
 * Admin lists were previously capped with no way to reach older rows, which
 * silently hid data from staff. Every admin list now goes through these helpers
 * so the page parameter is parsed and clamped identically everywhere.
 */

/** Rows per page in the admin portal. */
export const ADMIN_PAGE_SIZE = 25

/** Hard ceiling, so a hand-typed `?page=999999999` cannot ask for a huge skip. */
const MAX_PAGE = 1000

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Number((Array.isArray(value) ? value[0] : value) ?? '1')
  if (!Number.isFinite(raw) || raw < 1) return 1
  return Math.min(Math.floor(raw), MAX_PAGE)
}

export type PageWindow = {
  page: number
  skip: number
  take: number
}

export function pageWindow(
  value: string | string[] | undefined,
  take: number = ADMIN_PAGE_SIZE
): PageWindow {
  const page = parsePageParam(value)
  return { page, skip: (page - 1) * take, take }
}

/** Always at least 1, so an empty list still renders a coherent "page 1 of 1". */
export function pageCount(total: number, take: number = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / take))
}

/**
 * Builds an href for a target page, preserving every other active filter.
 *
 * `page=1` is omitted so the first page has one canonical URL.
 */
export function buildPageHref(
  basePath: string,
  rawParams: Record<string, string | string[] | undefined>,
  target: number
): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(rawParams)) {
    const single = Array.isArray(value) ? value[0] : value
    if (single && key !== 'page') params.set(key, single)
  }
  if (target > 1) params.set('page', String(target))

  const search = params.toString()
  return `${basePath}${search ? `?${search}` : ''}`
}
