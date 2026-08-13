import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * RFQ attachment ownership.
 *
 * A Server Action payload is attacker-controlled, so a submission can name any
 * file id in the system. Attaching a stranger's document to your own RFQ would
 * then hand it to you from the confirmation page — so ownership is re-read from
 * the database rather than trusted.
 *
 * The database is mocked so the "someone else's file" case can be produced
 * exactly, which an end-to-end test cannot do without forging a Server Action
 * request.
 */

type FindManyArgs = {
  where: { id: { in: string[] }; uploadedById: string; deletedAt: null }
  select: unknown
}

const findMany = vi.fn<(args: FindManyArgs) => Promise<Array<{ id: string }>>>(async () => [])

vi.mock('@/lib/db', () => ({ db: { storedFile: { findMany: (a: FindManyArgs) => findMany(a) } } }))

const { resolveOwnedAttachments } = await import('@/lib/rfq-attachments')

describe('resolveOwnedAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes the query to the submitter, not just the submitted ids', async () => {
    findMany.mockResolvedValue([{ id: 'file-1' }])

    await resolveOwnedAttachments('user-1', ['file-1'])

    const { where } = findMany.mock.calls[0][0]
    // The ownership predicate is what makes this safe; without it the query
    // would happily return a stranger's file.
    expect(where.uploadedById).toBe('user-1')
    expect(where.deletedAt).toBeNull()
  })

  it('drops ids the database does not confirm as the submitter’s', async () => {
    // Two submitted, only one actually owned.
    findMany.mockResolvedValue([{ id: 'mine' }])

    const result = await resolveOwnedAttachments('user-1', ['mine', 'someone-elses'])

    expect(result).toEqual(['mine'])
    expect(result).not.toContain('someone-elses')
  })

  it('attaches nothing for a guest', async () => {
    // Guests have no session and therefore no uploads. The database is not even
    // consulted — there is nothing a guest could legitimately own.
    const result = await resolveOwnedAttachments(null, ['file-1', 'file-2'])

    expect(result).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it('does no work when nothing was submitted', async () => {
    expect(await resolveOwnedAttachments('user-1', undefined)).toEqual([])
    expect(await resolveOwnedAttachments('user-1', [])).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it('enforces its own cap rather than trusting the schema', async () => {
    // The schema caps at 5 client-side; this is the server's own limit, applied
    // even if a payload bypasses the form entirely.
    findMany.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({ id: `file-${index}` }))
    )

    const result = await resolveOwnedAttachments('user-1', Array.from({ length: 9 }, (_, i) => `file-${i}`))

    expect(result).toHaveLength(5)
  })
})
