import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RecordEditor, type FieldSpec } from '@/components/admin/record-editor'
import { routing } from '@/i18n/routing'
import { deleteOffice, saveOffice } from '@/lib/actions/office-actions'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminOfficesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('settings:write')

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')

  const offices = await db.office.findMany({
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
  })

  const fields: FieldSpec[] = [
    {
      name: 'name',
      label: admin('offices.name'),
      kind: 'text',
      required: true,
      maxLength: 150,
      wide: true,
    },
    {
      name: 'addressLines',
      label: admin('offices.addressLines'),
      kind: 'textarea',
      maxLength: 600,
      wide: true,
      description: admin('offices.addressHint'),
    },
    { name: 'city', label: admin('offices.city'), kind: 'text', required: true, maxLength: 100 },
    {
      name: 'country',
      label: admin('offices.country'),
      kind: 'text',
      required: true,
      maxLength: 100,
    },
    { name: 'poBox', label: admin('offices.poBox'), kind: 'text', maxLength: 40, ltr: true },
    {
      name: 'postalCode',
      label: admin('offices.postalCode'),
      kind: 'text',
      maxLength: 40,
      ltr: true,
    },
    { name: 'phone', label: admin('offices.phone'), kind: 'text', maxLength: 40, ltr: true },
    {
      name: 'latitude',
      label: admin('offices.latitude'),
      kind: 'text',
      ltr: true,
      description: admin('offices.coordinateHint'),
    },
    { name: 'longitude', label: admin('offices.longitude'), kind: 'text', ltr: true },
    { name: 'isPrimary', label: admin('offices.isPrimary'), kind: 'checkbox' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.offices')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{admin('offices.intro')}</p>

      <RecordEditor
        records={offices.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: [
            `${row.city}, ${row.country}`,
            row.isPrimary ? admin('offices.primaryBadge') : null,
          ]
            .filter(Boolean)
            .join(' · '),
          values: {
            name: row.name,
            // One line per row, matching how the card renders them.
            addressLines: row.addressLines.join('\n'),
            city: row.city,
            country: row.country,
            poBox: row.poBox ?? '',
            postalCode: row.postalCode ?? '',
            phone: row.phone ?? '',
            latitude: row.latitude === null ? '' : String(row.latitude),
            longitude: row.longitude === null ? '' : String(row.longitude),
            isPrimary: row.isPrimary,
          },
        }))}
        fields={fields}
        blank={{
          name: '',
          addressLines: '',
          city: '',
          country: '',
          poBox: '',
          postalCode: '',
          phone: '',
          latitude: '',
          longitude: '',
          isPrimary: false,
        }}
        labels={{
          add: admin('offices.add'),
          edit: admin('offices.edit'),
          empty: common('noResults'),
        }}
        save={saveOffice}
        remove={deleteOffice}
      />
    </div>
  )
}
