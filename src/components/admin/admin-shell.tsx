'use client'

import {
  ClipboardList,
  Factory,
  FolderTree,
  Package,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Megaphone,
  Newspaper,
  Route,
  ScrollText,
  Settings,
  Building2,
  Mail,
  MapPin,
  MessageSquare,
  Ship,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * Icons are referenced by NAME, not by component.
 *
 * Props crossing the Server→Client boundary must be serializable, and a Lucide
 * icon is a function. Passing one directly throws "Functions cannot be passed
 * directly to Client Components", so the map lives here on the client.
 */
const ICONS = {
  overview: LayoutDashboard,
  products: Package,
  categories: FolderTree,
  news: Newspaper,
  faq: Megaphone,
  routes: Route,
  settings: Settings,
  rfqs: ClipboardList,
  suppliers: Factory,
  shipments: Ship,
  inquiries: Inbox,
  users: Users,
  organizations: Building2,
  offices: MapPin,
  emails: Mail,
  chats: MessageSquare,
  tickets: LifeBuoy,
  audit: ScrollText,
} satisfies Record<string, LucideIcon>

export type AdminIconName = keyof typeof ICONS

export type AdminNavItem = {
  href: string
  label: string
  icon: AdminIconName
}

/** Admin chrome: sidebar on desktop, focus-trapped drawer on small screens. */
export function AdminShell({
  items,
  title,
  children,
}: {
  items: AdminNavItem[]
  title: string
  children: React.ReactNode
}) {
  const common = useTranslations('common')
  const pathname = usePathname()

  const [open, setOpen] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  const [lastPathname, setLastPathname] = React.useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setOpen(false)
  }

  React.useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    const trigger = triggerRef.current

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      )
      if (!focusables?.length) return

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
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

  const isActive = (href: string) =>
    pathname === href || (href !== '/admin' && pathname.startsWith(href))

  const nav = (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isActive(item.href)
        const Icon = ICONS[item.icon]
        return (
          <li key={item.href}>
            <Link
              href={item.href as Parameters<typeof Link>[0]['href']}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-glex-green-900 text-white'
                  : 'text-glex-green-800 hover:bg-glex-green-50'
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="container-glex py-8 lg:py-12">
      <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10">
        <aside className="hidden lg:block" aria-label={title}>
          <nav className="sticky top-24">{nav}</nav>
        </aside>

        <div>
          <div className="mb-6 lg:hidden">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-subtle px-4 text-sm font-medium text-glex-green-800"
            >
              <Menu className="size-4" aria-hidden="true" />
              {title}
            </button>
          </div>

          {children}
        </div>
      </div>

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
            aria-label={title}
            tabIndex={-1}
            className="absolute inset-y-0 start-0 w-[min(18rem,85vw)] overflow-y-auto bg-white p-5 shadow-2xl outline-none"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={common('closeMenu')}
                className="inline-flex size-11 items-center justify-center rounded-lg text-glex-green-800 hover:bg-glex-green-50"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <nav>{nav}</nav>
          </div>
        </div>
      ) : null}
    </div>
  )
}
