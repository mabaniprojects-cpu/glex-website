'use client'

import { LogIn, Menu, Ship, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from './language-switcher'

const NAV_KEYS = [
  ['/about', 'about'],
  ['/services', 'services'],
  ['/network', 'network'],
  ['/marketplace', 'marketplace'],
  ['/news', 'news'],
  ['/resources', 'resources'],
  ['/faq', 'faq'],
  ['/contact', 'contact'],
] as const

/**
 * Mobile/tablet navigation drawer.
 *
 * Opens from the inline-end edge so it reads naturally in both LTR and RTL.
 * Focus is trapped while open and returned to the trigger on close.
 */
export function MobileNav({
  signedIn,
  dashboardHref,
}: {
  signedIn: boolean
  dashboardHref: string | null
}) {
  const t = useTranslations('nav')
  const common = useTranslations('common')
  const pathname = usePathname()

  const [open, setOpen] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  // Close whenever the route changes. Adjusting state during render (rather
  // than in an effect) avoids the cascading re-render an effect would cause.
  const [lastPathname, setLastPathname] = React.useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setOpen(false)
  }

  // Lock scroll, trap focus, and restore focus on close.
  React.useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    // Capture the trigger now — by cleanup time the ref may point elsewhere.
    const trigger = triggerRef.current

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables?.length) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={common('openMenu')}
        aria-expanded={open}
        className="inline-flex size-11 items-center justify-center rounded-lg text-glex-green-800 transition-colors hover:bg-glex-green-50 lg:hidden"
      >
        <Menu className="size-6" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-100 lg:hidden">
          <div
            className="absolute inset-0 bg-glex-green-950/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('mainNavigation')}
            tabIndex={-1}
            className={cn(
              'absolute inset-y-0 end-0 flex w-[min(22rem,88vw)] flex-col',
              'bg-white shadow-2xl outline-none'
            )}
          >
            <div className="flex h-18 shrink-0 items-center justify-between border-b border-border-subtle px-4">
              <LanguageSwitcher />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={common('closeMenu')}
                className="inline-flex size-11 items-center justify-center rounded-lg text-glex-green-800 transition-colors hover:bg-glex-green-50"
              >
                <X className="size-6" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="flex flex-col gap-1">
                {NAV_KEYS.map(([href, key]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="block rounded-lg px-4 py-3 text-base font-medium text-glex-green-900 transition-colors hover:bg-glex-green-50"
                    >
                      {t(key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="shrink-0 space-y-2 border-t border-border-subtle p-4">
              <Button asChild variant="outline" size="md" className="w-full">
                <Link href="/tracking">
                  <Ship className="size-4 rtl-flip" aria-hidden="true" />
                  {t('tracking')}
                </Link>
              </Button>

              {signedIn && dashboardHref ? (
                <Button asChild variant="subtle" size="md" className="w-full">
                  <Link href={dashboardHref as Parameters<typeof Link>[0]['href']}>
                    {t('dashboard')}
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="subtle" size="md" className="w-full">
                  <Link href="/login">
                    <LogIn className="size-4 rtl-flip" aria-hidden="true" />
                    {t('login')}
                  </Link>
                </Button>
              )}

              <Button asChild variant="gold" size="md" className="w-full">
                <Link href="/rfq">{t('rfq')}</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
