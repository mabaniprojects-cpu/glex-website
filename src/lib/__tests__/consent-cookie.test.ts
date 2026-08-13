import { describe, expect, it } from 'vitest'
import { analyticsAllowedFromCookieString } from '@/lib/consent-cookie'

/**
 * The client-side consent gate.
 *
 * This decides whether the browser error reporter is initialised at all, so a
 * bug that reads consent too generously starts sending a visitor's data to a
 * third party they declined. Every case below is a way that could happen.
 */

describe('analyticsAllowedFromCookieString', () => {
  it('allows only an explicit "all"', () => {
    expect(analyticsAllowedFromCookieString('GLEX_CONSENT=all')).toBe(true)
  })

  it('refuses an essential-only choice', () => {
    expect(analyticsAllowedFromCookieString('GLEX_CONSENT=essential')).toBe(false)
  })

  it('refuses a visitor who has not chosen', () => {
    expect(analyticsAllowedFromCookieString('')).toBe(false)
    expect(analyticsAllowedFromCookieString('other=1; another=2')).toBe(false)
  })

  it('refuses a malformed value rather than guessing', () => {
    expect(analyticsAllowedFromCookieString('GLEX_CONSENT=')).toBe(false)
    expect(analyticsAllowedFromCookieString('GLEX_CONSENT=ALL')).toBe(false)
    expect(analyticsAllowedFromCookieString('GLEX_CONSENT=allow')).toBe(false)
    expect(analyticsAllowedFromCookieString('GLEX_CONSENT=all,essential')).toBe(false)
  })

  it('is not fooled by a cookie whose name merely ends in the real one', () => {
    // `document.cookie` is attacker-influencable: any script, and any other
    // subdomain, can set cookies. A substring match here would be a consent bypass.
    expect(analyticsAllowedFromCookieString('NOT_GLEX_CONSENT=all')).toBe(false)
    expect(analyticsAllowedFromCookieString('X_GLEX_CONSENT=all; GLEX_CONSENT=essential')).toBe(
      false
    )
  })

  it('finds the cookie wherever it sits in the string', () => {
    expect(analyticsAllowedFromCookieString('a=1; GLEX_CONSENT=all; b=2')).toBe(true)
    // Browsers join with "; ", but a lone ";" must not defeat it either.
    expect(analyticsAllowedFromCookieString('a=1;GLEX_CONSENT=all')).toBe(true)
  })
})
