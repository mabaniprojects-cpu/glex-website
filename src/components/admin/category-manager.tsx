'use client'

import { Plus, Save, Trash2, X } from 'lucide-react'
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
import { deleteCategory, saveCategory } from '@/lib/actions/content-actions'

export type AdminCategory = {
  id: string
  slug: string
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  parentId: string | null
  parent: { name: string } | null
  productCount: number
  childCount: number
}

type Draft = {
  id?: string
  name: string
  description: string
  parentId: string
  sortOrder: string
  isActive: boolean
}

const EMPTY: Draft = { name: '', description: '', parentId: '', sortOrder: '0', isActive: true }

/**
 * Category management.
 *
 * Deleting a category that still has products or children is refused by the
 * server; the message explains why rather than failing silently.
 */
export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')

  const router = useRouter()
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  function edit(category: AdminCategory) {
    setMessage(null)
    setDraft({
      id: category.id,
      name: category.name,
      description: category.description ?? '',
      parentId: category.parentId ?? '',
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
    })
  }

  function errorText(error: string) {
    if (error === 'in_use') return admin('categoryInUse')
    if (error === 'validation') return admin('checkFields')
    return common('errorBody')
  }

  function submit() {
    if (!draft) return
    setMessage(null)

    startTransition(async () => {
      const result = await saveCategory({
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name,
        description: draft.description,
        parentId: draft.parentId,
        sortOrder: draft.sortOrder,
        isActive: draft.isActive,
      })

      if (result.ok) {
        setMessage({ kind: 'ok', text: admin('saved') })
        setDraft(null)
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: errorText(result.error) })
      }
    })
  }

  function remove(category: AdminCategory) {
    setMessage(null)
    startTransition(async () => {
      const result = await deleteCategory({ id: category.id })
      if (result.ok) {
        setMessage({ kind: 'ok', text: admin('deleted') })
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: errorText(result.error) })
      }
    })
  }

  return (
    <div className="mt-6">
      {draft === null ? (
        <Button type="button" variant="primary" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="size-4" aria-hidden="true" />
          {admin('newCategory')}
        </Button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          className="space-y-4 rounded-xl border border-border-subtle p-6"
        >
          <h2 className="text-lg font-semibold">
            {draft.id ? admin('editCategory') : admin('newCategory')}
          </h2>

          <Field>
            <FieldLabel required>{admin('categoryName')}</FieldLabel>
            <FieldInput
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              maxLength={120}
              required
            />
            <FieldDescription>{admin('slugAuto')}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>{admin('descriptionField')}</FieldLabel>
            <FieldTextarea
              rows={3}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              maxLength={2000}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{admin('parentCategory')}</FieldLabel>
              <FieldSelect
                value={draft.parentId}
                onChange={(event) => setDraft({ ...draft, parentId: event.target.value })}
              >
                <option value="">{admin('noParent')}</option>
                {categories
                  // A category cannot be its own parent.
                  .filter((category) => category.id !== draft.id)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </FieldSelect>
            </Field>

            <Field>
              <FieldLabel>{admin('sortOrder')}</FieldLabel>
              <FieldInput
                type="number"
                min={0}
                max={9999}
                value={draft.sortOrder}
                onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
              className="size-4 rounded border-border-subtle"
            />
            {admin('activeField')}
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={pending || !draft.name.trim()}>
              <Save className="size-4" aria-hidden="true" />
              {pending ? common('loading') : common('save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
              <X className="size-4" aria-hidden="true" />
              {common('cancel')}
            </Button>
          </div>
        </form>
      )}

      {message ? (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={
            message.kind === 'error'
              ? 'mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800'
              : 'mt-4 rounded-lg bg-glex-green-50 p-3 text-sm font-medium text-glex-green-800'
          }
        >
          {message.text}
        </p>
      ) : null}

      {categories.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{common('noResults')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle p-4"
            >
              <div>
                <p className="font-semibold">
                  {category.name}
                  {!category.isActive ? (
                    <span className="ms-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-glex-green-800/70">
                      {admin('inactive')}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-glex-green-800/60">
                  {category.parent ? `${category.parent.name} · ` : ''}
                  <span dir="ltr">{category.slug}</span> ·{' '}
                  {admin('productCount', { count: category.productCount })}
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => edit(category)}>
                  {common('edit')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || category.productCount > 0 || category.childCount > 0}
                  // Disabled rather than hidden, so the reason stays discoverable.
                  title={
                    category.productCount > 0 || category.childCount > 0
                      ? admin('categoryInUse')
                      : undefined
                  }
                  onClick={() => remove(category)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span className="sr-only">{common('delete')}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
