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
  type WorkflowAction,
} from '@/lib/rfq-workflow'
import { isRfqClosed } from '@/lib/rfq-status'
import { deskRecipients } from '@/lib/staff-notifications'
import { technicalOfficeRecipients } from '@/lib/technical-office'
import { TECHNICAL_ORDER_THRESHOLD_USD } from '@/lib/rfq-workflow'
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
        | 'study_required'
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
      destinationCountry: true,
      projectName: true,
      workflowStage: true,
      procurementStatus: true,
      shippingStatus: true,
      orderClass: true,
      estimatedValueUsd: true,
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
      estimatedValueUsd: rfq.estimatedValueUsd === null ? null : Number(rfq.estimatedValueUsd),
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
  if (data.action === 'send_to_technical') {
    await referToTechnicalOffice({
      reference: data.reference,
      destination: rfq.destinationCountry,
      project: rfq.projectName,
      message: data.note ?? '',
      estimatedValueUsd: rfq.estimatedValueUsd === null ? null : Number(rfq.estimatedValueUsd),
      // Mabani replies to the person who asked, not to a no-reply address.
      replyTo: user.email,
      senderName: user.name ?? null,
    })
  } else {
    await notifyNextDesk(data.reference, state)
  }

  revalidatePath('/[locale]/admin/rfqs', 'page')
  revalidatePath(`/[locale]/admin/rfqs/${data.reference}`, 'page')
  return { ok: true }
}

/**
 * The referral itself: the message procurement reviewed, sent to Mabani.
 *
 * Addressed to a partner company rather than a colleague, so it carries no
 * admin link — they have no account here — and replies go to the person who
 * sent it. Failure is reported to the caller's log rather than thrown: the
 * referral is already recorded, and losing that record because mail was down
 * would be the worse outcome.
 */
async function referToTechnicalOffice({
  reference,
  destination,
  project,
  message,
  estimatedValueUsd,
  replyTo,
  senderName,
}: {
  reference: string
  destination: string
  project: string | null
  message: string
  estimatedValueUsd: number | null
  replyTo: string
  senderName: string | null
}) {
  const recipients = technicalOfficeRecipients()
  if (recipients.length === 0) return

  await Promise.all(
    recipients.map((person) =>
      sendTemplate(
        'external-technical-study',
        person.email,
        {
          locale: 'en',
          recipientName: person.name || undefined,
          subjectSuffix: `${reference} · ${destination}`,
          details: [
            { label: 'Reference', value: reference },
            { label: 'Destination', value: destination },
            ...(project ? [{ label: 'Project', value: project }] : []),
            ...(senderName ? [{ label: 'From', value: senderName }] : []),
            // Why they are being asked, in the message itself: the referral is
            // a rule about order size, and Mabani should see the figure that
            // triggered it rather than have to ask.
            ...(estimatedValueUsd !== null
              ? [
                  { label: 'Approximate order value', value: usd(estimatedValueUsd) },
                  {
                    label: 'Why this is referred',
                    value: `Above ${usd(TECHNICAL_ORDER_THRESHOLD_USD)} — GLEX refers orders of this size to the Mabani PMO for a technical study.`,
                  },
                ]
              : []),
            { label: 'Message', value: message },
          ],
        },
        { replyTo }
      )
    )
  )
}

/** Emails everyone whose desk the file now waits on. */
async function notifyNextDesk(
  reference: string,
  state: Parameters<typeof responsiblePermissions>[0]
) {
  const permissions = responsiblePermissions(state)
  if (permissions.length === 0) return

  // One desk at a time, through the shared lookup: it leaves administrators out
  // while a desk is staffed, so the owner is not emailed about every hand-off
  // in the company.
  const seen = new Set<string>()

  for (const permission of permissions) {
    const recipients = await deskRecipients(permission)

    for (const recipient of recipients) {
      const address = recipient.email.trim().toLowerCase()
      // Pricing waits on two desks at once, and an administrator staffs both.
      if (seen.has(address)) continue
      seen.add(address)

      await sendTemplate('internal-rfq-stage', address, {
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
    }
  }
}

/** Plain USD, for a reader outside the application. */
function usd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
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
