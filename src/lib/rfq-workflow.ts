import {
  RfqOrderClass,
  RfqStatus,
  RfqTrackStatus,
  RfqWorkflowStage,
  UserRole,
} from '@prisma/client'
import { can, permissionsFor, type Permission } from '@/lib/rbac'

/**
 * The internal quotation process, as a set of rules rather than a set of
 * buttons.
 *
 * It follows the company's own business model: customer service receives the
 * enquiry and forwards it to supply chain; supply chain sends the bill of
 * quantities to procurement and an RFQ to the shipping desk; procurement
 * either prices an ordinary order from the market or sends a technical order
 * to PMO first; both prices return to supply chain, which compiles the
 * quotation; it is approved, and customer service sends it to the client.
 *
 * Two things are deliberate.
 *
 * First, the transitions live here as data and the function below is pure, so
 * the process can be tested without a database and a mistake in it shows up as
 * a failing test rather than a quotation sent to a client by accident.
 *
 * Second, the internal stage is separate from `RfqStatus`. The client's view
 * must not reveal which desk is holding their file, and the desks need more
 * detail than the client's status line can carry.
 */

export type WorkflowAction =
  | 'forward_to_supply'
  | 'dispatch_pricing'
  | 'send_to_technical'
  | 'submit_technical'
  | 'submit_procurement'
  | 'submit_shipping'
  | 'submit_for_approval'
  | 'approve'
  | 'return_to_supply'

/** The desks, in the order the file passes through them. */
export const WORKFLOW_STAGES: RfqWorkflowStage[] = [
  RfqWorkflowStage.INTAKE,
  RfqWorkflowStage.SUPPLY_CHAIN,
  RfqWorkflowStage.PRICING,
  RfqWorkflowStage.COMPILATION,
  RfqWorkflowStage.APPROVAL,
  RfqWorkflowStage.READY_TO_SEND,
  RfqWorkflowStage.SENT,
]

/** How long the technical office has to return a study, per the business model. */
export const TECHNICAL_STUDY_DAYS = 6

/**
 * At or above this estimate the technical study is not optional.
 *
 * The technical office is Mabani, a separate company in the group rather than a
 * GLEX desk, so this is a decision to consult someone outside the business: the
 * company's rule is that an order of this size is always referred to them.
 * Enforced rather than suggested, because the failure it prevents — quoting a
 * large technical order from the market alone — is expensive and only surfaces
 * once the order is won.
 *
 * The estimate is supply chain's judgement, so an approver can still price
 * without a study when that figure turns out to be wrong.
 */
export const TECHNICAL_ORDER_THRESHOLD_USD = 100_000

type Rule = {
  permission: Permission
  from: RfqWorkflowStage[]
  /** Extra conditions on the two parallel pricing tracks. */
  procurement?: RfqTrackStatus[]
  shipping?: RfqTrackStatus[]
  requiresNote?: boolean
  requiresAmount?: boolean
}

const RULES: Record<WorkflowAction, Rule> = {
  forward_to_supply: {
    permission: 'rfq:stage:cs',
    from: [RfqWorkflowStage.INTAKE],
  },
  dispatch_pricing: {
    permission: 'rfq:stage:supply',
    from: [RfqWorkflowStage.SUPPLY_CHAIN],
  },
  send_to_technical: {
    permission: 'rfq:stage:procurement',
    from: [RfqWorkflowStage.PRICING],
    procurement: [RfqTrackStatus.PENDING],
  },
  submit_technical: {
    permission: 'rfq:stage:technical',
    from: [RfqWorkflowStage.PRICING],
    procurement: [RfqTrackStatus.TECHNICAL_REVIEW],
    requiresNote: true,
  },
  submit_procurement: {
    permission: 'rfq:stage:procurement',
    from: [RfqWorkflowStage.PRICING],
    procurement: [RfqTrackStatus.PENDING, RfqTrackStatus.TECHNICAL_DONE],
    requiresAmount: true,
  },
  submit_shipping: {
    permission: 'rfq:stage:shipping',
    from: [RfqWorkflowStage.PRICING],
    shipping: [RfqTrackStatus.PENDING],
    requiresAmount: true,
  },
  submit_for_approval: {
    permission: 'rfq:stage:supply',
    from: [RfqWorkflowStage.COMPILATION],
  },
  approve: {
    permission: 'rfq:approve',
    from: [RfqWorkflowStage.APPROVAL],
  },
  return_to_supply: {
    permission: 'rfq:approve',
    from: [RfqWorkflowStage.APPROVAL],
    requiresNote: true,
  },
}

