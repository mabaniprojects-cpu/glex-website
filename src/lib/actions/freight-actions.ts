'use server'

import { InquiryType } from '@prisma/client'
import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { toDbLocale } from '@/i18n/locale'
import { db } from '@/lib/db'
import { internalRecipient, sendTemplate } from '@/lib/mail'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { nextReference, REFERENCE_SCOPES } from '@/lib/references'
import { absoluteUrl } from '@/lib/urls'
import { fromDateTimeLocalInput } from '@/lib/utils'
import { freightInquirySchema, type FreightInquiryInput } from '@/lib/validation/freight'

export type FreightResult =
  | { ok: true; reference: string }
  | { ok: false; error: 'validation' | 'rate_limited' | 'server'; fields?: Record<string, string> }

/**
 * Persists a freight quote request.
 *
 * Deliberately reuses the contact pipeline: the same `GLEX-INQ-` reference
 * series, the same consent record, the same rate limit and the same
 * notification path. A freight enquiry is a contact enquiry with structure, and
 * duplicating that machinery would mean two places to get consent evidence and
 * enumeration resistance right.
 *
 * The enquiry row and its freight detail are written in one transaction — a
 * reference must never name an enquiry whose details are missing.
 */
export async function submitFreightInquiry(input: FreightInquiryInput): Promise<FreightResult> {
  const parsed = freightInquirySchema.safeParse(input)

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

  // Shares the contact bucket: both are unauthenticated enquiry forms, so a bot
  // must not get a fresh allowance simply by switching between them.
  const limit = await checkRateLimit(`contact:${ip}`, 5, 60 * 60)
  if (!limit.allowed) return { ok: false, error: 'rate_limited' }

  try {
    const locale = await getLocale()
    const dbLocale = toDbLocale(locale)
    const userAgent = headerList.get('user-agent')?.slice(0, 500) ?? null

    const lane = `${data.originCountry} → ${data.destinationCountry}`

    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, REFERENCE_SCOPES.INQUIRY)

      const inquiry = await tx.contactInquiry.create({
        data: {
          reference: ref,
          type: InquiryType.FREIGHT_QUOTE,
          fullName: data.fullName,
          company: data.company || null,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          country: data.country || null,
          subject: `Freight quote: ${lane}`,
          // The structured detail lives alongside; this keeps the enquiry
          // readable in any view that only knows about contact enquiries.
          message: data.cargoDescription,
          locale: dbLocale,
          consentGiven: true,
          ipAddress: ip,
          userAgent,
        },
        select: { id: true },
      })

      await tx.freightInquiry.create({
        data: {
          inquiryId: inquiry.id,
          mode: data.mode,
          incoterm: data.incoterm || null,
          originCountry: data.originCountry,
          originCity: data.originCity || null,
          originPort: data.originPort || null,
          destinationCountry: data.destinationCountry,
          destinationCity: data.destinationCity || null,
          destinationPort: data.destinationPort || null,
          cargoDescription: data.cargoDescription,
          weightKg: data.weightKg,
          volumeCbm: data.volumeCbm,
          containerType: data.containerType || null,
          isHazardous: data.isHazardous ?? false,
          readyDate: fromDateTimeLocalInput(data.readyDate),
        },
      })

      // Consent is logged separately as standalone evidence.
      await tx.consentRecord.create({
        data: {
          purpose: 'CONTACT_FORM',
          granted: true,
          ipAddress: ip,
          userAgent,
        },
      })

      return ref
    })

    // --- Notifications (best effort) ---
    // The enquiry is committed; a mail outage must never lose it.

    await sendTemplate('contact-received', data.email.toLowerCase(), {
      locale: dbLocale,
      recipientName: data.fullName,
      details: [{ label: 'Reference', value: reference }],
    })

    const admin = internalRecipient()
    if (admin) {
      await sendTemplate('contact-received', admin, {
        locale: 'en',
        actionUrl: absoluteUrl('/en/admin/inquiries'),
        actionLabel: 'Open in the admin portal',
        details: [
          { label: 'Reference', value: reference },
          { label: 'Type', value: 'FREIGHT_QUOTE' },
          { label: 'Lane', value: lane },
          { label: 'Mode', value: data.mode },
          // Surfaced in the notification rather than left for someone to find:
          // dangerous goods change what can be carried and by whom.
          ...(data.isHazardous ? [{ label: 'Hazardous', value: 'Yes — declared' }] : []),
          { label: 'From', value: `${data.fullName} <${data.email.toLowerCase()}>` },
        ],
      })
    }

    return { ok: true, reference }
  } catch (error) {
    console.error('[freight] Failed to store inquiry:', error)
    return { ok: false, error: 'server' }
  }
}
