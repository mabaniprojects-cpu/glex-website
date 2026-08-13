'use client'

import { Cookie } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { saveCookieConsent } from '@/lib/actions/consent-actions'
import type { ConsentChoice } from '@/lib/consent'

/**
 * Cookie consent banner.
 *
 * Rendered only when the visitor has not chosen yet — the decision is read on
 * the server, so this never flashes for someone who has already answered.
 *
 * Both buttons are equally prominent: presenting "Accept all" as the only real
 * option is dark-pattern territory, and consent obtained that way is not freely
 * given.
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
      className="fixed inset-x-0 bottom-0 z-80 border-t border-border-subtle bg-white p-4 shadow-2xl sm:p-6"
    >
      <div className="container-glex flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <Cookie className="mt-0.5 size-5 shrink-0 text-glex-green-600" aria-hidden="true" />
          <div>
            <h2 id="cookie-consent-title" className="font-semibold text-glex-green-900">
              {t('title')}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-glex-green-800/80">
              {t('body')}{' '}
              <Link href="/cookies" className="font-medium underline underline-offset-2">
                {footer('cookies')}
              </Link>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => choose('essential')}
          >
            {t('essentialOnly')}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={pending}
            onClick={() => choose('all')}
          >
            {t('acceptAll')}
          </Button>
        </div>
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
