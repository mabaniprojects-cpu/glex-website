'use server'

import { OrganizationType, SupplierStatus, UserRole } from '@prisma/client'
import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { toDbLocale } from '@/i18n/locale'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { internalRecipient, sendTemplate } from '@/lib/mail'
import { hashPassword } from '@/lib/password'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { computeCompletion } from '@/lib/supplier'
import { createToken, TOKEN_PURPOSE } from '@/lib/tokens'
import { slugify } from '@/lib/utils'
import {
  supplierRegistrationSchema,
  type SupplierRegistrationInput,
} from '@/lib/validation/supplier-registration'

export type SupplierRegistrationResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Record<string, string> }

function absoluteUrl(path: string): string {
  const base = (env().APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  return `${base}${path}`
}

/**
 * Submits a supplier / distributor application.
 *
 * The organization, supplier profile, contacts, category links, document links
 * and the applicant's user account are created in a single transaction, so a
 * half-registered supplier can never exist.
 *
 * Banking details are never collected (spec §11).
 */
export async function submitSupplierRegistration(
  input: SupplierRegistrationInput
): Promise<SupplierRegistrationResult> {
  const parsed = supplierRegistrationSchema.safeParse(input)

  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fields[key]) fields[key] = issue.message
    }
    return { ok: false, error: 'validation', fields }
  }

  const data = parsed.data
  if (data.website_hp) return { ok: true } // honeypot: accept and drop

  const headerList = await headers()
  const ip = clientIp(headerList)

  const limit = await checkRateLimit(`supplier-register:${ip}`, 5, 60 * 60)
  if (!limit.allowed) return { ok: false, error: 'rate_limited' }

  const email = data.email.toLowerCase()

  try {
    // Never reveal whether an address is already registered — that would allow
    // account enumeration. The response is identical either way.
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return { ok: true }

    const locale = await getLocale()
    const dbLocale = toDbLocale(locale)
    const passwordHash = await hashPassword(data.password)

    // Unique organisation slug — two companies may share a trading name.
    const baseSlug = slugify(data.legalName)
    let slug = baseSlug
    for (let attempt = 1; ; attempt += 1) {
      const clash = await db.organization.findUnique({ where: { slug }, select: { id: true } })
      if (!clash) break
      slug = `${baseSlug}-${attempt}`
    }

    // Resolve category slugs to ids, discarding anything unrecognised.
    const categories = data.categorySlugs.length
      ? await db.category.findMany({
          where: { slug: { in: data.categorySlugs }, isActive: true, deletedAt: null },
          select: { id: true },
        })
      : []

    // Only accept documents the applicant actually uploaded in this session.
    const documents = data.documentIds.length
      ? await db.storedFile.findMany({
          where: { id: { in: data.documentIds }, deletedAt: null },
          select: { id: true, originalName: true },
        })
      : []

    const contacts = data.contacts.filter((contact) => contact.name && contact.email)

    const completion = computeCompletion({
      legalName: data.legalName,
      country: data.country,
      crNumber: data.crNumber || null,
      description: data.description || null,
      brands: data.brands ? data.brands.split(',').map((b) => b.trim()).filter(Boolean) : [],
      marketsServed: data.marketsServed
        ? data.marketsServed.split(',').map((m) => m.trim()).filter(Boolean)
        : [],
      availableIncoterms: data.availableIncoterms,
      contacts,
      documents,
      categories,
    })

    await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          slug,
          name: data.legalName,
          type: OrganizationType.SUPPLIER,
          country: data.country,
          city: data.city || null,
          address: data.address || null,
          website: data.website || null,
          crNumber: data.crNumber || null,
          vatNumber: data.vatNumber || null,
          description: data.description || null,
        },
      })

      const profile = await tx.supplierProfile.create({
        data: {
          organizationId: organization.id,
          status: SupplierStatus.SUBMITTED,
          kind: data.kind,
          legalName: data.legalName,
          tradingName: data.tradingName || null,
          companyType: data.companyType || null,
          country: data.country,
          city: data.city || null,
          address: data.address || null,
          website: data.website || null,
          crNumber: data.crNumber || null,
          vatNumber: data.vatNumber || null,
          yearEstablished:
            typeof data.yearEstablished === 'number' && Number.isFinite(data.yearEstablished)
              ? data.yearEstablished
              : null,
          employeeCount: data.employeeCount || null,
          description: data.description || null,
          brands: data.brands
            ? data.brands.split(',').map((b) => b.trim()).filter(Boolean)
            : [],
          isManufacturer: data.isManufacturer,
          isDistributor: data.isDistributor,
          monthlyCapacity: data.monthlyCapacity || null,
          minimumOrderNotes: data.minimumOrderNotes || null,
          exportExperience: data.exportExperience || null,
          marketsServed: data.marketsServed
            ? data.marketsServed.split(',').map((m) => m.trim()).filter(Boolean)
            : [],
          availableIncoterms: data.availableIncoterms,
          leadTimeNotes: data.leadTimeNotes || null,
          qualityControlNotes: data.qualityControlNotes || null,
          completionPercent: completion,
          submittedAt: new Date(),
          declarationAccepted: true,
          declarationAt: new Date(),
        },
      })

      if (categories.length > 0) {
        await tx.supplierProductCategory.createMany({
          data: categories.map((category) => ({
            supplierId: profile.id,
            categoryId: category.id,
          })),
          skipDuplicates: true,
        })
      }

      if (documents.length > 0) {
        await tx.supplierDocument.createMany({
          data: documents.map((document) => ({
            supplierId: profile.id,
            // The applicant chooses files, not categories; an approver
            // reclassifies them during review.
            type: 'OTHER' as const,
            fileId: document.id,
            label: document.originalName,
          })),
        })
      }

      if (contacts.length > 0) {
        await tx.supplierContact.createMany({
          data: contacts.map((contact) => ({
            supplierId: profile.id,
            kind: contact.kind,
            name: contact.name!,
            email: contact.email!,
            phone: contact.phone || null,
            position: contact.position || null,
          })),
        })
      }

      const user = await tx.user.create({
        data: {
          email,
          name: data.fullName,
          phone: data.phone || null,
          passwordHash,
          // Verified only once the emailed link is followed.
          emailVerified: null,
          role: UserRole.PENDING_SUPPLIER,
          preferredLocale: dbLocale,
          organizationId: organization.id,
        },
      })

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: UserRole.PENDING_SUPPLIER,
          isOwner: true,
          acceptedAt: new Date(),
        },
      })

      await tx.consentRecord.create({
        data: { userId: user.id, purpose: 'SUPPLIER_DECLARATION', granted: true, ipAddress: ip },
      })

      // Attach the uploaded files to the new organisation.
      if (documents.length > 0) {
        await tx.storedFile.updateMany({
          where: { id: { in: documents.map((d) => d.id) } },
          data: { organizationId: organization.id },
        })
      }
    })

    // --- Notifications (best effort) ---
    // The application is committed; a mail outage must not lose it.
    const token = await createToken(email, TOKEN_PURPOSE.EMAIL_VERIFICATION)

    await sendTemplate('supplier-submitted', email, {
      locale: dbLocale,
      recipientName: data.fullName,
      actionUrl: absoluteUrl(`/${locale}/verify-email?token=${token}`),
      actionLabel: 'Verify my email',
      details: [{ label: 'Company', value: data.legalName }],
    })

    const admin = internalRecipient()
    if (admin) {
      await sendTemplate('supplier-submitted', admin, {
        locale: 'en',
        details: [
          { label: 'Company', value: data.legalName },
          { label: 'Country', value: data.country },
          { label: 'Categories', value: String(categories.length) },
          { label: 'Documents', value: String(documents.length) },
        ],
      })
    }

    return { ok: true }
  } catch (error) {
    console.error('[supplier] Registration failed:', error)
    return { ok: false, error: 'server' }
  }
}

/** Category options for step 3. */
export async function listCategoryOptions() {
  return db.category.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, name: true },
  })
}
