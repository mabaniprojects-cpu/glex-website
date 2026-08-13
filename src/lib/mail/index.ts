import { env } from '@/lib/env'
import { renderTemplate } from './templates'
import { addressToString, type MailMessage, type MailProvider, type MailResult, type TemplateContext, type TemplateKey } from './types'

/**
 * Email transport selection.
 *
 * `console` is the development default: it prints the message and sends
 * nothing, so the whole application is usable with no mail credentials.
 * `src/lib/env.ts` rejects `console` in production.
 */

const consoleProvider: MailProvider = {
  name: 'console',
  async send(message) {
    const to = (Array.isArray(message.to) ? message.to : [message.to])
      .map(addressToString)
      .join(', ')

    console.info(
      [
        '',
        '─── EMAIL (console transport — not sent) ───',
        `To:      ${to}`,
        `Subject: ${message.subject}`,
        '',
        message.text,
        '────────────────────────────────────────────',
        '',
      ].join('\n')
    )

    return { ok: true }
  },
}

const smtpProvider: MailProvider = {
  name: 'smtp',
  async send(message) {
    const config = env()
    try {
      // Imported lazily so nodemailer is never pulled into a build that does
      // not use SMTP.
      const nodemailer = (await import('nodemailer')).default

      const transport = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT ?? 587,
        secure: (config.SMTP_PORT ?? 587) === 465,
        auth: config.SMTP_USER
          ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
          : undefined,
      })

      const info = await transport.sendMail({
        from: config.SMTP_FROM,
        to: (Array.isArray(message.to) ? message.to : [message.to]).map(addressToString),
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      })

      return { ok: true, id: info.messageId }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'SMTP send failed' }
    }
  },
}

const resendProvider: MailProvider = {
  name: 'resend',
  async send(message) {
    const config = env()
    try {
      const { Resend } = await import('resend')
      const client = new Resend(config.RESEND_API_KEY)

      const result = await client.emails.send({
        from: config.SMTP_FROM,
        to: (Array.isArray(message.to) ? message.to : [message.to]).map(addressToString),
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      })

      if (result.error) return { ok: false, error: result.error.message }
      return { ok: true, id: result.data?.id }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Resend send failed' }
    }
  },
}

export function getMailProvider(): MailProvider {
  switch (env().EMAIL_PROVIDER) {
    case 'smtp':
      return smtpProvider
    case 'resend':
      return resendProvider
    default:
      return consoleProvider
  }
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const provider = getMailProvider()
  const result = await provider.send(message)

  if (!result.ok) {
    // Never leak recipient addresses or message bodies into logs.
    console.error(`[mail] ${provider.name} send failed: ${result.error}`)
  }

  return result
}

/**
 * Renders a branded template and sends it.
 *
 * Delivery failure is reported, never thrown: the caller has already committed
 * its database work, and a mail outage must not roll back a registration or
 * lose a submitted RFQ.
 */
export async function sendTemplate(
  key: TemplateKey,
  to: MailMessage['to'],
  context: TemplateContext
): Promise<MailResult> {
  try {
    const { subject, html, text } = await renderTemplate(key, context)
    return await sendMail({ to, subject, html, text })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'template render failed'
    console.error(`[mail] Failed to render "${key}": ${reason}`)
    return { ok: false, error: reason }
  }
}

/** Internal notification address, from CONTACT_TO_EMAIL. */
export function internalRecipient(): string | null {
  return env().CONTACT_TO_EMAIL ?? null
}

export type { MailMessage, MailProvider, MailResult } from './types'
