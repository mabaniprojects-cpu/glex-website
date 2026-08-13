'use client'

import { Check, Copy, MapPin, Navigation, Phone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { GLEX_COMPANY } from '@/lib/company'
import { officeAddressOneLine, officeMapsUrl, type OfficeView } from '@/lib/office-view'

/**
 * Office block: click-to-call, copy address, and directions.
 *
 * The office is passed in rather than read from a constant, so an address
 * corrected in the admin portal reaches this card. Company identity below the
 * divider — the commercial registration — still comes from `GLEX_COMPANY`,
 * because that is legally fixed and not content.
 */
export function OfficeCard({ office }: { office: OfficeView }) {
  // The office's own number when it has one, falling back to the head-office
  // line. `tel:` needs the digits only, so it is derived rather than stored twice.
  const phoneDisplay = office.phone ?? GLEX_COMPANY.phoneDisplay
  const phoneHref = office.phone
    ? office.phone.replace(/[^+\d]/g, '')
    : GLEX_COMPANY.phoneE164

  // The heading is the office's own name, not a translated "Our Office" label —
  // with more than one location, a generic heading stops identifying anything.
  const t = useTranslations('home.contact')

  const [copied, setCopied] = React.useState(false)

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(officeAddressOneLine(office))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard access can be denied; leaving the button state unchanged is
      // the correct silent outcome — the address is visible on screen anyway.
    }
  }

  return (
    <div className="rounded-2xl bg-glex-green-900 p-8 text-white">
      <h2 className="text-2xl font-bold text-white">{office.name}</h2>

      <address className="mt-6 space-y-4 not-italic">
        <div className="flex gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-glex-gold-400" aria-hidden="true" />
          <span className="text-glex-ivory/90">
            {office.addressLines.map((line) => (
              <span key={line} className="block leading-relaxed">
                {line}
              </span>
            ))}
          </span>
        </div>

        <div className="flex gap-3">
          <Phone className="mt-0.5 size-5 shrink-0 text-glex-gold-400 rtl-flip" aria-hidden="true" />
          <a
            href={`tel:${phoneHref}`}
            dir="ltr"
            className="text-glex-ivory/90 underline-offset-4 hover:underline"
          >
            {phoneDisplay}
          </a>
        </div>
      </address>

      <div className="mt-7 flex flex-wrap gap-3">
        <Button asChild variant="gold" size="sm">
          <a href={`tel:${phoneHref}`}>
            <Phone className="size-4 rtl-flip" aria-hidden="true" />
            {t('callUs')}
          </a>
        </Button>

        <Button
          type="button"
          variant="inverse"
          size="sm"
          onClick={copyAddress}
          // Announce the outcome without moving focus.
          aria-live="polite"
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? t('addressCopied') : t('copyAddress')}
        </Button>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-white/40 text-white hover:bg-white/10"
        >
          <a href={officeMapsUrl(office)} target="_blank" rel="noopener noreferrer">
            <Navigation className="size-4 rtl-flip" aria-hidden="true" />
            {t('directions')}
          </a>
        </Button>
      </div>

      <dl className="mt-8 grid gap-4 border-t border-white/10 pt-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-glex-ivory/60">Commercial Registration</dt>
          <dd className="mt-0.5 font-semibold text-white" dir="ltr">
            {GLEX_COMPANY.crNumber}
          </dd>
        </div>
        <div>
          <dt className="text-glex-ivory/60">{t('businessHours')}</dt>
          <dd className="mt-0.5 font-semibold text-white">Sunday – Thursday, 09:00 – 18:00</dd>
        </div>
      </dl>
    </div>
  )
}
