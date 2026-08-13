import { Locale } from '@prisma/client'
import { db } from '@/lib/db'
import { GLEX_COMPANY } from '@/lib/company'
import type { TemplateContext, TemplateKey } from './types'

/**
 * GLEX-branded email rendering.
 *
 * Copy is loaded from the `EmailTemplate` table (admin-editable, per locale)
 * with a hard-coded English fallback so mail still sends if the table is empty
 * or the database is briefly unreachable.
 */

type TemplateCopy = { subject: string; heading: string; body: string }

/** Fallbacks mirroring the seeded rows. */
const FALLBACKS: Record<TemplateKey, TemplateCopy> = {
  welcome: { subject: 'Welcome to GLEX', heading: 'Welcome to GLEX', body: 'Your account has been created. You can now build RFQs, follow shipments and manage your documents.' },
  'email-verification': { subject: 'Verify your email address', heading: 'Confirm your email', body: 'Please confirm your email address to activate your GLEX account.' },
  'password-reset': { subject: 'Reset your GLEX password', heading: 'Password reset', body: 'A password reset was requested for your account. If this was not you, no action is needed and your password stays unchanged.' },
  'supplier-submitted': { subject: 'Supplier application received', heading: 'Application received', body: 'Thank you for registering. Our team will review your application and respond by email.' },
  'supplier-clarification': { subject: 'Additional information required', heading: 'Clarification required', body: 'We need some additional information before we can complete our review.' },
  'supplier-approved': { subject: 'Your GLEX supplier application is approved', heading: 'Application approved', body: 'Your company has been approved. You can now manage your catalogue and receive sourcing opportunities.' },
  'supplier-rejected': { subject: 'Update on your GLEX supplier application', heading: 'Application update', body: 'Thank you for your interest. On this occasion we are unable to proceed with your application.' },
  'client-registered': { subject: 'Your GLEX account is ready', heading: 'Account created', body: 'Your client account is active. Explore the marketplace and submit your first request for quotation.' },
  'rfq-submitted': { subject: 'We have received your request for quotation', heading: 'RFQ received', body: 'Thank you. Your request has been logged and our team will respond shortly.' },
  'rfq-clarification': { subject: 'Clarification required on your RFQ', heading: 'Clarification required', body: 'We need a little more detail before we can prepare your quotation.' },
  'quotation-available': { subject: 'Your quotation is ready', heading: 'Quotation available', body: 'Your commercial offer is ready to review in your dashboard.' },
  'rfq-accepted': { subject: 'Quotation accepted', heading: 'Thank you', body: 'We have recorded your acceptance and will proceed with sourcing and logistics.' },
  'shipment-created': { subject: 'Your shipment has been booked', heading: 'Shipment created', body: 'A shipment has been created for your order. You can follow its progress at any time.' },
  'shipment-departed': { subject: 'Your shipment has departed', heading: 'Shipment departed', body: 'Your shipment has departed the origin port.' },
  'shipment-delayed': { subject: 'Update: your shipment is delayed', heading: 'Shipment delayed', body: 'We are tracking a delay on your shipment and will update you as soon as we have more information.' },
  'shipment-exception': { subject: 'Action may be required on your shipment', heading: 'Shipment exception', body: 'An exception has been recorded against your shipment. Our team is reviewing it.' },
  'shipment-delivered': { subject: 'Your shipment has been delivered', heading: 'Shipment delivered', body: 'Your shipment has been delivered. Thank you for working with GLEX.' },
  'contact-received': { subject: 'We have received your message', heading: 'Message received', body: 'Thank you for contacting GLEX. Our team will respond as soon as possible.' },
  'support-response': { subject: 'Update on your support request', heading: 'Support update', body: 'There is a new response on your support request.' },
  'team-invitation': { subject: 'You have been invited to a GLEX team', heading: 'Team invitation', body: 'You have been invited to join an organization on GLEX.' },
}

async function loadCopy(key: TemplateKey, locale: Locale): Promise<TemplateCopy> {
  // Two explicit steps: the requested locale, then English. The previous
  // version fetched the exact-locale row with `findUnique` and no `isActive`
  // filter, so DEACTIVATING a translated template made it start being used
  // instead of skipped — the toggle did the opposite of what it said.
  const exact = await db.emailTemplate
    .findFirst({ where: { key, locale, isActive: true } })
    .catch(() => null)

  const chosen =
    exact ??
    (locale === Locale.en
      ? null
      : await db.emailTemplate
          .findFirst({ where: { key, locale: Locale.en, isActive: true } })
          .catch(() => null))

  // No active row in either locale: the hard-coded English copy still sends.
  if (!chosen) return FALLBACKS[key]

  return {
    subject: chosen.subject,
    heading: chosen.heading ?? FALLBACKS[key].heading,
    body: chosen.body,
  }
}

