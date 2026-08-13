import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Contact-form notifications.
 *
 * These exist because the enquiry was, for a time, stored correctly and
 * announced to nobody — the submitter got a reference and no member of staff
 * was ever told. Storing is not handling; this pins the notification down so
 * the same silence cannot return unnoticed.
 *
 * The action's collaborators are mocked so the assertions are about *who is
 * told what*, not about the database.
 */

type MailContext = {
  recipientName?: string
  actionUrl?: string
  actionLabel?: string
  details?: Array<{ label: string; value: string }>
}

const sendTemplate = vi.fn<(key: string, to: string, context: MailContext) => Promise<{ ok: true }>>(
  async () => ({ ok: true })
)
const internalRecipient = vi.fn<() => string | null>(() => 'ops@glex.test')

vi.mock('@/lib/mail', () => ({
  sendTemplate: (key: string, to: string, context: MailContext) => sendTemplate(key, to, context),
  internalRecipient: () => internalRecipient(),
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'user-agent': 'vitest' }),
}))

vi.mock('next-intl/server', () => ({ getLocale: async () => 'en' }))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async () => ({ allowed: true }),
  clientIp: () => '203.0.113.5',
}))

vi.mock('@/lib/references', () => ({
  nextReference: async () => 'GLEX-INQ-2026-000042',
}))

vi.mock('@/lib/urls', () => ({
  absoluteUrl: (path: string) => `https://glex.test${path}`,
}))

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        contactInquiry: { create: async () => ({}) },
        consentRecord: { create: async () => ({}) },
      }),
  },
}))

const { submitContactInquiry } = await import('@/lib/actions/contact-actions')

const VALID = {
  type: 'GENERAL' as const,
  fullName: 'Amina Osman',
  company: 'Osman Trading',
  email: 'Amina@Example.com',
  phone: '+971500000000',
  country: 'United Arab Emirates',
  subject: 'Cement enquiry',
  message: 'We are looking for ordinary Portland cement for a project in Dubai.',
  consent: true as const,
  website: '',
}

describe('contact enquiry notifications', () => {
  beforeEach(() => {
    sendTemplate.mockClear()
    internalRecipient.mockReturnValue('ops@glex.test')
  })

  it('acknowledges the sender and notifies staff', async () => {
    const result = await submitContactInquiry(VALID)
    expect(result).toEqual({ ok: true, reference: 'GLEX-INQ-2026-000042' })

    expect(sendTemplate).toHaveBeenCalledTimes(2)

    const [ackKey, ackTo, ackContext] = sendTemplate.mock.calls[0]
    expect(ackKey).toBe('contact-received')
    // Normalised, so a capitalised address still reaches the same mailbox.
    expect(ackTo).toBe('amina@example.com')
    expect(ackContext.recipientName).toBe('Amina Osman')

    const [staffKey, staffTo] = sendTemplate.mock.calls[1]
    expect(staffKey).toBe('contact-received')
    expect(staffTo).toBe('ops@glex.test')
  })

  it('gives staff the reference and a link, but not the message body', async () => {
    await submitContactInquiry(VALID)

    const context = sendTemplate.mock.calls[1][2]

    expect(context.actionUrl).toBe('https://glex.test/en/admin/inquiries')

    const byLabel = Object.fromEntries((context.details ?? []).map((d) => [d.label, d.value]))
    expect(byLabel.Reference).toBe('GLEX-INQ-2026-000042')
    expect(byLabel.From).toBe('Amina Osman <amina@example.com>')

    // The portal is the single record of the message itself; there is no reason
    // to copy a stranger's personal text into a shared mailbox.
    const serialised = JSON.stringify(context)
    expect(serialised).not.toContain('ordinary Portland cement')
  })

  it('still acknowledges the sender when no internal address is configured', async () => {
    internalRecipient.mockReturnValue(null)

    const result = await submitContactInquiry(VALID)

    expect(result.ok).toBe(true)
    // The sender is never punished for a missing CONTACT_TO_EMAIL.
    expect(sendTemplate).toHaveBeenCalledTimes(1)
    expect(sendTemplate.mock.calls[0][1]).toBe('amina@example.com')
  })

  it('sends nothing for a honeypot hit', async () => {
    const result = await submitContactInquiry({ ...VALID, website: 'http://spam.example' })

    expect(result.ok).toBe(true)
    // Accepted and dropped: a bot must learn nothing, and staff must not be
    // paged for it.
    expect(sendTemplate).not.toHaveBeenCalled()
  })
})
