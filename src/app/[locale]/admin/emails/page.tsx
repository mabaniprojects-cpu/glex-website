import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RecordEditor, type FieldSpec } from '@/components/admin/record-editor'
import { toDbLocale } from '@/i18n/locale'
import { localeLabels, locales, routing, type AppLocale } from '@/i18n/routing'
import {
  deleteEmailTemplate,
  saveEmailTemplate,
} from '@/lib/actions/email-template-actions'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { TEMPLATE_KEYS } from '@/lib/mail/types'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminEmailsPage({
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

  const templates = await db.emailTemplate.findMany({
    orderBy: [{ key: 'asc' }, { locale: 'asc' }],
  })

  // Which keys have no row at all, in any locale — those send the hard-coded
  // English copy, which is correct but not editable, so it is worth naming.
  const covered = new Set(templates.map((row) => row.key))
  const uncovered = TEMPLATE_KEYS.filter((key) => !covered.has(key))

  const fields: FieldSpec[] = [
    {
      name: 'key',
      label: admin('emails.key'),
      kind: 'select',
      // Only keys the application actually sends. Anything else would be copy
      // that is edited and never read.
      options: TEMPLATE_KEYS.map((key) => ({ value: key, label: key })),
    },
    {
      name: 'locale',
      label: common('language'),
      kind: 'select',
      // The database enum uses `zh_CN`; the URL form is `zh-CN`.
      options: locales.map((value) => ({
        value: toDbLocale(value),
        label: localeLabels[value as AppLocale],
      })),
    },
    {
      name: 'subject',
      label: admin('emails.subject'),
      kind: 'text',
      required: true,
      maxLength: 200,
      wide: true,
    },
    { name: 'heading', label: admin('emails.heading'), kind: 'text', maxLength: 200, wide: true },
    {
      name: 'body',
      label: admin('emails.body'),
      kind: 'textarea',
      required: true,
      maxLength: 4000,
      wide: true,
      description: admin('emails.bodyHint'),
    },
    { name: 'isActive', label: admin('activeField'), kind: 'checkbox' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{admin('nav.emails')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{admin('emails.intro')}</p>

      {uncovered.length > 0 ? (
        <p className="mt-4 max-w-2xl rounded-lg bg-surface-muted p-3 text-sm text-glex-green-800/80">
          {admin('emails.uncovered', { keys: uncovered.join(', ') })}
        </p>
      ) : null}

      <RecordEditor
        records={templates.map((row) => ({
          id: row.id,
          title: row.key,
          subtitle: `${row.locale} · ${row.subject}`,
          muted: !row.isActive,
          values: {
            key: row.key,
            locale: row.locale,
            subject: row.subject,
            heading: row.heading ?? '',
            body: row.body,
            isActive: row.isActive,
          },
        }))}
        fields={fields}
        blank={{
          key: TEMPLATE_KEYS[0],
          locale: 'en',
          subject: '',
          heading: '',
          body: '',
          isActive: true,
        }}
        labels={{
          add: admin('emails.add'),
          edit: admin('emails.edit'),
          empty: common('noResults'),
          inactive: admin('inactive'),
        }}
        save={saveEmailTemplate}
        remove={deleteEmailTemplate}
      />
    </div>
  )
}
