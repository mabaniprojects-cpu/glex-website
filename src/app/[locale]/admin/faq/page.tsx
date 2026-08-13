import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RecordEditor, type FieldSpec } from '@/components/admin/record-editor'
import { locales, localeLabels, routing, type AppLocale } from '@/i18n/routing'
import { toDbLocale } from '@/i18n/locale'
import { deleteFaqEntry, saveFaqEntry } from '@/lib/actions/settings-actions'
import { requirePermission } from '@/lib/auth-guards'
import { db } from '@/lib/db'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminFaqPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  await requirePermission('knowledge:write')

  const admin = await getTranslations('admin')
  const common = await getTranslations('common')
  const nav = await getTranslations('nav')

  const entries = await db.faqEntry.findMany({
    orderBy: [{ locale: 'asc' }, { category: 'asc' }, { sortOrder: 'asc' }],
  })

  const fields: FieldSpec[] = [
    {
      name: 'question',
      label: admin('faqQuestion'),
      kind: 'text',
      required: true,
      maxLength: 300,
      wide: true,
    },
    {
      name: 'answer',
      label: admin('faqAnswer'),
      kind: 'textarea',
      required: true,
      maxLength: 4000,
      wide: true,
      description: admin('faqAnswerHint'),
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
    { name: 'category', label: admin('faqCategory'), kind: 'text', maxLength: 80 },
    { name: 'sortOrder', label: admin('sortOrder'), kind: 'number' },
    { name: 'isActive', label: admin('activeField'), kind: 'checkbox' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{nav('faq')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-glex-green-800/70">{admin('faqIntro')}</p>

      <RecordEditor
        records={entries.map((row) => ({
          id: row.id,
          title: row.question,
          subtitle: [row.locale, row.category].filter(Boolean).join(' · '),
          muted: !row.isActive,
          values: {
            question: row.question,
            answer: row.answer,
            locale: row.locale,
            category: row.category ?? '',
            sortOrder: String(row.sortOrder),
            isActive: row.isActive,
          },
        }))}
        fields={fields}
        blank={{
          question: '',
          answer: '',
          locale: 'en',
          category: '',
          sortOrder: '0',
          isActive: true,
        }}
        labels={{
          add: admin('newFaqEntry'),
          edit: admin('editFaqEntry'),
          empty: common('noResults'),
          inactive: admin('inactive'),
        }}
        save={saveFaqEntry}
        remove={deleteFaqEntry}
      />
    </div>
  )
}
