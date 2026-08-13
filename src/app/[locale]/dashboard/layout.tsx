import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  DashboardShell,
  type DashboardNavItem,
} from '@/components/dashboard/dashboard-shell'
import { routing } from '@/i18n/routing'
import { requireUser } from '@/lib/auth-guards'
import { homeRouteFor, isClientRole } from '@/lib/rbac'

/**
 * Client dashboard chrome.
 *
 * The guard runs here so every nested page inherits it, but each page still
 * calls `requireUser()` itself — a layout is not a security boundary, and
 * Server Actions post to the page's own URL.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireUser()

  // Staff and suppliers each have their own portal.
  if (!isClientRole(user.role)) {
    redirect(`/${locale}${homeRouteFor(user.role)}`)
  }

  const t = await getTranslations('dashboard')

  // Icons are named, not imported components — see DashboardShell for why.
  const items: DashboardNavItem[] = [
    { href: '/dashboard', label: t('nav.overview'), icon: 'overview' },
    { href: '/dashboard/rfqs', label: t('nav.rfqs'), icon: 'rfqs' },
    { href: '/dashboard/shipments', label: t('nav.shipments'), icon: 'shipments' },
    { href: '/dashboard/documents', label: t('nav.documents'), icon: 'documents' },
    { href: '/dashboard/saved', label: t('nav.saved'), icon: 'saved' },
    { href: '/dashboard/team', label: t('nav.team'), icon: 'team' },
    { href: '/dashboard/organization', label: t('nav.organization'), icon: 'organization' },
    { href: '/dashboard/notifications', label: t('nav.notifications'), icon: 'notifications' },
    { href: '/dashboard/support', label: t('nav.support'), icon: 'support' },
    { href: '/dashboard/security', label: t('nav.security'), icon: 'security' },
  ]

  return (
    <DashboardShell items={items} title={t('title')}>
      {children}
    </DashboardShell>
  )
}
