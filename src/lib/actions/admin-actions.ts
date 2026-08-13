'use server'

import { RfqStatus, SupplierStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { sendTemplate } from '@/lib/mail'

/**
 * Admin mutations.
 *
 * Every action starts with its own permission guard — Server Actions POST to
 * the page's own URL, so a layout guard is not a security boundary — and every
 * state change writes both an `AuditLog` row and, for RFQs, an `RFQActivity`
 * row, inside the same transaction as the change itself.
 */

export type AdminActionResult = { ok: true } | { ok: false; error: string }

const rfqStatusSchema = z.object({
  reference: z.string().min(1).max(64),
  status: z.nativeEnum(RfqStatus),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
})

export async function updateRfqStatus(input: unknown): Promise<AdminActionResult> {
  const user = await requirePermission('rfq:manage')

  const parsed = rfqStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { reference, status, note } = parsed.data

  try {
    const rfq = await db.rFQ.findFirst({
      where: { reference, deletedAt: null },
      select: { id: true, status: true, createdById: true, guestEmail: true, locale: true },
    })
    if (!rfq) return { ok: false, error: 'not_found' }
    if (rfq.status === status) return { ok: true }

    await db.$transaction(async (tx) => {
      await tx.rFQ.update({ where: { id: rfq.id }, data: { status } })

      await tx.rFQActivity.create({
        data: {
          rfqId: rfq.id,
          actorId: user.id,
          action: 'STATUS_CHANGED',
          fromStatus: rfq.status,
          toStatus: status,
          metadata: note ? { note } : undefined,
        },
      })

      // An internal note is recorded as a staff-only message.
      if (note) {
        await tx.rFQMessage.create({
          data: { rfqId: rfq.id, authorId: user.id, body: note, isInternal: true },
        })
      }

      await recordAudit(
        {
          actorId: user.id,
          action: 'rfq.status_changed',
          entityType: 'RFQ',
          entityId: rfq.id,
          before: { status: rfq.status },
          after: { status, reference },
        },
        tx
      )
    })

    revalidatePath('/[locale]/admin/rfqs/[reference]', 'page')
    revalidatePath('/[locale]/admin/rfqs', 'page')
    return { ok: true }
  } catch (error) {
    console.error('[admin] updateRfqStatus failed:', error)
    return { ok: false, error: 'server' }
  }
}

const assignSchema = z.object({
  reference: z.string().min(1).max(64),
  // An empty string clears the assignment.
  assigneeId: z.union([z.string().uuid(), z.literal('')]),
})

export async function assignRfq(input: unknown): Promise<AdminActionResult> {
  const user = await requirePermission('rfq:assign')

  const parsed = assignSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { reference, assigneeId } = parsed.data

  try {
    const rfq = await db.rFQ.findFirst({
      where: { reference, deletedAt: null },
      select: { id: true, assigneeId: true },
    })
    if (!rfq) return { ok: false, error: 'not_found' }

    // Only real staff may be assigned.
    if (assigneeId) {
      const assignee = await db.user.findFirst({
        where: { id: assigneeId, isActive: true, deletedAt: null },
        select: { id: true },
      })
      if (!assignee) return { ok: false, error: 'not_found' }
    }

    await db.$transaction(async (tx) => {
      await tx.rFQ.update({
        where: { id: rfq.id },
        data: { assigneeId: assigneeId || null },
      })

      await tx.rFQActivity.create({
        data: {
          rfqId: rfq.id,
          actorId: user.id,
          action: assigneeId ? 'ASSIGNED' : 'UNASSIGNED',
          metadata: { assigneeId: assigneeId || null },
        },
      })

      await recordAudit(
        {
          actorId: user.id,
          action: 'rfq.assigned',
          entityType: 'RFQ',
          entityId: rfq.id,
          before: { assigneeId: rfq.assigneeId },
          after: { assigneeId: assigneeId || null, reference },
        },
        tx
      )
    })

    revalidatePath('/[locale]/admin/rfqs/[reference]', 'page')
    return { ok: true }
  } catch (error) {
    console.error('[admin] assignRfq failed:', error)
    return { ok: false, error: 'server' }
  }
}

const supplierDecisionSchema = z.object({
  supplierId: z.string().uuid(),
  status: z.enum([
    SupplierStatus.APPROVED,
    SupplierStatus.CONDITIONALLY_APPROVED,
    SupplierStatus.CLARIFICATION_REQUIRED,
    SupplierStatus.REJECTED,
    SupplierStatus.UNDER_REVIEW,
    SupplierStatus.SUSPENDED,
  ]),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
})

/** Approve, decline, suspend or request clarification on a supplier. */
export async function decideSupplier(input: unknown): Promise<AdminActionResult> {
  const user = await requirePermission('supplier:approve')

  const parsed = supplierDecisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  const { supplierId, status, note } = parsed.data

  try {
    const supplier = await db.supplierProfile.findFirst({
      where: { id: supplierId, deletedAt: null },
      select: {
        id: true,
        status: true,
        legalName: true,
        organizationId: true,
        organization: { select: { users: { select: { id: true, email: true, preferredLocale: true, name: true } } } },
      },
    })
    if (!supplier) return { ok: false, error: 'not_found' }

    await db.$transaction(async (tx) => {
      await tx.supplierProfile.update({
        where: { id: supplier.id },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedById: user.id,
          clarificationNote: status === SupplierStatus.CLARIFICATION_REQUIRED ? note || null : null,
          internalNotes: note || undefined,
        },
      })

      // Promote the supplier's users once approved so they gain catalogue
      // permissions; demote them if approval is withdrawn.
      const approved =
        status === SupplierStatus.APPROVED || status === SupplierStatus.CONDITIONALLY_APPROVED
      await tx.user.updateMany({
        where: {
          organizationId: supplier.organizationId,
          role: { in: ['PENDING_SUPPLIER', 'APPROVED_SUPPLIER'] },
        },
        data: { role: approved ? 'APPROVED_SUPPLIER' : 'PENDING_SUPPLIER' },
      })

      await recordAudit(
        {
          actorId: user.id,
          action: 'supplier.decision',
          entityType: 'SupplierProfile',
          entityId: supplier.id,
          before: { status: supplier.status },
          after: { status, legalName: supplier.legalName },
        },
        tx
      )
    })

    // Notify the supplier's contacts. Best effort: the decision is committed.
    const template =
      status === SupplierStatus.APPROVED || status === SupplierStatus.CONDITIONALLY_APPROVED
        ? 'supplier-approved'
        : status === SupplierStatus.REJECTED
          ? 'supplier-rejected'
          : status === SupplierStatus.CLARIFICATION_REQUIRED
            ? 'supplier-clarification'
            : null

    if (template) {
      for (const recipient of supplier.organization?.users ?? []) {
        await sendTemplate(template, recipient.email, {
          locale: recipient.preferredLocale,
          recipientName: recipient.name,
          details: note ? [{ label: 'Notes', value: note }] : undefined,
        })
      }
    }

    revalidatePath('/[locale]/admin/suppliers', 'page')
    revalidatePath('/[locale]/admin/suppliers/[id]', 'page')
    return { ok: true }
  } catch (error) {
    console.error('[admin] decideSupplier failed:', error)
    return { ok: false, error: 'server' }
  }
}

const inquiryStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['NEW', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'RESOLVED', 'CLOSED', 'SPAM']),
})

export async function updateInquiryStatus(input: unknown): Promise<AdminActionResult> {
  const user = await requirePermission('inquiry:manage')

  const parsed = inquiryStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }

  try {
    const inquiry = await db.contactInquiry.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
      select: { id: true, status: true, reference: true },
    })
    if (!inquiry) return { ok: false, error: 'not_found' }

    await db.$transaction(async (tx) => {
      await tx.contactInquiry.update({
        where: { id: inquiry.id },
        data: { status: parsed.data.status },
      })

      await recordAudit(
        {
          actorId: user.id,
          action: 'inquiry.status_changed',
          entityType: 'ContactInquiry',
          entityId: inquiry.id,
          before: { status: inquiry.status },
          after: { status: parsed.data.status, reference: inquiry.reference },
        },
        tx
      )
    })

    revalidatePath('/[locale]/admin/inquiries', 'page')
    return { ok: true }
  } catch (error) {
    console.error('[admin] updateInquiryStatus failed:', error)
    return { ok: false, error: 'server' }
  }
}
