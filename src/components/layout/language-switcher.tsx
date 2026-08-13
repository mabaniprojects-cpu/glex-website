'use client'

import { Check, Globe } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import * as React from 'react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { localeLabels, locales, type AppLocale } from '@/i18n/routing'
import { cn } from '@/lib/utils'

/**
 * Accessible language selector.
 *
 * Implemented as a native disclosure + listbox rather than a custom widget so
 * that screen readers and keyboard users get correct semantics for free. The
 * choice is persisted by next-intl's locale cookie.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations('common')
  const activeLocale = useLocale() as AppLocale
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()

  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Close on outside click and on Escape.
  React.useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function select(next: AppLocale) {
    setOpen(false)
    if (next === activeLocale) return
    startTransition(() => {
      // Preserve the current route and its dynamic params across the switch.
      router.replace(
        // @ts-expect-error -- pathname is a validated route; params supplies its segments.
        { pathname, params },
        { locale: next }
      )
    })
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('selectLanguage')}
        disabled={pending}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium',
          'text-glex-green-800 transition-colors hover:bg-glex-green-50',
          'disabled:opacity-60'
        )}
      >
        <Globe className="size-4" aria-hidden="true" />
        <span>{localeLabels[activeLocale]}</span>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t('selectLanguage')}
          className={cn(
            'absolute end-0 top-full z-50 mt-1 min-w-48 overflow-hidden rounded-lg',
            'border border-border-subtle bg-white py-1 shadow-lg'
          )}
        >
          {locales.map((locale) => {
            const selected = locale === activeLocale
            return (
              <li key={locale} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => select(locale)}
                  lang={locale}
                  dir={locale === 'ar' ? 'rtl' : 'ltr'}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-sm',
                    'transition-colors hover:bg-glex-green-50',
                    selected ? 'font-semibold text-glex-green-700' : 'text-glex-green-900'
                  )}
                >
                  <span>{localeLabels[locale]}</span>
                  {selected ? <Check className="size-4" aria-hidden="true" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
