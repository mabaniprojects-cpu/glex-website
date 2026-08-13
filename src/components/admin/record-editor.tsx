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

/**
 * A create/edit/delete list for the small settings collections — the
 * announcement bar, social links, FAQ entries and trade routes.
 *
 * Each of those is the same shape: a flat record, a handful of fields, an
 * inline form. One component keeps them consistent and keeps the four admin
 * pages down to a field list each. Anything with real structure (products,
 * articles) gets its own bespoke form instead.
 *
 * `values` are plain strings and booleans, so the whole record crosses the
 * Server→Client boundary as serializable data.
 */

export type FieldKind = 'text' | 'textarea' | 'number' | 'datetime' | 'select' | 'checkbox'

export type FieldSpec = {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  description?: string
  maxLength?: number
  /** `select` only. */
  options?: Array<{ value: string; label: string }>
  /** Renders the control across both columns. */
  wide?: boolean
  /** Forces left-to-right, for URLs and coordinates. */
  ltr?: boolean
}

export type RecordValues = Record<string, string | boolean>

export type EditableRecord = {
  id: string
  /** Shown as the row heading. */
  title: string
  /** Shown under the heading, e.g. a URL or a status. */
  subtitle?: string
  /** Greys the row out, for an inactive record. */
  muted?: boolean
  values: RecordValues
}

type ActionResult = { ok: boolean; error?: string }

export function RecordEditor({
  records,
  fields,
  blank,
  labels,
  save,
  remove,
}: {
  records: EditableRecord[]
  fields: FieldSpec[]
  blank: RecordValues
  labels: { add: string; edit: string; empty: string; inactive?: string }
  save: (values: RecordValues & { id?: string }) => Promise<ActionResult>
  remove: (input: { id: string }) => Promise<ActionResult>
}) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')

  const router = useRouter()
  const [draft, setDraft] = React.useState<(RecordValues & { id?: string }) | null>(null)
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  const set = (name: string, value: string | boolean) =>
    setDraft((current) => (current ? { ...current, [name]: value } : current))

  function submit() {
    if (!draft) return
    setMessage(null)

    startTransition(async () => {
      const result = await save(draft)
      if (result.ok) {
        setMessage({ kind: 'ok', text: admin('saved') })
        setDraft(null)
        router.refresh()
      } else {
        setMessage({
          kind: 'error',
          text: result.error === 'validation' ? admin('checkFields') : common('errorBody'),
        })
      }
    })
  }

  function destroy(id: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await remove({ id })
      if (result.ok) {
        setMessage({ kind: 'ok', text: admin('deleted') })
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: common('errorBody') })
      }
    })
  }

  const requiredMissing = fields.some(
    (field) => field.required && !String(draft?.[field.name] ?? '').trim()
  )

  return (
    <div className="mt-6">
      {draft === null ? (
        <Button type="button" variant="primary" onClick={() => setDraft({ ...blank })}>
          <Plus className="size-4" aria-hidden="true" />
          {labels.add}
        </Button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          className="space-y-4 rounded-xl border border-border-subtle p-6"
        >
          <h2 className="text-lg font-semibold">{draft.id ? labels.edit : labels.add}</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const value = draft[field.name]

              if (field.kind === 'checkbox') {
                return (
                  <label
                    key={field.name}
                    className="flex items-center gap-2 text-sm sm:col-span-2"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) => set(field.name, event.target.checked)}
                      className="size-4 rounded border-border-subtle"
                    />
                    {field.label}
                  </label>
                )
              }

              return (
                <Field key={field.name} className={field.wide ? 'sm:col-span-2' : undefined}>
                  <FieldLabel required={field.required}>{field.label}</FieldLabel>

                  {field.kind === 'textarea' ? (
                    <FieldTextarea
                      rows={4}
                      value={String(value ?? '')}
                      onChange={(event) => set(field.name, event.target.value)}
                      maxLength={field.maxLength}
                      required={field.required}
                    />
                  ) : field.kind === 'select' ? (
                    <FieldSelect
                      value={String(value ?? '')}
                      onChange={(event) => set(field.name, event.target.value)}
                    >
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </FieldSelect>
                  ) : (
                    <FieldInput
                      type={
                        field.kind === 'number'
                          ? 'number'
                          : field.kind === 'datetime'
                            ? 'datetime-local'
                            : 'text'
                      }
                      value={String(value ?? '')}
                      onChange={(event) => set(field.name, event.target.value)}
                      maxLength={field.kind === 'text' ? field.maxLength : undefined}
                      required={field.required}
                      dir={field.ltr ? 'ltr' : undefined}
                    />
                  )}

                  {field.description ? (
                    <FieldDescription>{field.description}</FieldDescription>
                  ) : null}
                </Field>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={pending || requiredMissing}>
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

      {records.length === 0 ? (
        <p className="mt-10 text-glex-green-800/70">{labels.empty}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {records.map((record) => (
            <li
              key={record.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border-subtle p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {record.title}
                  {record.muted && labels.inactive ? (
                    <span className="ms-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-glex-green-800/70">
                      {labels.inactive}
                    </span>
                  ) : null}
                </p>
                {record.subtitle ? (
                  <p className="mt-1 truncate text-xs text-glex-green-800/60">{record.subtitle}</p>
                ) : null}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMessage(null)
                    setDraft({ ...record.values, id: record.id })
                  }}
                >
                  {common('edit')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => destroy(record.id)}
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
