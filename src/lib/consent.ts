import { cookies } from 'next/headers'
import { CONSENT_COOKIE, isConsentChoice, type ConsentChoice } from '@/lib/consent-cookie'

/**
 * Cookie consent.
 *
 * The decision is stored in a first-party cookie and read on the SERVER, so a
 * script that requires consent is never sent to the browser in the first place
 * — rather than being sent and then conditionally suppressed. Nothing optional
 * loads until the visitor has actively chosen (spec §31).
 */

export { CONSENT_COOKIE, isConsentChoice, type ConsentChoice } from '@/lib/consent-cookie'

/** One year, the longest a consent record should be relied on without asking again. */
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365

/** The visitor's choice, or null when they have not chosen yet. */
export async function readConsent(): Promise<ConsentChoice | null> {
  const value = (await cookies()).get(CONSENT_COOKIE)?.value
  return isConsentChoice(value) ? value : null
}

/**
 * Whether optional analytics may run.
 *
 * Defaults to NO. An unset or malformed cookie must never be read as consent.
 */
export async function isAnalyticsAllowed(): Promise<boolean> {
  return (await readConsent()) === 'all'
}

export function consentCookieOptions() {
  return {
    // Not httpOnly: the choice is not a credential, and a future client-side
    // tag manager must be able to see it. It carries no personal data.
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CONSENT_MAX_AGE,
  }
}
