import {
  RfqOrderClass,
  RfqStatus,
  RfqTrackStatus,
  RfqWorkflowStage,
  UserRole,
} from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  applyWorkflowAction,
  availableActions,
  isWaitingOn,
  responsiblePermissions,
  rolesWithPermission,
  TECHNICAL_STUDY_DAYS,
  type WorkflowState,
} from '../rfq-workflow'

/**
 * The internal quotation process.
 *
 * These tests are the specification of the company's business model: who may
 * move a file, from where, and what the client is told while it moves. The
 * expensive failures here are silent ones — a desk able to skip another, or a
 * quotation reaching the client without approval — so both are pinned
 * explicitly rather than left to the UI to prevent.
 */

const START: WorkflowState = {
  workflowStage: RfqWorkflowStage.INTAKE,
  procurementStatus: RfqTrackStatus.PENDING,
  shippingStatus: RfqTrackStatus.PENDING,
  orderClass: null,
}

const at = (overrides: Partial<WorkflowState>): WorkflowState => ({ ...START, ...overrides })

describe('desk permissions', () => {
  it('lets each desk take only its own hand-off', () => {
    expect(applyWorkflowAction(UserRole.CUSTOMER_SERVICE, START, 'forward_to_supply').ok).toBe(true)

    // Procurement cannot start the file moving, and supply chain cannot price.
    expect(applyWorkflowAction(UserRole.PROCUREMENT_MANAGER, START, 'forward_to_supply')).toEqual({
      ok: false,
      error: 'forbidden',
    })
    expect(
      applyWorkflowAction(
        UserRole.SUPPLY_CHAIN_MANAGER,
        at({ workflowStage: RfqWorkflowStage.PRICING }),
        'submit_procurement',
        { amount: 5000 }
      )
    ).toEqual({ ok: false, error: 'forbidden' })
  })

  it('refuses an action taken from the wrong stage', () => {
    expect(
      applyWorkflowAction(
        UserRole.SUPPLY_CHAIN_MANAGER,
        at({ workflowStage: RfqWorkflowStage.PRICING }),
        'dispatch_pricing'
      )
    ).toEqual({ ok: false, error: 'wrong_stage' })
  })

  it('keeps the accountant and the technical office out of the pricing desks', () => {
    const pricing = at({ workflowStage: RfqWorkflowStage.PRICING })
    expect(
      applyWorkflowAction(UserRole.ACCOUNTANT, pricing, 'submit_procurement', { amount: 1 })
    ).toEqual({ ok: false, error: 'forbidden' })
    expect(
      applyWorkflowAction(UserRole.PMO_TECHNICAL, pricing, 'submit_shipping', { amount: 1 })
    ).toEqual({ ok: false, error: 'forbidden' })
  })

  it('refuses to price without a figure, and to report a study without a note', () => {
    const pricing = at({ workflowStage: RfqWorkflowStage.PRICING })
    expect(
      applyWorkflowAction(UserRole.LOGISTICS_SUPPORT, pricing, 'submit_shipping', { amount: 0 })
    ).toEqual({ ok: false, error: 'amount_required' })
    expect(
      applyWorkflowAction(
        UserRole.PMO_TECHNICAL,
        at({
          workflowStage: RfqWorkflowStage.PRICING,
          procurementStatus: RfqTrackStatus.TECHNICAL_REVIEW,
        }),
        'submit_technical',
        { note: '   ' }
      )
    ).toEqual({ ok: false, error: 'note_required' })
  })
})

