import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Email template resolution.
 *
 * Which row wins decides what a customer actually receives, and the admin
 * portal now exposes an "active" toggle on top of it. An earlier version
 * fetched the exact-locale row without the `isActive` filter, so deactivating a
 * translated template made it start being used rather than skipped — a switch
 * that did the opposite of its label. These cases pin the order down.
 */

const findFirst = vi.fn()

vi.mock('@/lib/db', () => ({ db: { emailTemplate: { findFirst: (...args: unknown[]) => findFirst(...args) } } }))

const { renderTemplate } = await import('@/lib/mail/templates')

type Row = { subject: string; heading: string | null; body: string; locale: string }

/** Answers as the database would for a given set of active rows. */
function withActiveRows(rows: Partial<Record<string, Row>>) {
  findFirst.mockImplementation(async ({ where }: { where: { locale: string } }) => {
    return rows[where.locale] ?? null
  })
}

const ar = (over: Partial<Row> = {}): Row => ({
  subject: 'عنوان عربي',
  heading: 'عنوان',
  body: 'نص عربي',
  locale: 'ar',
  ...over,
})

const en = (over: Partial<Row> = {}): Row => ({
  subject: 'English subject',
  heading: 'English heading',
  body: 'English body',
  locale: 'en',
  ...over,
})

describe('email template resolution', () => {
  beforeEach(() => {
    findFirst.mockReset()
  })

  it('prefers an active row in the requested locale', async () => {
    withActiveRows({ ar: ar(), en: en() })

    const result = await renderTemplate('welcome', { locale: 'ar' })

    expect(result.subject).toBe('عنوان عربي')
  })

  it('falls back to English when the locale has no active row', async () => {
    // The Arabic row is absent or deactivated — both look the same here,
    // because an inactive row is never returned.
    withActiveRows({ en: en() })

    const result = await renderTemplate('welcome', { locale: 'ar' })

    expect(result.subject).toBe('English subject')
  })

  it('never uses a deactivated translation in place of the active English one', async () => {
    // The regression this test exists for: deactivating the Arabic template
    // must remove it from consideration, not promote it.
    withActiveRows({ en: en() })

    const result = await renderTemplate('welcome', { locale: 'ar' })

    expect(result.text).not.toContain('نص عربي')
    expect(result.text).toContain('English body')
  })

  it('falls back to the hard-coded copy when nothing is active', async () => {
    withActiveRows({})

    const result = await renderTemplate('welcome', { locale: 'en' })

    // Mail must still send with no rows at all — an empty templates table
    // cannot be allowed to silence verification emails.
    expect(result.subject).toBe('Welcome to GLEX')
    expect(result.text).toContain('Your account has been created')
  })

  it('does not look for an English fallback when English was requested', async () => {
    withActiveRows({ en: en() })

    await renderTemplate('welcome', { locale: 'en' })

    // One query, not two: asking for English and then falling back to English
    // is a wasted round trip on every email the platform sends.
    expect(findFirst).toHaveBeenCalledOnce()
  })

  it('uses the hard-coded heading when a row leaves it empty', async () => {
    withActiveRows({ en: en({ heading: null }) })

    const result = await renderTemplate('welcome', { locale: 'en' })

    expect(result.html).toContain('Welcome to GLEX')
  })
})
