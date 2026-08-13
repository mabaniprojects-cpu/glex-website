'use server'

import { RfqStatus } from '@prisma/client'
import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { toDbLocale } from '@/i18n/locale'
import { getSessionUser } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { internalRecipient, sendTemplate } from '@/lib/mail'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { nextReference } from '@/lib/references'
import { resolveOwnedAttachments } from '@/lib/rfq-attachments'
import { readCart, writeCart } from '@/lib/rfq-cart'
import { createToken, TOKEN_PURPOSE } from '@/lib/tokens'
import { absoluteUrl } from '@/lib/urls'
import { rfqSubmitSchema, type RfqSubmitInput } from '@/lib/validation/rfq'

export type RfqSubmitResult =
  | { ok: true; reference: string; requiresVerification: boolean }
  | { ok: false; error: string; fields?: Record<string, string> }

/**
 * Submits a request for quotation.
 *
 * The RFQ, its line items and its first activity record are written in a single
 * transaction alongside the reference counter, so a reference is never issued
 * without a matching RFQ and two concurrent submissions cannot collide.
 *
 * Guest submissions are permitted (spec §10) but are marked unverified and
 * receive an email verification link before GLEX treats them as final.
 */
export async function submitRfq(input: RfqSubmitInput): Promise<RfqSubmitResult> {
  const parsed = rfqSubmitSchema.safeParse(input)

  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fields[key]) fields[key] = issue.message
    }
    return { ok: false, error: 'validation', fields }
  }

  const data = parsed.data
  if (data.website) {
    // Honeypot: accept and drop so bots learn nothing.
    return { ok: true, reference: 'GLEX-RFQ-0000-000000', requiresVerification: false }
  }

  const headerList = await headers()
  const ip = clientIp(headerList)

  const limit = await checkRateLimit(`rfq:${ip}`, 10, 60 * 60)
  if (!limit.allowed) return { ok: false, error: 'rate_limited' }

  // The session is the authority on identity — never the submitted fields.
  const user = await getSessionUser()
  const isGuest = !user

  if (isGuest && !data.guestEmail) {
    return { ok: false, error: 'validation', fields: { guestEmail: 'required' } }
  }

  const contactEmail = (user?.email ?? data.guestEmail ?? '').toLowerCase()
  if (!contactEmail) return { ok: false, error: 'validation', fields: { guestEmail: 'required' } }

  try {
    const locale = await getLocale()
    const dbLocale = toDbLocale(locale)

    // Re-read every catalogue line from the database. A tampered payload can
    // never introduce a product that is hidden, deleted or non-existent.
    const catalogueIds = data.items.map((item) => item.productId).filter(Boolean) as string[]
    const products = catalogueIds.length
      ? await db.product.findMany({
          where: { id: { in: catalogueIds }, isVisible: true, deletedAt: null },
          select: { id: true, name: true },
        })
      : []
    const productById = new Map(products.map((product) => [product.id, product]))

    // Scoped to files this user uploaded — see the helper for why.
    const attachmentIds = await resolveOwnedAttachments(user?.id ?? null, data.attachmentIds)

    const reference = await db.$transaction(async (tx) => {
      const ref = await nextReference(tx, 'RFQ')

      const rfq = await tx.rFQ.create({
        data: {
          reference: ref,
          status: RfqStatus.SUBMITTED,
          isGuest,
          guestName: isGuest ? data.guestName || null : null,
          guestEmail: isGuest ? contactEmail : null,
          guestCompany: isGuest ? data.guestCompany || null : null,
          guestPhone: isGuest ? data.guestPhone || null : null,
          // A guest RFQ is only considered verified once the link is followed.
          emailVerified: !isGuest,

          createdById: user?.id ?? null,
          organizationId: user?.organizationId ?? null,

          destinationCountry: data.destinationCountry,
          destinationCity: data.destinationCity || null,
          destinationPort: data.destinationPort || null,
          // `""` means "not selected".
          incoterm: data.incoterm || null,
          requiredDeliveryDate: data.requiredDeliveryDate
            ? new Date(data.requiredDeliveryDate)
            : null,
          preferredBrands: data.preferredBrands || null,
          allowEquivalents: data.allowEquivalents,
          projectName: data.projectName || null,
          projectDetails: data.projectDetails || null,
          notes: data.notes || null,
          locale: dbLocale,
          submittedAt: new Date(),

          items: {
            create: data.items.map((item, index) => ({
              // Only link a product id that survived the re-read.
              productId: item.productId && productById.has(item.productId) ? item.productId : null,
              name: item.productId
                ? (productById.get(item.productId)?.name ?? item.name)
                : item.name,
              quantity: item.quantity,
              unit: item.unit,
              brand: item.brand || null,
              specification: item.specification || null,
              sortOrder: index,
            })),
          },

          // Only ids that survived the ownership re-read above.
          attachments: {
            create: attachmentIds.map((fileId) => ({ fileId })),
          },

          activities: {
            create: [
              {
                actorId: user?.id ?? null,
                action: 'SUBMITTED',
                toStatus: RfqStatus.SUBMITTED,
                metadata: { source: isGuest ? 'guest' : 'client', ip },
              },
            ],
          },
        },
        select: { reference: true },
      })

      return rfq.reference
    })

    // --- Notifications (best effort) ---
    // The RFQ is already committed; a mail outage must never lose it.

    if (isGuest) {
      const token = await createToken(contactEmail, TOKEN_PURPOSE.EMAIL_VERIFICATION, {
        rfqReference: reference,
      })
      await sendTemplate('rfq-submitted', contactEmail, {
        locale: dbLocale,
        recipientName: data.guestName || undefined,
        actionUrl: absoluteUrl(`/${locale}/verify-email?token=${token}`),
        actionLabel: 'Verify my email',
        details: [{ label: 'Reference', value: reference }],
      })
    } else {
      await sendTemplate('rfq-submitted', contactEmail, {
        locale: dbLocale,
        recipientName: user?.name ?? undefined,
        actionUrl: absoluteUrl(`/${locale}/rfq/${reference}`),
        actionLabel: 'View my request',
        details: [{ label: 'Reference', value: reference }],
      })
    }

    const admin = internalRecipient()
    if (admin) {
      await sendTemplate('rfq-submitted', admin, {
        locale: 'en',
        details: [
          { label: 'Reference', value: reference },
          { label: 'Destination', value: data.destinationCountry },
          { label: 'Items', value: String(data.items.length) },
          { label: 'Submitted by', value: isGuest ? `Guest (${contactEmail})` : contactEmail },
        ],
      })
    }

    // The request has been captured; the cart has served its purpose.
    await writeCart([])

    return { ok: true, reference, requiresVerification: isGuest }
  } catch (error) {
    console.error('[rfq] Submission failed:', error)
    return { ok: false, error: 'server' }
  }
}

