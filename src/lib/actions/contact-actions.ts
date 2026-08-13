'use server'

import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { toDbLocale } from '@/i18n/locale'
import { db } from '@/lib/db'
import { internalRecipient, sendTemplate } from '@/lib/mail'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { nextReference } from '@/lib/references'
import { absoluteUrl } from '@/lib/urls'
import { contactSchema, type ContactInput } from '@/lib/validation/contact'

export type ContactResult =
  | { ok: true; reference: string }
  | { ok: false; error: 'validation' | 'rate_limited' | 'server'; fields?: Record<string, string> }

/**
 * Persists a contact enquiry.
 *
 * Server Actions are reachable by direct POST, not only through the UI, so this
 * re-validates every field regardless of what the client claims to have checked.
 */
export async function submitContactInquiry(input: ContactInput): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(input)

  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fields[key]) fields[key] = issue.message
    }
    return { ok: false, error: 'validation', fields }
  }

  const data = parsed.data

  // Silently accept-and-drop honeypot hits so bots get no useful signal.
  if (data.website) {
    return { ok: true, reference: 'GLEX-INQ-0000-000000' }
  }

  const headerList = await headers()
  const ip = clientIp(headerList)

  const limit = await checkRateLimit(`contact:${ip}`, 5, 60 * 60)
  if (!limit.allowed) return { ok: false, error: 'rate_limited' }

  try {
    const locale = await getLocale()
    const dbLocale = toDbLocale(locale)

    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, 'INQ')

      await tx.contactInquiry.create({
        data: {
          reference: ref,
          type: data.type,
          fullName: data.fullName,
          company: data.company || null,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          country: data.country || null,
          subject: data.subject,
          message: data.message,
          locale: dbLocale,
          consentGiven: true,
          ipAddress: ip,
          userAgent: headerList.get('user-agent')?.slice(0, 500) ?? null,
        },
      })

      // Consent is logged separately as standalone evidence.
      await tx.consentRecord.create({
        data: {
          purpose: 'CONTACT_FORM',
          granted: true,
          ipAddress: ip,
          userAgent: headerList.get('user-agent')?.slice(0, 500) ?? null,
        },
      })

      return ref
    })

    // --- Notifications (best effort) ---
    // The enquiry is already committed; a mail outage must never lose it, so
    // these are sent after the transaction and their failures are not fatal.

    await sendTemplate('contact-received', data.email.toLowerCase(), {
      locale: dbLocale,
      recipientName: data.fullName,
      details: [{ label: 'Reference', value: reference }],
    })

    // Without this, an enquiry is stored and nobody is ever told about it.
    const admin = internalRecipient()
    if (admin) {
      await sendTemplate('contact-received', admin, {
        // Internal mail is always English; staff are not per-locale.
        locale: 'en',
        actionUrl: absoluteUrl('/en/admin/inquiries'),
        actionLabel: 'Open in the admin portal',
        // The message body is deliberately not included: the portal is the one
        // record of it, and there is no reason to copy a stranger's personal
        // message into a shared mailbox.
        details: [
          { label: 'Reference', value: reference },
          { label: 'Type', value: data.type },
          { label: 'Subject', value: data.subject },
          { label: 'From', value: `${data.fullName} <${data.email.toLowerCase()}>` },
          ...(data.company ? [{ label: 'Company', value: data.company }] : []),
          ...(data.country ? [{ label: 'Country', value: data.country }] : []),
        ],
      })
    }

    return { ok: true, reference }
  } catch (error) {
    console.error('[contact] Failed to store inquiry:', error)
    return { ok: false, error: 'server' }
  }
}
