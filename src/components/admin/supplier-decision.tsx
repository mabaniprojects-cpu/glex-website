'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel, FieldSelect, FieldTextarea } from '@/components/ui/field'
import { decideSupplier } from '@/lib/actions/admin-actions'

/** Decisions an approver may record. Mirrors the server-side schema. */
const DECISIONS = [
  'UNDER_REVIEW',
  'CLARIFICATION_REQUIRED',
  'APPROVED',
  'CONDITIONALLY_APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const

export function SupplierDecisionForm({
  supplierId,
  currentStatus,
}: {
  supplierId: string
  currentStatus: string
}) {
  const supplier = useTranslations('supplier')
  const admin = useTranslations('admin')
  const common = useTranslations('common')

  const router = useRouter()
  const [status, setStatus] = React.useState(currentStatus)
  const [note, setNote] = React.useState('')
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  function submit() {
    setMessage(null)
    startTransition(async () => {
      const result = await decideSupplier({ supplierId, status, note })
      if (result.ok) {
        setMessage({ kind: 'ok', text: common('save') })
        setNote('')
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: common('errorBody') })
      }
    })
  }

  return (
    <div className="space-y-5 rounded-xl border border-border-subtle p-6">
      <h2 className="text-lg font-semibold">{common('status')}</h2>

      <Field>
        <FieldLabel>{common('status')}</FieldLabel>
        <FieldSelect value={status} onChange={(event) => setStatus(event.target.value)}>
          {DECISIONS.map((value) => (
            <option key={value} value={value}>
              {supplier(`status.${value}`)}
            </option>
          ))}
        </FieldSelect>
      </Field>

      <Field>
        <FieldLabel>{admin('internalNotes')}</FieldLabel>
        <FieldTextarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
        {/* The note is emailed to the applicant on a clarification or rejection. */}
        <FieldDescription>{admin('requestClarification')}</FieldDescription>
      </Field>

      <Button
        type="button"
        variant="primary"
        disabled={pending || (status === currentStatus && note.trim() === '')}
        onClick={submit}
      >
        <Check className="size-4" aria-hidden="true" />
        {pending ? common('loading') : common('save')}
      </Button>

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
    </div>
  )
}
