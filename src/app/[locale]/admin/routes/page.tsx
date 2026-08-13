import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RecordEditor, type FieldSpec } from '@/components/admin/record-editor'
import { routing } from '@/i18n/routing'
import { deleteGlobalRoute, saveGlobalRoute } from '@/lib/actions/settings-actions'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** Kept in sync with the `ShipmentMode` enum in prisma/schema.prisma. */
const MODES = ['OCEAN', 'AIR', 'ROAD', 'RAIL', 'MULTIMODAL'] as const

export default async function AdminRoutesPage({
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
  const tracking = await getTranslations('tracking')

  const routes = await db.globalRoute.findMany({
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  })

  const fields: FieldSpec[] = [
    { name: 'label', label: admin('routeLabel'), kind: 'text', required: true, maxLength: 120, wide: true },
    { name: 'originName', label: tracking('origin'), kind: 'text', required: true, maxLength: 120 },
    {
      name: 'destName',
      label: tracking('destination'),
      kind: 'text',
      required: true,
      maxLength: 120,
    },
    { name: 'originLat', label: admin('originLat'), kind: 'number', required: true, ltr: true },
    { name: 'originLng', label: admin('originLng'), kind: 'number', required: true, ltr: true },
    { name: 'destLat', label: admin('destLat'), kind: 'number', required: true, ltr: true },
    { name: 'destLng', label: admin('destLng'), kind: 'number', required: true, ltr: true },
    {
      name: 'mode',
      label: tracking('mode'),
      kind: 'select',
      options: MODES.map((value) => ({ value, label: tracking(`mode_${value}`) })),
    },
    { name: 'sortOrder', label: admin('sortOrder'), kind: 'number' },
    { name: 'isActive', label: admin('activeField'), kind: 'checkbox' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.routes')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{admin('routesIntro')}</p>

      <RecordEditor
        records={routes.map((row) => ({
          id: row.id,
          title: row.label,
          subtitle: `${row.originName} → ${row.destName}`,
          muted: !row.isActive,
          values: {
            label: row.label,
            originName: row.originName,
            originLat: String(row.originLat),
            originLng: String(row.originLng),
            destName: row.destName,
            destLat: String(row.destLat),
            destLng: String(row.destLng),
            mode: row.mode,
            sortOrder: String(row.sortOrder),
            isActive: row.isActive,
          },
        }))}
        fields={fields}
        blank={{
          label: '',
          originName: '',
          originLat: '',
          originLng: '',
          destName: '',
          destLat: '',
          destLng: '',
          mode: 'OCEAN',
          sortOrder: '0',
          isActive: true,
        }}
        labels={{
          add: admin('newRoute'),
          edit: admin('editRoute'),
          empty: common('noResults'),
          inactive: admin('inactive'),
        }}
        save={saveGlobalRoute}
        remove={deleteGlobalRoute}
      />
    </div>
  )
}