describe('an ordinary order', () => {
  it('runs intake → supply chain → both prices → compilation', () => {
    const forwarded = expectOk(
      applyWorkflowAction(UserRole.CUSTOMER_SERVICE, START, 'forward_to_supply')
    )
    expect(forwarded.state.workflowStage).toBe(RfqWorkflowStage.SUPPLY_CHAIN)
    expect(forwarded.status).toBe(RfqStatus.UNDER_REVIEW)

    const dispatched = expectOk(
      applyWorkflowAction(UserRole.SUPPLY_CHAIN_MANAGER, forwarded.state, 'dispatch_pricing', {
        estimatedValueUsd: 40_000,
      })
    )
    expect(dispatched.state.workflowStage).toBe(RfqWorkflowStage.PRICING)
    expect(dispatched.status).toBe(RfqStatus.SUPPLIER_SOURCING)
    expect(dispatched.estimatedValueUsd).toBe(40_000)

    const priced = expectOk(
      applyWorkflowAction(UserRole.PROCUREMENT_MANAGER, dispatched.state, 'submit_procurement', {
        amount: 38_000,
      })
    )
    // Priced from the market without a study: an ordinary order.
    expect(priced.state.orderClass).toBe(RfqOrderClass.ORDINARY)
    // Freight has not reported yet, so the file stays in pricing.
    expect(priced.state.workflowStage).toBe(RfqWorkflowStage.PRICING)

    const shipped = expectOk(
      applyWorkflowAction(UserRole.LOGISTICS_SUPPORT, priced.state, 'submit_shipping', {
        amount: 4_200,
      })
    )
    expect(shipped.state.workflowStage).toBe(RfqWorkflowStage.COMPILATION)
  })

  it('moves on when the freight price arrives first', () => {
    const pricing = at({ workflowStage: RfqWorkflowStage.PRICING })
    const shipped = expectOk(
      applyWorkflowAction(UserRole.LOGISTICS_SUPPORT, pricing, 'submit_shipping', { amount: 900 })
    )
    expect(shipped.state.workflowStage).toBe(RfqWorkflowStage.PRICING)

    const priced = expectOk(
      applyWorkflowAction(UserRole.PROCUREMENT_MANAGER, shipped.state, 'submit_procurement', {
        amount: 12_000,
      })
    )
    expect(priced.state.workflowStage).toBe(RfqWorkflowStage.COMPILATION)
  })

  it('refuses a second price from the same desk', () => {
    const pricing = at({ workflowStage: RfqWorkflowStage.PRICING })
    const once = expectOk(
      applyWorkflowAction(UserRole.LOGISTICS_SUPPORT, pricing, 'submit_shipping', { amount: 900 })
    )
    expect(
      applyWorkflowAction(UserRole.LOGISTICS_SUPPORT, once.state, 'submit_shipping', {
        amount: 950,
      })
    ).toEqual({ ok: false, error: 'wrong_stage' })
  })
})

describe('a technical order', () => {
  it('goes to the technical office and comes back before it can be priced', () => {
    const pricing = at({ workflowStage: RfqWorkflowStage.PRICING })

    const sent = expectOk(
      applyWorkflowAction(
        UserRole.PROCUREMENT_MANAGER,
        pricing,
        'send_to_technical',
        {},
        new Date('2026-09-20T00:00:00Z')
      )
    )
    expect(sent.state.orderClass).toBe(RfqOrderClass.TECHNICAL)
    expect(sent.state.procurementStatus).toBe(RfqTrackStatus.TECHNICAL_REVIEW)
    expect(sent.technicalDueAt?.toISOString().slice(0, 10)).toBe('2026-09-26')
    expect(TECHNICAL_STUDY_DAYS).toBe(6)

    // Procurement must wait for the study.
    expect(
      applyWorkflowAction(UserRole.PROCUREMENT_MANAGER, sent.state, 'submit_procurement', {
        amount: 250_000,
      })
    ).toEqual({ ok: false, error: 'wrong_stage' })

    const studied = expectOk(
      applyWorkflowAction(UserRole.PMO_TECHNICAL, sent.state, 'submit_technical', {
        note: 'Material list attached: 14 line items.',
      })
    )
    expect(studied.state.procurementStatus).toBe(RfqTrackStatus.TECHNICAL_DONE)

    const priced = expectOk(
      applyWorkflowAction(UserRole.PROCUREMENT_MANAGER, studied.state, 'submit_procurement', {
        amount: 250_000,
      })
    )
    // The classification survives pricing: it was a technical order.
    expect(priced.state.orderClass).toBe(RfqOrderClass.TECHNICAL)
  })
})

describe('approval', () => {
  it('requires approval before the quotation is ready to send', () => {
    const compiled = at({ workflowStage: RfqWorkflowStage.COMPILATION })

    const submitted = expectOk(
      applyWorkflowAction(UserRole.SUPPLY_CHAIN_MANAGER, compiled, 'submit_for_approval')
    )
    expect(submitted.state.workflowStage).toBe(RfqWorkflowStage.APPROVAL)
    // Nothing the client sees changes yet.
    expect(submitted.status).toBeNull()

    // Supply chain cannot approve its own work.
    expect(applyWorkflowAction(UserRole.SUPPLY_CHAIN_MANAGER, submitted.state, 'approve')).toEqual({
      ok: false,
      error: 'forbidden',
    })

    const approved = expectOk(applyWorkflowAction(UserRole.ADMIN, submitted.state, 'approve'))
    expect(approved.state.workflowStage).toBe(RfqWorkflowStage.READY_TO_SEND)
    expect(approved.status).toBe(RfqStatus.QUOTATION_PREPARED)
  })

  it('sends a file back for rework with a reason', () => {
    const waiting = at({ workflowStage: RfqWorkflowStage.APPROVAL })
    expect(applyWorkflowAction(UserRole.ADMIN, waiting, 'return_to_supply')).toEqual({
      ok: false,
      error: 'note_required',
    })

    const returned = expectOk(
      applyWorkflowAction(UserRole.ADMIN, waiting, 'return_to_supply', {
        note: 'Freight looks high for this lane — please re-check.',
      })
    )
    expect(returned.state.workflowStage).toBe(RfqWorkflowStage.COMPILATION)
  })
})

