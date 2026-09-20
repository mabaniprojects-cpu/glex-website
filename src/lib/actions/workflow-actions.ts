'use server'

import { Prisma, RfqWorkflowTrack } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { requireUser } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { sendTemplate } from '@/lib/mail'
import {
  actionPermission,
  applyWorkflowAction,
  responsiblePermissions,
  rolesWithPermission,
  type WorkflowAction,
} from '@/lib/rfq-workflow'
import { isRfqClosed } from '@/lib/rfq-status'
import { can } from '@/lib/rbac'
import { absoluteUrl } from '@/lib/urls'

/**
 * Hand-offs in the internal quotation process.
 *
 * One action for every desk, because they share the same shape: check the move
 * is allowed for this role from this state, record who did what, move the file,
 * and tell whoever it now waits on. The rules themselves are in
 * `src/lib/rfq-workflow.ts` and are tested without a database.
 *
 * Everything a desk contributes — a price, a study, a compiled quotation — is
 * written as an `RFQWorkflowEntry` in the same transaction as the move, so the
 * file can always answer "where did this number come from, and who put it here".
 */

export type WorkflowActionResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'validation'
        | 'not_found'
        | 'closed'
        | 'forbidden'
        | 'wrong_stage'
        | 'note_required'
        | 'amount_required'
        | 'server'
    }

const schema = z.object({
  reference: z.string().min(3).max(64),
  action: z.enum([
    'forward_to_supply',
    'dispatch_pricing',
    'send_to_technical',
    'submit_technical',
    'submit_procurement',
    'submit_shipping',
    'submit_for_approval',
    'approve',
    'return_to_supply',
  ]),
  note: z.preprocess(blankToUndefined, z.string().max(4000).optional()),
  fileId: z.preprocess(blankToUndefined, z.string().uuid().optional()),
  amount: z.preprocess(numeric, z.number().positive().max(1_000_000_000).optional()),
  currency: z.preprocess(blankToUndefined, z.string().length(3).optional()),
  estimatedValueUsd: z.preprocess(numeric, z.number().positive().max(1_000_000_000).optional()),
})

/** Which desk an action is recorded against. */
const TRACKS: Record<WorkflowAction, RfqWorkflowTrack> = {
  forward_to_supply: RfqWorkflowTrack.INTAKE,
  dispatch_pricing: RfqWorkflowTrack.SUPPLY_CHAIN,
  send_to_technical: RfqWorkflowTrack.PROCUREMENT,
  submit_technical: RfqWorkflowTrack.TECHNICAL,
  submit_procurement: RfqWorkflowTrack.PROCUREMENT,
  submit_shipping: RfqWorkflowTrack.SHIPPING,
  submit_for_approval: RfqWorkflowTrack.COMPILATION,
  approve: RfqWorkflowTrack.APPROVAL,
  return_to_supply: RfqWorkflowTrack.APPROVAL,
}

