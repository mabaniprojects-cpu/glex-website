import { describe, expect, it } from 'vitest'
import {
  COMPANY_TIME_ZONE,
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from '../utils'

/**
 * The news editor stores a publication instant but edits it as a wall-clock
 * time. Both directions must use the COMPANY timezone, not the host's, or a
 * server running in UTC would shift every scheduled article by three hours.
 */

describe('toDateTimeLocalInput', () => {
  it('renders an instant as company-local wall-clock time', () => {
    // 2026-08-10T06:00Z is 09:00 in Riyadh (UTC+3).
    expect(toDateTimeLocalInput(new Date('2026-08-10T06:00:00Z'))).toBe('2026-08-10T09:00')
  })

  it('returns an empty string for a missing date', () => {
    expect(toDateTimeLocalInput(null)).toBe('')
    expect(toDateTimeLocalInput(undefined)).toBe('')
  })

  it('does not depend on the host timezone', () => {
    // Same instant, formatted explicitly in two zones three hours apart.
    const instant = new Date('2026-01-05T21:30:00Z')
    expect(toDateTimeLocalInput(instant, 'UTC')).toBe('2026-01-05T21:30')
    expect(toDateTimeLocalInput(instant, COMPANY_TIME_ZONE)).toBe('2026-01-06T00:30')
  })
})

describe('fromDateTimeLocalInput', () => {
  it('reads a wall-clock time as company time', () => {
    expect(fromDateTimeLocalInput('2026-08-10T09:00')?.toISOString()).toBe(
      '2026-08-10T06:00:00.000Z'
    )
  })

  it('treats an empty or unparseable value as not set', () => {
    expect(fromDateTimeLocalInput('')).toBeNull()
    expect(fromDateTimeLocalInput(undefined)).toBeNull()
    expect(fromDateTimeLocalInput('not-a-date')).toBeNull()
  })
})

describe('round trip', () => {
  it.each([
    '2026-08-10T09:00',
    '2026-01-01T00:00',
    '2026-12-31T23:59',
    // Northern-summer date, to catch a zone that observes DST.
    '2026-07-04T12:15',
  ])('survives %s unchanged', (wall) => {
    const instant = fromDateTimeLocalInput(wall)
    expect(instant).not.toBeNull()
    expect(toDateTimeLocalInput(instant)).toBe(wall)
  })
})
