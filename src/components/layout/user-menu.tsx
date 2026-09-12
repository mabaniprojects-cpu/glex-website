'use client'

import { LayoutDashboard, LogOut, UserCircle } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * Signed-in account menu: who you are, your dashboard, and the way out.
 *
 * It REPLACES the bare "Dashboard" button rather than sitting beside it. The
 * header row has about 16px of slack in French at 1280px — the tightest of the
 * five locales — so anything added alongside would push the page into
 * horizontal scroll again. The trigger costs roughly 44px against the 130px
 * the text button used, so this adds the missing function and takes pressure
 * off the row at the same time.
 *
 * Before this, signing out was possible only from /dashboard/security or
 * /supplier/security. An admin's route home is /admin, whose sidebar has
 * eighteen entries and none of them ended a session.
 *
 * Built as a disclosure + menu with outside-click and Escape handling, the
 * same shape as LanguageSwitcher, so keyboard and screen-reader behaviour
 * matches the control next to it.
 */
export function UserMenu({
  name,
  email,
  dashboardHref,
  redirectTo,
  className,
}: {
  name: string
  email: string
  dashboardHref: string
  /** Where to land after signing out — the locale's home page. */
  redirectTo: string
  className?: string
}) {
  const nav = useTranslations('nav')
  const common = useTranslations('common')

  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

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

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        // The visible name is hidden at xl, so the accessible name has to carry
        // it — otherwise the control is announced as an unlabelled button.
        aria-label={name}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium',
          'text-glex-green-800 hover:bg-glex-green-50 transition-colors'
        )}
      >
        <UserCircle className="size-5 shrink-0" aria-hidden="true" />
        {/* Hidden in the xl band, where the seven nav links leave no room. */}
        <span className="max-w-28 truncate xl:hidden">{name}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={name}
          className={cn(
            'border-border-subtle absolute end-0 top-full z-50 mt-1 min-w-60 overflow-hidden',
            'rounded-lg border bg-white py-1 shadow-lg'
          )}
        >
          <div className="border-border-subtle border-b px-4 py-3">
            <p className="text-glex-green-900 truncate text-sm font-semibold">{name}</p>
            <p className="text-glex-green-800/70 truncate text-xs" dir="ltr">
              {email}
            </p>
          </div>

          <Link
            role="menuitem"
            href={dashboardHref as Parameters<typeof Link>[0]['href']}
            onClick={() => setOpen(false)}
            className="text-glex-green-900 hover:bg-glex-green-50 flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
          >
            <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
            {nav('dashboard')}
          </Link>

          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => {
              setPending(true)
              void signOut({ redirectTo })
            }}
            className="text-glex-green-900 hover:bg-glex-green-50 flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm transition-colors disabled:opacity-60"
          >
            <LogOut className="rtl-flip size-4 shrink-0" aria-hidden="true" />
            {pending ? common('loading') : nav('logout')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