export async function advanceRfqWorkflow(input: unknown): Promise<WorkflowActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation' }
  const data = parsed.data

  const user = await requireUser()

  // Checked before anything is read, so an unauthorized caller learns nothing
  // about which references exist.
  if (!can(user.role, actionPermission(data.action))) return { ok: false, error: 'forbidden' }

  const rfq = await db.rFQ.findFirst({
    where: { reference: data.reference, deletedAt: null },
    select: {
      id: true,
      status: true,
      workflowStage: true,
      procurementStatus: true,
      shippingStatus: true,
      orderClass: true,
    },
  })
  if (!rfq) return { ok: false, error: 'not_found' }

  // A cancelled, rejected or expired request is finished; moving it between
  // desks would put work into something nobody is waiting for.
  if (isRfqClosed(rfq.status)) return { ok: false, error: 'closed' }

  const outcome = applyWorkflowAction(
    user.role,
    {
      workflowStage: rfq.workflowStage,
      procurementStatus: rfq.procurementStatus,
      shippingStatus: rfq.shippingStatus,
      orderClass: rfq.orderClass,
    },
    data.action,
    { note: data.note, amount: data.amount, estimatedValueUsd: data.estimatedValueUsd }
  )
  if (!outcome.ok) return { ok: false, error: outcome.error }

  const { state, status, technicalDueAt, estimatedValueUsd } = outcome.transition

  try {
    await db.$transaction(async (tx) => {
      await tx.rFQ.update({
        where: { id: rfq.id },
        data: {
          workflowStage: state.workflowStage,
          procurementStatus: state.procurementStatus,
          shippingStatus: state.shippingStatus,
          orderClass: state.orderClass,
          ...(status ? { status } : {}),
          ...(technicalDueAt !== undefined ? { technicalDueAt } : {}),
          ...(estimatedValueUsd !== undefined
            ? {
                estimatedValueUsd:
                  estimatedValueUsd === null ? null : new Prisma.Decimal(estimatedValueUsd),
              }
            : {}),
        },
      })

      await tx.rFQWorkflowEntry.create({
        data: {
          rfqId: rfq.id,
          track: TRACKS[data.action],
          authorId: user.id,
          note: data.note ?? null,
          fileId: data.fileId ?? null,
          amount: data.amount === undefined ? null : new Prisma.Decimal(data.amount),
          currency: data.currency?.toUpperCase() ?? 'USD',
        },
      })

      await tx.rFQActivity.create({
        data: {
          rfqId: rfq.id,
          actorId: user.id,
          action: `WORKFLOW_${data.action.toUpperCase()}`,
          fromStatus: rfq.status,
          toStatus: status ?? rfq.status,
          metadata: {
            fromStage: rfq.workflowStage,
            toStage: state.workflowStage,
            ...(data.amount !== undefined ? { amount: data.amount } : {}),
          },
        },
      })

      // A note travels with the file as an internal message too: the desks read
      // the conversation, not the activity log.
      if (data.note?.trim()) {
        await tx.rFQMessage.create({
          data: { rfqId: rfq.id, authorId: user.id, body: data.note.trim(), isInternal: true },
        })
      }

      await recordAudit(
        {
          actorId: user.id,
          action: `rfq.workflow.${data.action}`,
          entityType: 'RFQ',
          entityId: rfq.id,
          before: { stage: rfq.workflowStage },
          after: { stage: state.workflowStage },
        },
        tx
      )
    })
  } catch (error) {
    console.error('[workflow] Failed to advance RFQ:', error)
    return { ok: false, error: 'server' }
  }

  // Best effort, after the move is committed: a mail outage must not undo work
  // that has already been done.
  await notifyNextDesk(data.reference, state)

  revalidatePath('/[locale]/admin/rfqs', 'page')
  revalidatePath(`/[locale]/admin/rfqs/${data.reference}`, 'page')
  return { ok: true }
}

/** Emails everyone whose desk the file now waits on. */
async function notifyNextDesk(
  reference: string,
  state: Parameters<typeof responsiblePermissions>[0]
) {
  const permissions = responsiblePermissions(state)
  if (permissions.length === 0) return

  const roles = [...new Set(permissions.flatMap(rolesWithPermission))]

  const recipients = await db.user.findMany({
    where: { role: { in: roles }, isActive: true, deletedAt: null, emailVerified: { not: null } },
    select: { email: true, name: true },
  })
  if (recipients.length === 0) return

  await Promise.all(
    recipients.map((recipient) =>
      sendTemplate('internal-rfq-stage', recipient.email, {
        // Internal mail is always English; staff are not per-locale.
        locale: 'en',
        recipientName: recipient.name,
        subjectSuffix: `${reference} · ${humanStage(state.workflowStage)}`,
        actionUrl: absoluteUrl(`/en/admin/rfqs/${reference}`),
        actionLabel: 'Open the request',
        details: [
          { label: 'Reference', value: reference },
          { label: 'Stage', value: humanStage(state.workflowStage) },
        ],
      })
    )
  )
}

function humanStage(stage: string): string {
  return stage.charAt(0) + stage.slice(1).toLowerCase().replace(/_/g, ' ')
}

function blankToUndefined(value: unknown) {
  return value === '' || value === null ? undefined : value
}

function numeric(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : value
}