describe('who the file is waiting on', () => {
  it('names the desk at each stage', () => {
    expect(responsiblePermissions(START)).toEqual(['rfq:stage:cs'])
    expect(responsiblePermissions(at({ workflowStage: RfqWorkflowStage.SUPPLY_CHAIN }))).toEqual([
      'rfq:stage:supply',
    ])
    expect(responsiblePermissions(at({ workflowStage: RfqWorkflowStage.APPROVAL }))).toEqual([
      'rfq:approve',
    ])
    expect(responsiblePermissions(at({ workflowStage: RfqWorkflowStage.SENT }))).toEqual([])
  })

  it('names both pricing desks, and drops each as it reports', () => {
    const pricing = at({ workflowStage: RfqWorkflowStage.PRICING })
    expect(responsiblePermissions(pricing)).toEqual(['rfq:stage:procurement', 'rfq:stage:shipping'])

    expect(
      responsiblePermissions({ ...pricing, procurementStatus: RfqTrackStatus.SUBMITTED })
    ).toEqual(['rfq:stage:shipping'])

    // While the study is out, the technical office is the one holding the file.
    expect(
      responsiblePermissions({ ...pricing, procurementStatus: RfqTrackStatus.TECHNICAL_REVIEW })
    ).toEqual(['rfq:stage:technical', 'rfq:stage:shipping'])
  })

  it('answers "is this mine" per role', () => {
    const pricing = at({ workflowStage: RfqWorkflowStage.PRICING })
    expect(isWaitingOn(UserRole.PROCUREMENT_MANAGER, pricing)).toBe(true)
    expect(isWaitingOn(UserRole.CUSTOMER_SERVICE, pricing)).toBe(false)
    expect(isWaitingOn(UserRole.CUSTOMER_SERVICE, START)).toBe(true)
  })
})

describe('the buttons a desk is offered', () => {
  it('offers only what that role can do now', () => {
    expect(availableActions(UserRole.CUSTOMER_SERVICE, START)).toEqual(['forward_to_supply'])
    expect(availableActions(UserRole.PROCUREMENT_MANAGER, START)).toEqual([])

    const pricing = at({ workflowStage: RfqWorkflowStage.PRICING })
    expect(availableActions(UserRole.PROCUREMENT_MANAGER, pricing)).toEqual([
      'send_to_technical',
      'submit_procurement',
    ])
    expect(availableActions(UserRole.LOGISTICS_SUPPORT, pricing)).toEqual(['submit_shipping'])
  })

  it('gives an administrator the approval desk', () => {
    expect(
      availableActions(UserRole.ADMIN, at({ workflowStage: RfqWorkflowStage.APPROVAL }))
    ).toEqual(['approve', 'return_to_supply'])
  })
})

describe('notification addressing', () => {
  it('finds the roles that staff a desk', () => {
    expect(rolesWithPermission('rfq:stage:technical')).toContain(UserRole.PMO_TECHNICAL)
    expect(rolesWithPermission('rfq:stage:shipping')).toContain(UserRole.LOGISTICS_SUPPORT)
    // Administrators hold every desk, so they are always reachable.
    expect(rolesWithPermission('rfq:stage:supply')).toContain(UserRole.ADMIN)
    // No client or supplier role is ever addressed by an internal hand-off.
    expect(rolesWithPermission('rfq:stage:cs')).not.toContain(UserRole.CLIENT_TEAM_MEMBER)
    expect(rolesWithPermission('rfq:approve')).not.toContain(UserRole.APPROVED_SUPPLIER)
  })
})

function expectOk(outcome: ReturnType<typeof applyWorkflowAction>) {
  if (!outcome.ok) throw new Error(`expected the action to be allowed, got ${outcome.error}`)
  return outcome.transition
}
