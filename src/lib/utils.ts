import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional class names, with later Tailwind utilities winning. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Locale-aware date formatting. Always pass the active locale explicitly. */
export function formatDate(
  date: Date | string | number,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }
): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Riyadh', ...options }).format(
    new Date(date)
  )
}

/** Locale-aware number formatting. */
export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

/** URL-safe slug. Falls back to a stable token when the input is non-Latin. */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return slug || `item-${Math.random().toString(36).slice(2, 8)}`
}

/** Roughly 200 words per minute, minimum 1. */
export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/** Truncates on a word boundary. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, text.lastIndexOf(' ', max)).trimEnd()}…`
}

/**
 * Masks a value for audit logs and error reports so secrets and personal data
 * never reach a log sink in clear text.
 */
export function mask(value: string | null | undefined): string {
  if (!value) return ''
  if (value.length <= 4) return '•'.repeat(value.length)
  return `${value.slice(0, 2)}${'•'.repeat(Math.min(8, value.length - 4))}${value.slice(-2)}`
}

/**
 * The company's operating timezone.
 *
 * Every date the application renders is formatted in it (see
 * `src/i18n/request.ts`), so an admin scheduling a post for "09:00" means
 * 09:00 in Jeddah — not 09:00 wherever the server happens to run.
 */
export const COMPANY_TIME_ZONE = 'Asia/Riyadh'

/** The zone's UTC offset, in milliseconds, at a given instant. */
function zoneOffset(instant: Date, timeZone: string): number {
  // Formatting the same instant in the target zone and in UTC, then reading
  // both back as if they were UTC, yields the offset. This follows DST, so it
  // stays correct for zones that observe it.
  const inZone = new Date(instant.toLocaleString('en-US', { timeZone }))
  const inUtc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }))
  return inZone.getTime() - inUtc.getTime()
}

/**
 * Formats an instant for an `<input type="datetime-local">`, in company time.
 *
 * Safe to call on the server: the result does not depend on the host's
 * timezone, so the server render and the client hydration agree.
 */
export function toDateTimeLocalInput(
  value: Date | null | undefined,
  timeZone: string = COMPANY_TIME_ZONE
): string {
  if (!value) return ''
  return new Date(value.getTime() + zoneOffset(value, timeZone)).toISOString().slice(0, 16)
}

/**
 * Parses an `<input type="datetime-local">` value as a wall-clock time in
 * company time, returning the instant it denotes.
 *
 * Returns null for an empty or unparseable value — a cleared date field means
 * "not set", which must not fail the whole form.
 */
export function fromDateTimeLocalInput(
  value: string | null | undefined,
  timeZone: string = COMPANY_TIME_ZONE
): Date | null {
  if (!value) return null

  // The shape is checked explicitly: `new Date()` parses some malformed strings
  // leniently and would turn junk into a real — and wrong — date.
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?$/.exec(value.trim())
  if (!match) return null

  // Read the wall-clock digits as if they were UTC, then subtract the zone's
  // offset at that moment to get the real instant.
  const asUtc = new Date(`${match[1]}:00Z`)
  if (Number.isNaN(asUtc.getTime())) return null

  return new Date(asUtc.getTime() - zoneOffset(asUtc, timeZone))
}
