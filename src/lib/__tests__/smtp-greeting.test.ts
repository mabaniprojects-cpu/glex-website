import { describe, expect, it, vi } from 'vitest'

/**
 * The name the SMTP transport announces itself with.
 *
 * Production mail was received by PUIUX with "helo=[127.0.0.1]", because
 * nodemailer falls back to the container's hostname. The greeting now uses the
 * site's own hostname; this pins that so it cannot quietly regress.
 */

vi.mock('@/lib/env', () => ({
  env: () => ({
    EMAIL_PROVIDER: 'smtp',
    APP_URL: 'https://www.exporthouse.com.sa',
    SMTP_HOST: 'mail.example.test',
    SMTP_PORT: 465,
    SMTP_USER: 'noreply@example.test',
    SMTP_PASSWORD: 'x',
    SMTP_FROM: 'GLEX <noreply@example.test>',
  }),
}))

// `@/lib/mail` reaches the template renderer, which imports the Prisma client.
vi.mock('@/lib/db', () => ({ db: {} }))

const createTransport = vi.hoisted(() =>
  vi.fn((_options: Record<string, unknown>) => ({
    sendMail: async () => ({ messageId: 'test' }),
  }))
)
vi.mock('nodemailer', () => ({ default: { createTransport } }))

const { sendMail } = await import('@/lib/mail')

describe('SMTP transport', () => {
  it('greets the mail server with the site hostname, not the container default', async () => {
    const result = await sendMail({
      to: 'a@example.test',
      subject: 's',
      html: '<p>h</p>',
      text: 't',
    })

    expect(result.ok).toBe(true)
    expect(createTransport.mock.calls[0]![0].name).toBe('www.exporthouse.com.sa')
  })
})
