/**
 * Mabani's PMO, who study the large orders.
 *
 * They are a separate company in the group, so this is the one place in the
 * application that addresses people outside GLEX. The addresses are role
 * mailboxes for that team rather than personal ones, and they can be replaced
 * per deployment with MABANI_TECHNICAL_EMAILS (comma-separated) without a code
 * change — people move on, and a referral that quietly reaches nobody is worse
 * than one that fails loudly.
 */

const FALLBACK_RECIPIENTS = [
  { name: 'Abubaker Rabie', role: 'Technical Team Manager', email: 'a.rabie@mabani.com.sa' },
  { name: 'Elhadi Elnegumi', role: 'PMO Director', email: 'pmo@mabani.com.sa' },
] as const

export type TechnicalRecipient = { name: string; role: string; email: string }

export function technicalOfficeRecipients(): TechnicalRecipient[] {
  const configured = process.env.MABANI_TECHNICAL_EMAILS?.trim()

  if (configured) {
    const emails = configured
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.includes('@'))

    if (emails.length > 0) {
      // A configured address is just an address: keep the name blank rather
      // than pairing someone else's name with it.
      return emails.map((email) => ({ name: '', role: '', email }))
    }
  }

  return FALLBACK_RECIPIENTS.map((person) => ({ ...person }))
}

/** For the review step: who this is about to go to, as one readable line. */
export function technicalOfficeLabel(): string {
  return technicalOfficeRecipients()
    .map((person) => (person.name ? `${person.name} <${person.email}>` : person.email))
    .join(', ')
}
