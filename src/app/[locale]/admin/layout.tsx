import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AdminShell, type AdminNavItem } from '@/components/admin/admin-shell'
import { routing } from '@/i18n/routing'
import { requireStaff } from '@/lib/auth-guards'
import { can } from '@/lib/rbac'

/**
 * Admin portal chrome.
 *
 * `requireStaff()` runs here, but every page and every server action repeats
 * its own guard — a layout is not a security boundary, and Server Actions POST
 * to the page's own URL.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const user = await requireStaff()
  const t = await getTranslations('admin')

  // The sidebar only offers what this role may actually open. The pages
  // enforce the same permissions again server-side.
  const items: AdminNavItem[] = [
    { href: '/admin', label: t('nav.overview'), icon: 'overview' },
  ]

  if (can(user.role, 'product:write')) {
    items.push({ href: '/admin/products', label: t('nav.products'), icon: 'products' })
  }
  if (can(user.role, 'category:write')) {
    items.push({ href: '/admin/categories', label: t('nav.categories'), icon: 'categories' })
  }
  if (can(user.role, 'news:write')) {
    items.push({ href: '/admin/news', label: t('nav.news'), icon: 'news' })
    items.push({
      href: '/admin/news/categories',
      label: t('nav.newsCategories'),
      icon: 'categories',
    })
  }
  if (can(user.role, 'rfq:read:all')) {
    items.push({ href: '/admin/rfqs', label: t('nav.rfqs'), icon: 'rfqs' })
  }
  if (can(user.role, 'supplier:read:all')) {
    items.push({ href: '/admin/suppliers', label: t('nav.suppliers'), icon: 'suppliers' })
  }
  if (can(user.role, 'shipment:read:all')) {
    items.push({ href: '/admin/shipments', label: t('nav.shipments'), icon: 'shipments' })
  }
  if (can(user.role, 'inquiry:read')) {
    items.push({ href: '/admin/inquiries', label: t('nav.inquiries'), icon: 'inquiries' })
  }
  if (can(user.role, 'ticket:manage')) {
    items.push({ href: '/admin/tickets', label: t('nav.tickets'), icon: 'tickets' })
    items.push({ href: '/admin/chats', label: t('nav.chats'), icon: 'chats' })
  }
  if (can(user.role, 'knowledge:write')) {
    items.push({ href: '/admin/faq', label: t('nav.faq'), icon: 'faq' })
  }
  if (can(user.role, 'settings:write')) {
    items.push({ href: '/admin/offices', label: t('nav.offices'), icon: 'offices' })
    items.push({ href: '/admin/routes', label: t('nav.routes'), icon: 'routes' })
    items.push({ href: '/admin/emails', label: t('nav.emails'), icon: 'emails' })
    items.push({ href: '/admin/settings', label: t('nav.settings'), icon: 'settings' })
  }
  if (can(user.role, 'user:read')) {
    items.push({ href: '/admin/users', label: t('nav.users'), icon: 'users' })
  }
  if (can(user.role, 'organization:read')) {
    items.push({
      href: '/admin/organizations',
      label: t('nav.organizations'),
      icon: 'organizations',
    })
  }
  if (can(user.role, 'audit:read')) {
    items.push({ href: '/admin/audit', label: t('nav.audit'), icon: 'audit' })
  }

  return (
    <AdminShell items={items} title={t('title')}>
      {children}
    </AdminShell>
  )
}
