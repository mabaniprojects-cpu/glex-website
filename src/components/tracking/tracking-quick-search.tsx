'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Shipment lookup. Navigates to the tracking page with the reference as a
 * query parameter; all validation and lookup happen server-side there.
 */
export function TrackingQuickSearch({
  variant = 'default',
  autoFocus = false,
}: {
  variant?: 'hero' | 'default'
  autoFocus?: boolean
}) {
  const t = useTranslations('tracking')
  const router = useRouter()
  const [value, setValue] = React.useState('')
  const [pending, startTransition] = React.useTransition()
  const inputId = React.useId()

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const reference = value.trim()
    if (!reference) return
    startTransition(() => {
      router.push({ pathname: '/tracking', query: { ref: reference } })
    })
  }

  const onHero = variant === 'hero'

  return (
    <form onSubmit={onSubmit} className="w-full">
      <label
        htmlFor={inputId}
        className={cn(
          'mb-2 block text-sm font-medium',
          onHero ? 'text-glex-ivory/90' : 'text-glex-green-900'
        )}
      >
        {t('searchLabel')}
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          name="ref"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('searchPlaceholder')}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          className={cn(
            'h-12 w-full rounded-lg border px-4 text-sm transition-colors',
            onHero
              ? 'border-white/25 bg-white/10 text-white placeholder:text-white/50 focus:border-glex-gold-400'
              : 'border-border-subtle bg-white text-glex-green-900 placeholder:text-glex-green-900/40 focus:border-glex-green-600'
          )}
        />
        <Button
          type="submit"
          variant="gold"
          size="lg"
          disabled={pending || !value.trim()}
          className="shrink-0"
        >
          <Search className="size-4" aria-hidden="true" />
          {t('searchAction')}
        </Button>
      </div>
    </form>
  )
}
