import { UserRole } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Who hears about new work.
 *
 * Notifications went to a shared mailbox and nowhere else, so whether a
 * colleague saw an enquiry depended on whether someone had given them access to
 * `info@`. Addressing the desk by permission removes that dependency — and
 * introduces two failures worth pinning: emailing someone whose role no longer
 * does the work, and emailing the same person twice.
 */

/** Only the parts of a send the assertions below read. */
type SendArgs = [
  key: string,
  to: string,
  context: { recipientName?: string; subjectSuffix?: string },
  options?: { replyTo?: string | null },
]

const findMany = vi.hoisted(() => vi.fn())
const sendTemplate = vi.hoisted(() =>
  vi.fn<(...args: SendArgs) => Promise<{ ok: true }>>(async () => ({ ok: true }))
)

vi.mock('@/lib/db', () => ({ db: { user: { findMany } } }))
vi.mock('@/lib/mail', () => ({ sendTemplate }))

const { deskRecipients, notifyDesk, rolesWithPermission } =
  await import('@/lib/staff-notifications')

beforeEach(() => {
  findMany.mockReset()
  sendTemplate.mockClear()
  findMany.mockResolvedValue([
    { email: 'omer@glex.test', name: 'Omer' },
    { email: 'sales@glex.test', name: 'Sales' },
  ])
})

describe('which roles staff a desk', () => {
  it('reads the permission matrix rather than a hand-written list', () => {
    const roles = rolesWithPermission('inquiry:manage')

    expect(roles).toContain(UserRole.CUSTOMER_SERVICE)
    expect(roles).toContain(UserRole.SUPPORT_AGENT)
    // Administrators hold everything, so they are always reachable.
    expect(roles).toContain(UserRole.ADMIN)
  })

  it('never addresses a client or a supplier', () => {
    const roles = rolesWithPermission('inquiry:manage')

    expect(roles).not.toContain(UserRole.CLIENT_TEAM_MEMBER)
    expect(roles).not.toContain(UserRole.APPROVED_SUPPLIER)
  })

  it('leaves out desks that do not handle this work', () => {
    // The technical office and the accountant have no business in the inbox.
    const roles = rolesWithPermission('inquiry:manage')
    expect(roles).not.toContain(UserRole.PMO_TECHNICAL)
    expect(roles).not.toContain(UserRole.ACCOUNTANT)
  })
})

describe('who is actually written to', () => {
  it('asks only for accounts that can receive mail', async () => {
    await deskRecipients('inquiry:manage')

    const { where } = findMany.mock.calls[0][0]
    expect(where.isActive).toBe(true)
    expect(where.deletedAt).toBeNull()
    // An invited colleague who never signed in has not confirmed the address.
    expect(where.emailVerified).toEqual({ not: null })
  })

  it('writes to the specialists and not to every administrator', async () => {
    await deskRecipients('inquiry:manage')

    const { where } = findMany.mock.calls[0][0]
    expect(where.role.in).toContain(UserRole.CUSTOMER_SERVICE)
    // Administrators hold every permission; including them here would email the
    // owner about every enquiry the company receives.
    expect(where.role.in).not.toContain(UserRole.ADMIN)
    expect(where.role.in).not.toContain(UserRole.SUPER_ADMIN)
  })

  it('falls back to the administrators when nobody holds the desk', async () => {
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: 'owner@glex.test', name: 'Owner' }])

    const recipients = await deskRecipients('inquiry:manage')

    expect(recipients.map((person) => person.email)).toEqual(['owner@glex.test'])
    // Unstaffed work going unseen is the worse failure of the two.
    const { where } = findMany.mock.calls[1][0]
    expect(where.role.in).toEqual([UserRole.SUPER_ADMIN, UserRole.ADMIN])
  })

  it('sends one message per person', async () => {
    const count = await notifyDesk({
      permission: 'inquiry:manage',
      template: 'internal-contact',
      context: { locale: 'en' },
    })

    expect(count).toBe(2)
    expect(sendTemplate).toHaveBeenCalledTimes(2)
    expect(sendTemplate.mock.calls.map((call) => call[1])).toEqual([
      'omer@glex.test',
      'sales@glex.test',
    ])
  })

  it('does not write twice to someone who is also the shared mailbox', async () => {
    const count = await notifyDesk({
      permission: 'inquiry:manage',
      template: 'internal-contact',
      context: { locale: 'en' },
      alreadySent: 'Sales@GLEX.test',
    })

    expect(count).toBe(1)
    expect(sendTemplate.mock.calls.map((call) => call[1])).toEqual(['omer@glex.test'])
  })

  it('addresses each person by name and passes the reply address through', async () => {
    await notifyDesk({
      permission: 'inquiry:manage',
      template: 'internal-contact',
      context: { locale: 'en', subjectSuffix: 'GLEX-INQ-2026-000005' },
      replyTo: 'buyer@example.com',
    })

    const [, , context, options] = sendTemplate.mock.calls[0]
    expect(context.recipientName).toBe('Omer')
    expect(context.subjectSuffix).toBe('GLEX-INQ-2026-000005')
    // Pressing Reply answers the customer, not a no-reply address.
    expect(options?.replyTo).toBe('buyer@example.com')
  })

  it('sends nothing when the desk is empty', async () => {
    findMany.mockResolvedValue([])

    const count = await notifyDesk({
      permission: 'inquiry:manage',
      template: 'internal-contact',
      context: { locale: 'en' },
    })

    expect(count).toBe(0)
    expect(sendTemplate).not.toHaveBeenCalled()
  })
})