export function actionPermission(action: WorkflowAction): Permission {
  return RULES[action].permission
}

/** The state an action reads and may change. */
export type WorkflowState = {
  workflowStage: RfqWorkflowStage
  procurementStatus: RfqTrackStatus
  shippingStatus: RfqTrackStatus
  orderClass: RfqOrderClass | null
  /** Supply chain's estimate, which decides whether Mabani must be consulted. */
  estimatedValueUsd?: number | null
}

export type WorkflowInput = {
  note?: string | null
  amount?: number | null
  estimatedValueUsd?: number | null
}

export type WorkflowTransition = {
  state: WorkflowState
  /** Only set when the client-visible status should change too. */
  status: RfqStatus | null
  technicalDueAt?: Date | null
  estimatedValueUsd?: number | null
}

export type WorkflowOutcome =
  | { ok: true; transition: WorkflowTransition }
  | {
      ok: false
      error: 'forbidden' | 'wrong_stage' | 'note_required' | 'amount_required' | 'study_required'
    }

/**
 * Applies one action. Pure: no database, no clock beyond the `now` handed in,
 * so every branch is testable.
 */
export function applyWorkflowAction(
  role: UserRole,
  state: WorkflowState,
  action: WorkflowAction,
  input: WorkflowInput = {},
  now: Date = new Date()
): WorkflowOutcome {
  const rule = RULES[action]

  if (!can(role, rule.permission)) return { ok: false, error: 'forbidden' }
  if (!rule.from.includes(state.workflowStage)) return { ok: false, error: 'wrong_stage' }
  if (rule.procurement && !rule.procurement.includes(state.procurementStatus)) {
    return { ok: false, error: 'wrong_stage' }
  }
  if (rule.shipping && !rule.shipping.includes(state.shippingStatus)) {
    return { ok: false, error: 'wrong_stage' }
  }
  if (rule.requiresNote && !input.note?.trim()) return { ok: false, error: 'note_required' }
  if (rule.requiresAmount && !(typeof input.amount === 'number' && input.amount > 0)) {
    return { ok: false, error: 'amount_required' }
  }

  // A large order may not be priced from the market alone: Mabani is consulted
  // first. Whoever may approve the quotation may override, because the estimate
  // behind this rule is itself a judgement.
  if (
    action === 'submit_procurement' &&
    requiresTechnicalStudy(state) &&
    state.procurementStatus !== RfqTrackStatus.TECHNICAL_DONE &&
    !can(role, 'rfq:approve')
  ) {
    return { ok: false, error: 'study_required' }
  }

  const next: WorkflowState = { ...state }
  let status: RfqStatus | null = null
  let technicalDueAt: Date | null | undefined
  let estimatedValueUsd: number | null | undefined

  switch (action) {
    case 'forward_to_supply':
      next.workflowStage = RfqWorkflowStage.SUPPLY_CHAIN
      status = RfqStatus.UNDER_REVIEW
      break

    case 'dispatch_pricing':
      // Both desks start work at the same time — the two tracks are parallel,
      // which is what keeps a quotation inside the 4-6 day window.
      next.workflowStage = RfqWorkflowStage.PRICING
      next.procurementStatus = RfqTrackStatus.PENDING
      next.shippingStatus = RfqTrackStatus.PENDING
      status = RfqStatus.SUPPLIER_SOURCING
      estimatedValueUsd = input.estimatedValueUsd ?? null
      break

    case 'send_to_technical':
      next.procurementStatus = RfqTrackStatus.TECHNICAL_REVIEW
      next.orderClass = RfqOrderClass.TECHNICAL
      technicalDueAt = addDays(now, TECHNICAL_STUDY_DAYS)
      break

    case 'submit_technical':
      next.procurementStatus = RfqTrackStatus.TECHNICAL_DONE
      break

    case 'submit_procurement':
      next.procurementStatus = RfqTrackStatus.SUBMITTED
      // An order priced straight from the market is an ordinary one, by
      // definition: it never went to the technical office.
      next.orderClass = state.orderClass ?? RfqOrderClass.ORDINARY
      break

    case 'submit_shipping':
      next.shippingStatus = RfqTrackStatus.SUBMITTED
      break

    case 'submit_for_approval':
      next.workflowStage = RfqWorkflowStage.APPROVAL
      break

    case 'approve':
      next.workflowStage = RfqWorkflowStage.READY_TO_SEND
      status = RfqStatus.QUOTATION_PREPARED
      break

    case 'return_to_supply':
      next.workflowStage = RfqWorkflowStage.COMPILATION
      break
  }

  // The file leaves pricing by itself once both desks have reported. Waiting
  // for someone to notice and press a button is how quotations lose days.
  if (
    next.workflowStage === RfqWorkflowStage.PRICING &&
    next.procurementStatus === RfqTrackStatus.SUBMITTED &&
    next.shippingStatus === RfqTrackStatus.SUBMITTED
  ) {
    next.workflowStage = RfqWorkflowStage.COMPILATION
  }

  return {
    ok: true,
    transition: {
      state: next,
      status,
      ...(technicalDueAt !== undefined ? { technicalDueAt } : {}),
      ...(estimatedValueUsd !== undefined ? { estimatedValueUsd } : {}),
    },
  }
}