/** Escapes text destined for an HTML email body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const RTL_LOCALES = new Set<Locale>([Locale.ar])

/**
 * Table-based layout with inline styles — the only reliable approach across
 * desktop and mobile mail clients, which strip <style> blocks and ignore flexbox.
 */
function renderHtml(copy: TemplateCopy, context: TemplateContext): string {
  const dir = RTL_LOCALES.has(context.locale) ? 'rtl' : 'ltr'
  const align = dir === 'rtl' ? 'right' : 'left'

  const greeting = context.recipientName
    ? `<p style="margin:0 0 16px;font-size:16px;color:#0F2B22;">${escapeHtml(context.recipientName)},</p>`
    : ''

  const action =
    context.actionUrl && context.actionLabel
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
           <tr><td style="border-radius:8px;background:#DFBE52;">
             <a href="${escapeHtml(context.actionUrl)}"
                style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;
                       color:#0F2B22;text-decoration:none;border-radius:8px;">
               ${escapeHtml(context.actionLabel)}
             </a>
           </td></tr>
         </table>
         <p style="margin:0 0 8px;font-size:13px;color:rgba(15,43,34,0.6);">
           If the button does not work, copy this link into your browser:
         </p>
         <p style="margin:0 0 24px;font-size:13px;word-break:break-all;">
           <a href="${escapeHtml(context.actionUrl)}" style="color:#017A4D;">${escapeHtml(context.actionUrl)}</a>
         </p>`
      : ''

  const details = context.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
              style="margin:8px 0 24px;border-top:1px solid #E2E6D8;">
         ${context.details
           .map(
             (d) => `<tr>
               <td style="padding:10px 0;font-size:14px;color:rgba(15,43,34,0.65);">${escapeHtml(d.label)}</td>
               <td style="padding:10px 0;font-size:14px;font-weight:600;color:#0F2B22;text-align:${dir === 'rtl' ? 'left' : 'right'};">${escapeHtml(d.value)}</td>
             </tr>`
           )
           .join('')}
       </table>`
    : ''

  return `<!doctype html>
<html lang="${context.locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F3F5E9;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F3F5E9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
             style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">

        <tr><td style="background:#017A4D;padding:24px 32px;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">GLEX</span>
          <span style="display:block;margin-top:4px;font-size:12px;color:#DFBE52;letter-spacing:1.5px;text-transform:uppercase;">
            ${escapeHtml(GLEX_COMPANY.tagline)}
          </span>
        </td></tr>

        <tr><td style="padding:32px;text-align:${align};" dir="${dir}">
          <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#0F2B22;">${escapeHtml(copy.heading)}</h1>
          ${greeting}
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:rgba(15,43,34,0.85);">${escapeHtml(copy.body)}</p>
          ${action}
          ${details}
        </td></tr>

        <tr><td style="padding:24px 32px;background:#F3F5E9;text-align:${align};" dir="${dir}">
          <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:rgba(15,43,34,0.6);">
            ${escapeHtml(GLEX_COMPANY.legalName)} &middot; ${escapeHtml(GLEX_COMPANY.office.city)}, ${escapeHtml(GLEX_COMPANY.office.country)}
          </p>
          <p style="margin:0;font-size:12px;color:rgba(15,43,34,0.6);" dir="ltr">
            ${escapeHtml(GLEX_COMPANY.phoneDisplay)} &middot; CR ${escapeHtml(GLEX_COMPANY.crNumber)}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function renderText(copy: TemplateCopy, context: TemplateContext): string {
  const lines = [copy.heading, '']
  if (context.recipientName) lines.push(`${context.recipientName},`, '')
  lines.push(copy.body, '')

  if (context.actionUrl) {
    if (context.actionLabel) lines.push(`${context.actionLabel}:`)
    lines.push(context.actionUrl, '')
  }
  for (const detail of context.details ?? []) lines.push(`${detail.label}: ${detail.value}`)

  lines.push(
    '',
    '—',
    GLEX_COMPANY.legalName,
    `${GLEX_COMPANY.office.city}, ${GLEX_COMPANY.office.country}`,
    GLEX_COMPANY.phoneDisplay,
    `Commercial Registration ${GLEX_COMPANY.crNumber}`
  )

  return lines.join('\n')
}

export async function renderTemplate(key: TemplateKey, context: TemplateContext) {
  const copy = await loadCopy(key, context.locale)
  return {
    subject: copy.subject,
    html: renderHtml(copy, context),
    text: renderText(copy, context),
  }
}
