'use client'

import { Save, Trash2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldInput, FieldLabel, FieldTextarea } from '@/components/ui/field'
import { useRouter } from '@/i18n/navigation'
import {
  deleteOrganization,
  setOrganizationActive,
  updateOrganization,
} from '@/lib/actions/organization-actions'

export type OrganizationRecord = {
  id: string
  name: string
  country: string
  city: string
  address: string
  website: string
  phone: string
  vatNumber: string
  crNumber: string
  description: string
  isActive: boolean
  /** Non-zero means the delete guard will refuse; shown up front. */
  holdings: number
  isOwn: boolean
}

type Draft = Omit<OrganizationRecord, 'id' | 'isActive' | 'holdings' | 'isOwn'>

const TEXT_FIELDS = [
  { name: 'country', max: 100 },
  { name: 'city', max: 100 },
  { name: 'phone', max: 40, ltr: true },
  { name: 'website', max: 500, ltr: true },
  { name: 'vatNumber', max: 50, ltr: true },
  { name: 'crNumber', max: 50, ltr: true },
] as const

/**
 * Edit, enable/disable and delete controls for one organization.
 *
 * Disabling is the consequential action — it denies a session to every member —
 * so the button says what it does rather than reading as a tidy-up.
 */
export function OrganizationControls({ record }: { record: OrganizationRecord }) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')

  const router = useRouter()
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  const set = (name: keyof Draft, value: string) =>
    setDraft((current) => (current ? { ...current, [name]: value } : current))

  type Result = { ok: boolean; error?: string }

  function run(action: () => Promise<Result>, onOk?: () => void) {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        onOk?.()
        setMessage({ kind: 'ok', text: admin('saved') })
        router.refresh()
        return
      }
      setMessage({
        kind: 'error',
        text:
          result.error === 'in_use'
            ? admin('organizations.errorInUse')
            : result.error === 'validation'
              ? admin('checkFields')
              : common('errorBody'),
      })
    })
  }

  if (draft) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          run(() => updateOrganization({ id: record.id, ...draft }), () => setDraft(null))
        }}
        className="space-y-4 rounded-xl border border-border-subtle p-4 text-start"
      >
        <Field>
          <FieldLabel required>{admin('organizations.name')}</FieldLabel>
          <FieldInput
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
            maxLength={200}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map((field) => (
            <Field key={field.name}>
              <FieldLabel>{admin(`organizations.${field.name}`)}</FieldLabel>
              <FieldInput
                value={draft[field.name]}
                onChange={(event) => set(field.name, event.target.value)}
                maxLength={field.max}
                dir={'ltr' in field && field.ltr ? 'ltr' : undefined}
              />
              {field.name === 'website' ? (
                <FieldDescription>{admin('organizations.websiteHint')}</FieldDescription>
              ) : null}
            </Field>
          ))}
        </div>

        <Field>
          <FieldLabel>{admin('organizations.address')}</FieldLabel>
          <FieldInput
            value={draft.address}
            onChange={(event) => set('address', event.target.value)}
            maxLength={300}
          />
        </Field>

        <Field>
          <FieldLabel>{admin('organizations.description')}</FieldLabel>
          <FieldTextarea
            rows={3}
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
            maxLength={2000}
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={pending || !draft.name.trim()}>
            <Save className="size-4" aria-hidden="true" />
            {pending ? common('loading') : common('save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDraft(null)}
            disabled={pending}
          >
            <X className="size-4" aria-hidden="true" />
            {common('cancel')}
          </Button>
        </div>

        {message?.kind === 'error' ? (
          <p role="alert" className="text-xs font-medium text-red-800">
            {message.text}
          </p>
        ) : null}
      </form>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setMessage(null)
            const { isActive: _a, holdings: _h, isOwn: _o, id: _i, ...rest } = record
            setDraft(rest)
          }}
        >
          {common('edit')}
        </Button>

        <Button
          type="button"
          variant={record.isActive ? 'ghost' : 'primary'}
          size="sm"
          disabled={pending || (record.isActive && record.isOwn)}
          onClick={() => run(() => setOrganizationActive({ id: record.id, isActive: !record.isActive }))}
        >
          {record.isActive ? admin('organizations.disable') : admin('organizations.enable')}
        </Button>

        {/* Offered only when the guard would actually allow it, so the button
            is not a promise the server refuses. */}
        {record.holdings === 0 && !record.isOwn ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => deleteOrganization({ id: record.id }))}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            <span className="sr-only">{common('delete')}</span>
          </Button>
        ) : null}
      </div>

      {record.isActive && record.isOwn ? (
        <p className="text-xs text-glex-green-800/60">{admin('organizations.ownHint')}</p>
      ) : null}

      {message ? (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={
            message.kind === 'error'
              ? 'text-xs font-medium text-red-800'
              : 'text-xs font-medium text-glex-green-700'
          }
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
