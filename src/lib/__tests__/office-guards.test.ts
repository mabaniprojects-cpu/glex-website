import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Office action guards.
 *
 * These rules are tested here rather than end-to-end because they depend on how
 * many offices exist in total. The E2E database is shared by both browser
 * projects, so an assertion about a global count races with whatever the other
 * project is doing — and proving "the last office cannot be deleted" through
 * the UI would mean clicking Delete on the seeded head office, which a stray
 * row from a parallel run would let succeed.
 */

const officeStore = {
  count: vi.fn<() => Promise<number>>(async () => 1),
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new-office', ...data })),
  update: vi.fn(async () => ({})),
  updateMany: vi.fn(async () => ({ count: 0 })),
  delete: vi.fn(async () => ({})),
  findUnique: vi.fn(async () => ({ id: 'office-1', name: 'Jeddah HQ', city: 'Jeddah' })),
}

vi.mock('@/lib/auth-guards', () => ({
  requirePermission: async () => ({ id: 'actor-1', role: 'SUPER_ADMIN', organizationId: null }),
}))

vi.mock('@/lib/audit', () => ({ recordAudit: async () => {} }))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

vi.mock('@/lib/db', () => ({
  db: {
    office: officeStore,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ office: officeStore }),
  },
}))

const { deleteOffice, saveOffice } = await import('@/lib/actions/office-actions')

const VALID_OFFICE = {
  name: 'GLEX Riyadh',
  city: 'Riyadh',
  country: 'Saudi Arabia',
}

describe('deleteOffice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    officeStore.findUnique.mockResolvedValue({ id: 'office-1', name: 'Jeddah HQ', city: 'Jeddah' })
  })

  it('refuses to remove the only office', async () => {
    // No others remain.
    officeStore.count.mockResolvedValue(0)

    const result = await deleteOffice({ id: '11111111-1111-4111-8111-111111111111' })

    expect(result).toEqual({ ok: false, error: 'last_office' })
    // The contact page would silently fall back to the hard-coded address and
    // stop reflecting anything an administrator does.
    expect(officeStore.delete).not.toHaveBeenCalled()
  })

  it('allows removal while another office remains', async () => {
    officeStore.count.mockResolvedValue(1)

    const result = await deleteOffice({ id: '11111111-1111-4111-8111-111111111111' })

    expect(result.ok).toBe(true)
    expect(officeStore.delete).toHaveBeenCalledOnce()
  })

  it('rejects an id that is not a uuid without touching the database', async () => {
    const result = await deleteOffice({ id: 'not-a-uuid' })

    expect(result).toEqual({ ok: false, error: 'validation' })
    expect(officeStore.findUnique).not.toHaveBeenCalled()
  })
})

describe('saveOffice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores an empty coordinate as unmapped rather than zero', async () => {
    await saveOffice({ ...VALID_OFFICE, latitude: '', longitude: '' })

    const { data } = officeStore.create.mock.calls[0][0] as { data: Record<string, unknown> }

    // Coercing `''` to 0 would drop a pin in the Gulf of Guinea and look like
    // real data rather than missing data.
    expect(data.latitude).toBeNull()
    expect(data.longitude).toBeNull()
  })

  it('splits the address into one line per row and drops blanks', async () => {
    await saveOffice({
      ...VALID_OFFICE,
      addressLines: 'King Road Tower\n\n  Floor 15  \nAsh Shati District\n',
    })

    const { data } = officeStore.create.mock.calls[0][0] as { data: Record<string, unknown> }

    expect(data.addressLines).toEqual(['King Road Tower', 'Floor 15', 'Ash Shati District'])
  })

  it('demotes every other office when one is marked head office', async () => {
    await saveOffice({ ...VALID_OFFICE, isPrimary: true })

    // Without this the contact page could order by `isPrimary` and get two
    // different answers on two requests.
    expect(officeStore.updateMany).toHaveBeenCalledWith({
      where: {},
      data: { isPrimary: false },
    })
  })

  it('leaves the other offices alone when the new one is not the head office', async () => {
    await saveOffice({ ...VALID_OFFICE, isPrimary: false })

    expect(officeStore.updateMany).not.toHaveBeenCalled()
  })

  it('refuses a latitude outside the valid range', async () => {
    const result = await saveOffice({ ...VALID_OFFICE, latitude: '120' })

    expect(result).toEqual({ ok: false, error: 'validation' })
    expect(officeStore.create).not.toHaveBeenCalled()
  })
})
