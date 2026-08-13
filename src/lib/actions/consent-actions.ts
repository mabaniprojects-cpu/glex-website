'use server'

import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth-guards'
import { CONSENT_COOKIE, consentCookieOptions } from '@/lib/consent'
import { db } from '@/lib/db'
import { clientIp } from '@/lib/rate-limit'

/**
 * Records a cookie-consent decision.
 *
 * The cookie is what the application reads; the `ConsentRecord` row is the
 * evidence — who chose what, when, and from where. Both a grant and a refusal
 * are recorded: being able to show that someone declined matters as much as
 * being able to show that they agreed.
 */

export type ConsentActionResult = { ok: boolean }

const schema = z.object({ choice: z.enum(['all', 'essential']) })

export async function saveCookieConsent(input: unknown): Promise<ConsentActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false }

  const { choice } = parsed.data

  // Set first: the visitor's choice must take effect even if the evidence write
  // fails, and a banner that reappears after being dismissed is its own defect.
  ;(await cookies()).set(CONSENT_COOKIE, choice, consentCookieOptions())

  try {
    const headerList = await headers()
    const user = await getSessionUser()

    await db.consentRecord.create({
      data: {
        userId: user?.id ?? null,
        purpose: 'ANALYTICS',
        granted: choice === 'all',
        ipAddress: clientIp(headerList),
        userAgent: headerList.get('user-agent')?.slice(0, 500) ?? null,
      },
    })
  } catch (error) {
    console.error('[consent] Failed to record the consent decision:', error)
  }

  // The banner is rendered from the layout, so the whole tree re-renders.
  revalidatePath('/', 'layout')
  return { ok: true }
}
