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
import { isStaff, isSupplierRole } from '@/lib/rbac'

/**
 * Supplier portal chrome.
 *
 * Every nested page repeats its own guard — a layout is not a security
 * boundary, and Server Actions POST to the page's own URL.
 */
export default async function SupplierLayout({
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

  if (!isSupplierRole(user.role)) {
    redirect(isStaff(user.role) ? `/${locale}/admin` : `/${locale}/dashboard`)
  }

  const t = await getTranslations('dashboard')
  const supplier = await getTranslations('supplier')

  // Icons are named, not imported components — see DashboardShell for why.
  const items: DashboardNavItem[] = [
    { href: '/supplier', label: t('nav.overview'), icon: 'overview' },
    { href: '/supplier/opportunities', label: supplier('opportunities'), icon: 'rfqs' },
    { href: '/supplier/products', label: t('nav.saved'), icon: 'saved' },
    { href: '/supplier/security', label: t('nav.security'), icon: 'security' },
  ]

  return (
    <DashboardShell items={items} title={supplier('registerTitle')}>
      {children}
    </DashboardShell>
  )
}
