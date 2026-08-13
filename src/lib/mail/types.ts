import type { Locale } from '@prisma/client'

/**
 * Email provider contract.
 *
 * Concrete transports (console, SMTP, Resend) implement this, so calling code
 * never knows or cares which one is configured.
 */

export type MailAddress = string | { name?: string; email: string }

export type MailMessage = {
  to: MailAddress | MailAddress[]
  subject: string
  html: string
  /** Plain-text fallback. Always supplied — never send HTML-only mail. */
  text: string
  replyTo?: string
}

export type MailResult = { ok: true; id?: string } | { ok: false; error: string }

export interface MailProvider {
  readonly name: string
  send(message: MailMessage): Promise<MailResult>
}

/** Keys matching the seeded `EmailTemplate` rows. */
export const TEMPLATE_KEYS = [
  'welcome',
  'email-verification',
  'password-reset',
  'supplier-submitted',
  'supplier-clarification',
  'supplier-approved',
  'supplier-rejected',
  'client-registered',
  'rfq-submitted',
  'rfq-clarification',
  'quotation-available',
  'rfq-accepted',
  'shipment-created',
  'shipment-departed',
  'shipment-delayed',
  'shipment-exception',
  'shipment-delivered',
  'contact-received',
  'support-response',
  'team-invitation',
] as const

export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export type TemplateContext = {
  locale: Locale
  recipientName?: string
  /** Rendered as the primary call-to-action button. */
  actionUrl?: string
  actionLabel?: string
  /** Extra lines appended under the body, e.g. a reference number. */
  details?: Array<{ label: string; value: string }>
}

export function addressToString(address: MailAddress): string {
  if (typeof address === 'string') return address
  return address.name ? `${address.name} <${address.email}>` : address.email
}
