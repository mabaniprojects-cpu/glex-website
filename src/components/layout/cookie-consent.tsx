'use client'

import { Cookie } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { saveCookieConsent } from '@/lib/actions/consent-actions'
import type { ConsentChoice } from '@/lib/consent'
import { cn } from '@/lib/utils'

/**
 * Cookie consent banner.
 *
 * Rendered only when the visitor has not chosen yet — the decision is read on
 * the server, so this never flashes for someone who has already answered.
 *
 * Both buttons are equally prominent: presenting "Accept all" as the only real
 * option is dark-pattern territory, and consent obtained that way is not freely
 * given.
 *
 * A corner card from `sm` up, rather than the full-width bar it used to be. The
 * bar sat across the bottom of the window for the whole of the first visit and
 * covered the page while someone read it, which is a poor first impression on a
 * site whose job is to be read. The wording is untouched — it is the consent
 * notice, and it still names both categories and links to the policy.
 */
export function CookieConsent() {
  const t = useTranslations('cookies')
  const footer = useTranslations('footer')

  const [pending, startTransition] = React.useTransition()
  const [dismissed, setDismissed] = React.useState(false)

  function choose(choice: ConsentChoice) {
    startTransition(async () => {
      const result = await saveCookieConsent({ choice })

      // Hidden only once the decision is actually stored. Dismissing
      // optimistically would tell the visitor they had chosen while nothing
      // was recorded, and the banner would simply return on the next page.
      if (result.ok) setDismissed(true)
    })
  }

  if (dismissed) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className={cn(
        'animate-fade-up fixed z-80 bg-white shadow-2xl',
        'border-border-subtle inset-x-0 bottom-0 border-t p-4',
        // Anchored to the start corner because the assistant button holds the
        // end one; logical properties keep them apart in Arabic too.
        'sm:inset-x-auto sm:start-4 sm:bottom-4 sm:max-w-sm sm:rounded-2xl sm:border sm:p-5'
      )}
    >
      <div className="flex gap-3">
        <Cookie className="text-glex-green-600 mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 id="cookie-consent-title" className="text-glex-green-900 font-semibold">
            {t('title')}
          </h2>
          <p className="text-glex-green-800/80 mt-1 text-sm leading-relaxed">
            {t('body')}{' '}
            <Link href="/cookies" className="font-medium underline underline-offset-2">
              {footer('cookies')}
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => choose('essential')}
        >
          {t('essentialOnly')}
        </Button>
        <Button type="button" variant="primary" disabled={pending} onClick={() => choose('all')}>
          {t('acceptAll')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Lets someone revisit their choice from the cookie policy page.
 *
 * A consent mechanism that cannot be withdrawn as easily as it was given is not
 * a consent mechanism.
 */
export function CookiePreferences({ current }: { current: ConsentChoice | null }) {
  const t = useTranslations('cookies')

  const [choice, setChoice] = React.useState(current)
  const [saved, setSaved] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function choose(next: ConsentChoice) {
    setChoice(next)
    setSaved(false)
    startTransition(async () => {
      const result = await saveCookieConsent({ choice: next })
      if (result.ok) setSaved(true)
    })
  }

  return (
    <div className="rounded-xl border border-border-subtle p-6">
      <h2 className="text-lg font-semibold">{t('preferences')}</h2>

      <p className="mt-2 text-sm text-glex-green-800/80">
        {choice === 'all'
          ? t('currentAll')
          : choice === 'essential'
            ? t('currentEssential')
            : t('currentNone')}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={choice === 'essential' ? 'primary' : 'outline'}
          disabled={pending}
          onClick={() => choose('essential')}
        >
          {t('essentialOnly')}
        </Button>
        <Button
          type="button"
          variant={choice === 'all' ? 'primary' : 'outline'}
          disabled={pending}
          onClick={() => choose('all')}
        >
          {t('acceptAll')}
        </Button>
      </div>

      {saved ? (
        <p role="status" className="mt-4 text-sm font-medium text-glex-green-700">
          {t('saved')}
        </p>
      ) : null}
    </div>
  )
}
