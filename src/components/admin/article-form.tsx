'use client'

import { Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldInput,
  FieldLabel,
  FieldSelect,
  FieldTextarea,
} from '@/components/ui/field'
import { useRouter } from '@/i18n/navigation'
import { deleteArticle, saveArticle } from '@/lib/actions/news-actions'
import { fromDateTimeLocalInput } from '@/lib/utils'

/** Kept in sync with the `ContentStatus` enum in prisma/schema.prisma. */
const STATUSES = ['DRAFT', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const

export type ArticleDraft = {
  id?: string
  title: string
  summary: string
  body: string
  categoryId: string
  status: (typeof STATUSES)[number]
  /** `datetime-local` value, i.e. `YYYY-MM-DDTHH:mm`, or empty. */
  publishedAt: string
  isFeatured: boolean
  featuredImage: string
  seoTitle: string
  seoDescription: string
}

export const EMPTY_ARTICLE: ArticleDraft = {
  title: '',
  summary: '',
  body: '',
  categoryId: '',
  status: 'DRAFT',
  publishedAt: '',
  isFeatured: false,
  featuredImage: '',
  seoTitle: '',
  seoDescription: '',
}

export function ArticleForm({
  initial,
  categories,
  canPublish,
  canDelete,
}: {
  initial: ArticleDraft
  categories: Array<{ id: string; name: string }>
  canPublish: boolean
  canDelete: boolean
}) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')
  const news = useTranslations('news')

  const router = useRouter()
  const [draft, setDraft] = React.useState(initial)
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  const set = <K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  // Only a publisher may move an article into a public state.
  const statuses = canPublish
    ? STATUSES
    : STATUSES.filter((value) => value !== 'PUBLISHED' && value !== 'SCHEDULED')

  // Parsed the same way the server will, so the notice below cannot disagree
  // with what actually happens on save.
  const publishInstant = fromDateTimeLocalInput(draft.publishedAt)
  const willBePublic =
    (draft.status === 'PUBLISHED' || draft.status === 'SCHEDULED') &&
    (!publishInstant || publishInstant <= new Date())

  function submit() {
    setMessage(null)

    startTransition(async () => {
      const result = await saveArticle({
        ...(draft.id ? { id: draft.id } : {}),
        title: draft.title,
        summary: draft.summary,
        body: draft.body,
        categoryId: draft.categoryId,
        status: draft.status,
        publishedAt: draft.publishedAt,
        isFeatured: draft.isFeatured,
        featuredImage: draft.featuredImage,
        seoTitle: draft.seoTitle,
        seoDescription: draft.seoDescription,
      })

      if (result.ok) {
        router.push('/admin/news')
        router.refresh()
      } else {
        setMessage({
          kind: 'error',
          text: result.error === 'validation' ? admin('checkFields') : common('errorBody'),
        })
      }
    })
  }

  function remove() {
    if (!draft.id) return
    setMessage(null)

    startTransition(async () => {
      const result = await deleteArticle({ id: draft.id })
      if (result.ok) {
        router.push('/admin/news')
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: common('errorBody') })
      }
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="mt-6 max-w-3xl space-y-6"
    >
      <div className="space-y-4 rounded-xl border border-border-subtle p-6">
        <Field>
          <FieldLabel required>{admin('articleTitle')}</FieldLabel>
          <FieldInput
            value={draft.title}
            onChange={(event) => set('title', event.target.value)}
            maxLength={200}
            required
          />
          <FieldDescription>{admin('slugAuto')}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel required>{admin('articleSummary')}</FieldLabel>
          <FieldTextarea
            rows={3}
            value={draft.summary}
            onChange={(event) => set('summary', event.target.value)}
            maxLength={1000}
            required
          />
        </Field>

        <Field>
          <FieldLabel required>{admin('articleBody')}</FieldLabel>
          <FieldTextarea
            rows={16}
            value={draft.body}
            onChange={(event) => set('body', event.target.value)}
            maxLength={60_000}
            required
          />
          <FieldDescription>{admin('readingTimeAuto')}</FieldDescription>
        </Field>
      </div>

      <div className="grid gap-4 rounded-xl border border-border-subtle p-6 sm:grid-cols-2">
        <Field>
          <FieldLabel>{news('allCategories')}</FieldLabel>
          <FieldSelect
            value={draft.categoryId}
            onChange={(event) => set('categoryId', event.target.value)}
          >
            <option value="">{admin('noCategory')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </FieldSelect>
        </Field>

        <Field>
          <FieldLabel>{common('status')}</FieldLabel>
          <FieldSelect
            value={draft.status}
            onChange={(event) => set('status', event.target.value as ArticleDraft['status'])}
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {admin(`contentStatus.${value}`)}
              </option>
            ))}
          </FieldSelect>
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel>{admin('publishDate')}</FieldLabel>
          <FieldInput
            type="datetime-local"
            value={draft.publishedAt}
            onChange={(event) => set('publishedAt', event.target.value)}
          />
          <FieldDescription>{admin('publishDateHint')}</FieldDescription>
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel>{admin('featuredImageUrl')}</FieldLabel>
          <FieldInput
            value={draft.featuredImage}
            onChange={(event) => set('featuredImage', event.target.value)}
            maxLength={500}
            dir="ltr"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={draft.isFeatured}
            onChange={(event) => set('isFeatured', event.target.checked)}
            className="size-4 rounded border-border-subtle"
          />
          {admin('featuredOnHomepage')}
        </label>
      </div>

      <div className="space-y-4 rounded-xl border border-border-subtle p-6">
        <h2 className="text-lg font-semibold">{admin('seoSection')}</h2>

        <Field>
          <FieldLabel>{admin('seoTitle')}</FieldLabel>
          <FieldInput
            value={draft.seoTitle}
            onChange={(event) => set('seoTitle', event.target.value)}
            maxLength={200}
          />
        </Field>

        <Field>
          <FieldLabel>{admin('seoDescription')}</FieldLabel>
          <FieldTextarea
            rows={2}
            value={draft.seoDescription}
            onChange={(event) => set('seoDescription', event.target.value)}
            maxLength={400}
          />
        </Field>
      </div>

      {/* States plainly whether saving makes this visible to the public. */}
      <p className="rounded-lg bg-surface-muted p-3 text-sm text-glex-green-800/80">
        {willBePublic ? admin('willBePublic') : admin('willStayPrivate')}
      </p>

      {message ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800"
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={pending || !draft.title.trim() || !draft.summary.trim() || !draft.body.trim()}
        >
          <Save className="size-4" aria-hidden="true" />
          {pending ? common('loading') : common('save')}
        </Button>

        {draft.id && canDelete ? (
          <Button type="button" variant="danger" onClick={remove} disabled={pending}>
            <Trash2 className="size-4" aria-hidden="true" />
            {common('delete')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
