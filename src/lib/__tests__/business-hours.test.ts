import { describe, expect, it } from 'vitest'
import { formatBusinessHours, type BusinessHour } from '@/lib/office-view'

/**
 * How opening hours read on the contact page.
 *
 * They were typed into the component as "Sunday – Thursday, 09:00 – 18:00"
 * while the office record said something else, so correcting them meant a
 * deploy — and the two could disagree indefinitely without anyone noticing.
 */

const day = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

const hour = (name: string, open: string | null, close: string | null): BusinessHour => ({
  day: name,
  open,
  close,
})

const SAUDI_WEEK: BusinessHour[] = [
  hour('sunday', '08:00', '17:00'),
  hour('monday', '08:00', '17:00'),
  hour('tuesday', '08:00', '17:00'),
  hour('wednesday', '08:00', '17:00'),
  hour('thursday', '08:00', '17:00'),
  hour('friday', null, null),
  hour('saturday', null, null),
]

describe('the opening hours line', () => {
  it('collapses a run of identical days into one phrase', () => {
    expect(formatBusinessHours(SAUDI_WEEK, day)).toBe('Sunday – Thursday, 08:00 – 17:00')
  })

  it('starts the week on Sunday however the rows are ordered', () => {
    const shuffled = [...SAUDI_WEEK].reverse()
    expect(formatBusinessHours(shuffled, day)).toBe('Sunday – Thursday, 08:00 – 17:00')
  })

  it('keeps a day that differs separate', () => {
    const withShortThursday = SAUDI_WEEK.map((entry) =>
      entry.day === 'thursday' ? hour('thursday', '08:00', '13:00') : entry
    )

    expect(formatBusinessHours(withShortThursday, day)).toBe(
      'Sunday – Wednesday, 08:00 – 17:00 · Thursday, 08:00 – 13:00'
    )
  })

  it('names a single open day on its own', () => {
    expect(formatBusinessHours([hour('sunday', '08:00', '17:00')], day)).toBe(
      'Sunday, 08:00 – 17:00'
    )
  })

  it('does not join days that are not consecutive', () => {
    const skipWednesday = SAUDI_WEEK.filter((entry) => entry.day !== 'wednesday')

    expect(formatBusinessHours(skipWednesday, day)).toBe(
      'Sunday – Tuesday, 08:00 – 17:00 · Thursday, 08:00 – 17:00'
    )
  })

  it('returns nothing when no hours are recorded, so the row can be omitted', () => {
    expect(formatBusinessHours([], day)).toBeNull()
    expect(formatBusinessHours([hour('friday', null, null)], day)).toBeNull()
  })
})