/** Whether this order is large enough that Mabani must be consulted first. */
export function requiresTechnicalStudy(state: WorkflowState): boolean {
  return (state.estimatedValueUsd ?? 0) >= TECHNICAL_ORDER_THRESHOLD_USD
}

/** Every action a role could take on this RFQ right now. */
export function availableActions(role: UserRole, state: WorkflowState): WorkflowAction[] {
  return (Object.keys(RULES) as WorkflowAction[]).filter((action) => {
    const outcome = applyWorkflowAction(role, state, action, {
      // Only the stage and permission checks matter here; the value checks are
      // the form's business, and failing them must not hide the button.
      note: 'probe',
      amount: 1,
    })
    return outcome.ok
  })
}

/**
 * Who is waiting on this file. Drives both the "needs action" queue and the
 * hand-off notification, so the two can never disagree.
 */
export function responsiblePermissions(state: WorkflowState): Permission[] {
  switch (state.workflowStage) {
    case RfqWorkflowStage.INTAKE:
      return ['rfq:stage:cs']
    case RfqWorkflowStage.SUPPLY_CHAIN:
    case RfqWorkflowStage.COMPILATION:
      return ['rfq:stage:supply']
    case RfqWorkflowStage.PRICING: {
      const waiting: Permission[] = []
      if (state.procurementStatus === RfqTrackStatus.TECHNICAL_REVIEW) {
        waiting.push('rfq:stage:technical')
      } else if (state.procurementStatus !== RfqTrackStatus.SUBMITTED) {
        waiting.push('rfq:stage:procurement')
      }
      if (state.shippingStatus !== RfqTrackStatus.SUBMITTED) waiting.push('rfq:stage:shipping')
      return waiting
    }
    case RfqWorkflowStage.APPROVAL:
      return ['rfq:approve']
    case RfqWorkflowStage.READY_TO_SEND:
      return ['rfq:stage:cs']
    case RfqWorkflowStage.SENT:
      return []
  }
}

/** Whether this role is the one the file is waiting on. */
export function isWaitingOn(role: UserRole, state: WorkflowState): boolean {
  return responsiblePermissions(state).some((permission) => can(role, permission))
}

/** The roles holding a permission — used to address hand-off notifications. */
export function rolesWithPermission(permission: Permission): UserRole[] {
  return Object.values(UserRole).filter((role) => permissionsFor(role).includes(permission))
}

function addDays(from: Date, days: number): Date {
  const result = new Date(from)
  result.setDate(result.getDate() + days)
  return result
}
