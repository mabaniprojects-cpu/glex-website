'use client'

import { RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'

/**
 * Route-level error boundary.
 *
 * Next 16 replaced `reset` with `unstable_retry`. `reset()` only clears the
 * error state and re-renders, so it cannot recover from a Server Component
 * failure; `unstable_retry()` re-runs the request.
 */
export default function LocaleError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const t = useTranslations('errors')
  const common = useTranslations('common')

  React.useEffect(() => {
    // Surfaced to the server logs via the digest; the message itself is never
    // shown to the user, as it can contain internal detail.
    console.error('Route error:', error.digest ?? error.message)
  }, [error])

  return (
    <div className="container-glex flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="text-3xl font-bold sm:text-4xl">{t('serverErrorTitle')}</h1>
      <p className="mt-4 max-w-lg text-lg text-glex-green-800/75">{t('serverErrorBody')}</p>

      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-glex-green-800/50" dir="ltr">
          {error.digest}
        </p>
      ) : null}

      <div className="mt-8">
        <Button type="button" variant="primary" size="lg" onClick={() => unstable_retry()}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {common('tryAgain')}
        </Button>
      </div>
    </div>
  )
}