/**
 * Looks up an RFQ for the confirmation page.
 *
 * A reference alone reveals only status and line count — never contact details,
 * internal notes or another organisation's data. Signed-in owners see the full
 * record.
 */
export async function getRfqSummary(reference: string) {
  const user = await getSessionUser()

  const rfq = await db.rFQ.findFirst({
    where: { reference, deletedAt: null },
    select: {
      reference: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      destinationCountry: true,
      destinationCity: true,
      incoterm: true,
      projectName: true,
      emailVerified: true,
      createdById: true,
      organizationId: true,
      items: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, quantity: true, unit: true, brand: true },
      },
    },
  })

  if (!rfq) return null

  const isOwner =
    Boolean(user) &&
    (rfq.createdById === user!.id ||
      (rfq.organizationId !== null && rfq.organizationId === user!.organizationId))

  return {
    reference: rfq.reference,
    status: rfq.status,
    submittedAt: rfq.submittedAt ?? rfq.createdAt,
    emailVerified: rfq.emailVerified,
    itemCount: rfq.items.length,
    // Details are withheld from anyone who merely knows the reference.
    destinationCountry: isOwner ? rfq.destinationCountry : null,
    destinationCity: isOwner ? rfq.destinationCity : null,
    incoterm: isOwner ? rfq.incoterm : null,
    projectName: isOwner ? rfq.projectName : null,
    items: isOwner ? rfq.items : [],
    isOwner,
  }
}

/** Reads the cart for the RFQ builder. */
export async function getCartForRfq() {
  return readCart()
}
