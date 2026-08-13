import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RecordEditor, type FieldSpec } from '@/components/admin/record-editor'
import { routing } from '@/i18n/routing'
import {
  deleteAnnouncement,
  deleteSocialLink,
  saveAnnouncement,
  saveSocialLink,
} from '@/lib/actions/settings-actions'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { toDateTimeLocalInput } from '@/lib/utils'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminSettingsPage({
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

  const [announcements, socialLinks] = await Promise.all([
    db.announcement.findMany({ orderBy: { updatedAt: 'desc' } }),
    db.socialLink.findMany({ orderBy: [{ sortOrder: 'asc' }, { platform: 'asc' }] }),
  ])

  const announcementFields: FieldSpec[] = [
    {
      name: 'message',
      label: admin('announcementMessage'),
      kind: 'text',
      required: true,
      maxLength: 300,
      wide: true,
    },
    { name: 'href', label: admin('announcementLink'), kind: 'text', wide: true, ltr: true },
    {
      name: 'variant',
      label: admin('announcementVariant'),
      kind: 'select',
      options: [
        { value: 'info', label: admin('variantInfo') },
        { value: 'warning', label: admin('variantWarning') },
        { value: 'success', label: admin('variantSuccess') },
      ],
    },
    { name: 'startsAt', label: admin('startsAt'), kind: 'datetime' },
    {
      name: 'endsAt',
      label: admin('endsAt'),
      kind: 'datetime',
      description: admin('scheduleHint'),
    },
    { name: 'isActive', label: admin('activeField'), kind: 'checkbox' },
  ]

  const socialFields: FieldSpec[] = [
    { name: 'platform', label: admin('platform'), kind: 'text', required: true, maxLength: 40 },
    { name: 'sortOrder', label: admin('sortOrder'), kind: 'number' },
    { name: 'url', label: admin('linkUrl'), kind: 'text', required: true, wide: true, ltr: true },
    { name: 'isActive', label: admin('activeField'), kind: 'checkbox' },
  ]

  return (
    <div className="space-y-14">
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.announcements')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">
          {admin('announcementsIntro')}
        </p>

        <RecordEditor
          records={announcements.map((row) => ({
            id: row.id,
            title: row.message,
            subtitle: row.href ?? undefined,
            muted: !row.isActive,
            values: {
              message: row.message,
              href: row.href ?? '',
              variant: row.variant,
              startsAt: toDateTimeLocalInput(row.startsAt),
              endsAt: toDateTimeLocalInput(row.endsAt),
              isActive: row.isActive,
            },
          }))}
          fields={announcementFields}
          blank={{
            message: '',
            href: '',
            variant: 'info',
            startsAt: '',
            endsAt: '',
            isActive: false,
          }}
          labels={{
            add: admin('newAnnouncement'),
            edit: admin('editAnnouncement'),
            empty: common('noResults'),
            inactive: admin('inactive'),
          }}
          save={saveAnnouncement}
          remove={deleteAnnouncement}
        />
      </section>

      <section className="border-t border-border-subtle pt-10">
        <h2 className="text-2xl font-bold sm:text-3xl">{admin('nav.social')}</h2>
        <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{admin('socialIntro')}</p>

        <RecordEditor
          records={socialLinks.map((row) => ({
            id: row.id,
            title: row.platform,
            subtitle: row.url,
            muted: !row.isActive,
            values: {
              platform: row.platform,
              url: row.url,
              sortOrder: String(row.sortOrder),
              isActive: row.isActive,
            },
          }))}
          fields={socialFields}
          blank={{ platform: '', url: '', sortOrder: '0', isActive: true }}
          labels={{
            add: admin('newSocialLink'),
            edit: admin('editSocialLink'),
            empty: common('noResults'),
            inactive: admin('inactive'),
          }}
          save={saveSocialLink}
          remove={deleteSocialLink}
        />
      </section>
    </div>
  )
}
