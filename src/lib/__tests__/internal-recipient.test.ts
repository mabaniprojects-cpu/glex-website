import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Which mailbox each kind of submission is announced to.
 *
 * This exists because every inbound flow — contact, RFQ, freight and supplier
 * registration — used to resolve to the single CONTACT_TO_EMAIL address. In
 * practice that is a shared `info@` mailbox that collects cold outreach, so an
 * RFQ (the highest-value inbound event there is) arrived looking exactly like
 * the vendor spam either side of it.
 *
 * The fallback chain is the part worth pinning: a deployment that sets only
 * CONTACT_TO_EMAIL must keep working unchanged, so adopting the new variables
 * can be done one at a time and never silently drops a notification.
 */

const envValues = vi.hoisted(() => ({
  current: {} as Record<string, string | undefined>,
}))

vi.mock('@/lib/env', () => ({
  env: () => envValues.current,
}))

// `@/lib/mail` reaches the template renderer, which imports the Prisma client
// at module load and throws without DATABASE_URL. Routing does not touch the
// database, so the client is stubbed rather than requiring one.
vi.mock('@/lib/db', () => ({ db: {} }))

const { internalRecipient } = await import('@/lib/mail')

function setEnv(values: Record<string, string | undefined>) {
  envValues.current = values
}

describe('internalRecipient', () => {
  beforeEach(() => setEnv({}))

  it('sends every channel to CONTACT_TO_EMAIL when nothing else is set', () => {
    setEnv({ CONTACT_TO_EMAIL: 'info@glex.test' })

    for (const channel of ['contact', 'rfq', 'freight', 'supplier'] as const) {
      expect(internalRecipient(channel)).toBe('info@glex.test')
    }
  })

  it('routes each channel to its own mailbox once configured', () => {
    setEnv({
      CONTACT_TO_EMAIL: 'info@glex.test',
      RFQ_TO_EMAIL: 'rfq@glex.test',
      SUPPLIER_TO_EMAIL: 'supplier@glex.test',
      FREIGHT_TO_EMAIL: 'freight@glex.test',
    })

    expect(internalRecipient('contact')).toBe('info@glex.test')
    expect(internalRecipient('rfq')).toBe('rfq@glex.test')
    expect(internalRecipient('supplier')).toBe('supplier@glex.test')
    expect(internalRecipient('freight')).toBe('freight@glex.test')
  })

  it('sends freight to the RFQ mailbox before falling back to contact', () => {
    // A freight quote is a commercial lead; it belongs where quotations are
    // handled, not in the general mailbox, unless given an address of its own.
    setEnv({ CONTACT_TO_EMAIL: 'info@glex.test', RFQ_TO_EMAIL: 'rfq@glex.test' })
    expect(internalRecipient('freight')).toBe('rfq@glex.test')

    setEnv({ CONTACT_TO_EMAIL: 'info@glex.test' })
    expect(internalRecipient('freight')).toBe('info@glex.test')
  })

  it('does not leak one channel’s address into another', () => {
    // Only the supplier mailbox is configured: everything else must still fall
    // back to contact rather than to whichever variable happens to be present.
    setEnv({ CONTACT_TO_EMAIL: 'info@glex.test', SUPPLIER_TO_EMAIL: 'supplier@glex.test' })

    expect(internalRecipient('supplier')).toBe('supplier@glex.test')
    expect(internalRecipient('rfq')).toBe('info@glex.test')
    expect(internalRecipient('freight')).toBe('info@glex.test')
    expect(internalRecipient('contact')).toBe('info@glex.test')
  })

  it('returns null rather than an address when nothing is configured', () => {
    // The callers treat null as "nobody to tell" and skip the send. Returning a
    // stray empty string here would attempt delivery to an invalid recipient.
    for (const channel of ['contact', 'rfq', 'freight', 'supplier'] as const) {
      expect(internalRecipient(channel)).toBeNull()
    }
  })
})
