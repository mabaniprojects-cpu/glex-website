'use client'

import type { Locale } from '@prisma/client'
import { Languages, Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldInput, FieldLabel, FieldTextarea } from '@/components/ui/field'
import { fromDbLocale } from '@/i18n/locale'
import { useRouter } from '@/i18n/navigation'
import { localeLabels, type AppLocale } from '@/i18n/routing'
import { deleteTranslation, saveTranslation } from '@/lib/actions/translation-actions'
import {
  TRANSLATABLE_LOCALES,
  TRANSLATION_FIELDS,
  type TranslatableKind,
} from '@/lib/translations'

export type TranslationRow = { locale: Locale } & Record<string, unknown>

/**
 * Per-entity translation editing.
 *
 * One locale at a time, with the English source shown beside each field. A
 * translator working from a blank box guesses; one working from the source
 * does not.
 *
 * English is absent from the tabs on purpose — the base record *is* the English
 * text, and an `en` translation row would shadow it.
 */
export function TranslationEditor({
  kind,
  entityId,
  source,
  existing,
  labels,
}: {
  kind: TranslatableKind
  entityId: string
  /** The English base text, keyed by field name. */
  source: Record<string, string>
  existing: TranslationRow[]
  /** Field labels, keyed by field name. */
  labels: Record<string, string>
}) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')

  const router = useRouter()
  const fields = TRANSLATION_FIELDS[kind]

  const [locale, setLocale] = React.useState<Locale>(TRANSLATABLE_LOCALES[0]!)
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  const rowFor = React.useCallback(
    (target: Locale) => existing.find((row) => row.locale === target),
    [existing]
  )

  const [values, setValues] = React.useState<Record<string, string>>(() => readRow(rowFor(locale)))

  function readRow(row: TranslationRow | undefined): Record<string, string> {
    const next: Record<string, string> = {}
    for (const field of fields) {
      const raw = row?.[field.name]
      next[field.name] = typeof raw === 'string' ? raw : ''
    }
    return next
  }

  function switchTo(target: Locale) {
    setMessage(null)
    setLocale(target)
    setValues(readRow(rowFor(target)))
  }

  const missingRequired = fields.some(
    (field) => field.required && !values[field.name]?.trim()
  )

  function run(action: () => Promise<{ ok: boolean; error?: string }>, successText: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        setMessage({ kind: 'ok', text: successText })
        router.refresh()
        return
      }
      setMessage({
        kind: 'error',
        text:
          result.error === 'validation'
            ? admin('checkFields')
            : result.error === 'not_found'
              ? admin('translations.errorMissing')
              : common('errorBody'),
      })
    })
  }

  const hasRow = Boolean(rowFor(locale))

  return (
    <section
      aria-labelledby="translations-heading"
      className="rounded-xl border border-border-subtle p-6"
    >
      <h2 id="translations-heading" className="flex items-center gap-2 text-lg font-semibold">
        <Languages className="size-5 text-glex-green-600" aria-hidden="true" />
        {admin('translations.heading')}
      </h2>
      <p className="mt-2 text-sm text-glex-green-800/70">{admin('translations.intro')}</p>

      {/* Locale tabs. English is the source, so it is not offered. */}
      <div role="tablist" aria-label={admin('translations.heading')} className="mt-5 flex flex-wrap gap-2">
        {TRANSLATABLE_LOCALES.map((candidate) => {
          const active = candidate === locale
          const translated = Boolean(rowFor(candidate))

          return (
            <button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTo(candidate)}
              className={
                active
                  ? 'rounded-lg bg-glex-green-700 px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium'
              }
            >
              {localeLabels[fromDbLocale(candidate) as AppLocale]}
              {/* A dot rather than a word: it marks state without claiming the
                  translation is complete or correct. */}
              {translated ? (
                <span aria-hidden="true" className="ms-2 text-xs">
                  ●
                </span>
              ) : null}
              <span className="sr-only">
                {translated ? admin('translations.hasTranslation') : admin('translations.missing')}
              </span>
            </button>
          )
        })}
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          run(
            () => saveTranslation({ kind, entityId, locale, values }),
            admin('saved')
          )
        }}
      >
        {fields.map((field) => (
          <Field key={field.name}>
            <FieldLabel required={field.required}>{labels[field.name] ?? field.name}</FieldLabel>

            {field.multiline ? (
              <FieldTextarea
                rows={field.maxLength > 4000 ? 10 : 3}
                value={values[field.name] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.name]: event.target.value }))
                }
                maxLength={field.maxLength}
                dir={locale === 'ar' ? 'rtl' : undefined}
              />
            ) : (
              <FieldInput
                value={values[field.name] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.name]: event.target.value }))
                }
                maxLength={field.maxLength}
                dir={locale === 'ar' ? 'rtl' : undefined}
              />
            )}

            {/* The source, so nobody translates from memory. */}
            {source[field.name] ? (
              <FieldDescription>
                <span className="font-medium">{admin('translations.sourceLabel')}</span>{' '}
                <span dir="ltr">{source[field.name]}</span>
              </FieldDescription>
            ) : null}
          </Field>
        ))}

        <div className="flex flex-wrap gap-2">
          {/* Names its object rather than saying "Save": this editor is mounted
              beneath a product or article form that already has a Save, and two
              buttons reading the same word tell the user nothing. */}
          <Button type="submit" variant="primary" disabled={pending || missingRequired}>
            <Save className="size-4" aria-hidden="true" />
            {pending ? common('loading') : admin('translations.save')}
          </Button>

          {/* Offered only when there is something to remove. Removing is safe:
              the page falls back to the English source. */}
          {hasRow ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(
                  () => deleteTranslation({ kind, entityId, locale }),
                  admin('deleted')
                )
              }
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {admin('translations.remove')}
            </Button>
          ) : null}
        </div>

        {message ? (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={
              message.kind === 'error'
                ? 'rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800'
                : 'rounded-lg bg-glex-green-50 p-3 text-sm font-medium text-glex-green-800'
            }
          >
            {message.text}
          </p>
        ) : null}
      </form>
    </section>
  )
}
