import { Download } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ListRange } from '@/components/ui/list-range'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { routing } from '@/i18n/routing'
import { requirePermission } from '@/lib/auth-guards'
import { listInquiriesForAdmin } from '@/lib/admin'
import { buildPageHref, pageCount, pageWindow } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminInquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('inquiry:read')

  const contact = await getTranslations('contact')
  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const rawParams = await searchParams
  const { page, skip, take } = pageWindow(rawParams.page)

  const { items, total } = await listInquiriesForAdmin({ take, skip })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.inquiries')}</h1>
        <Button asChild variant="outline" size="sm">
          <a href="/api/admin/export/inquiries" download>
            <Download className="size-4" aria-hidden="true" />
            {admin('exportCsv')}
          </a>
        </Button>
      </div>

      <ListRange page={page} take={take} count={items.length} total={total} />

      {items.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{admin('nav.inquiries')}</caption>
            <thead>
              <tr className="border-b border-border-subtle">
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {common('reference')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {contact('inquiryType')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {contact('subject')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {contact('company')}
                </th>
                <th scope="col" className="py-3 pe-4 text-start font-semibold">
                  {common('status')}
                </th>
                <th scope="col" className="py-3 text-start font-semibold">
                  {common('date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-border-subtle">
                  <td className="py-3 pe-4 font-mono text-xs" dir="ltr">
                    {row.reference}
                  </td>
                  <td className="py-3 pe-4">{contact(`type.${row.type}`)}</td>
                  <td className="py-3 pe-4">{row.subject}</td>
                  <td className="py-3 pe-4">{row.company ?? row.fullName}</td>
                  <td className="py-3 pe-4">{row.status}</td>
                  <td className="py-3 whitespace-nowrap">
                    {formatDate(row.createdAt, locale, { dateStyle: 'medium' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={page}
            pageCount={pageCount(total, take)}
            buildHref={(target) => buildPageHref('/admin/inquiries', rawParams, target)}
          />
        </div>
      )}
    </div>
  )
}
