'use client'

import { Check, UserCog } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldSelect, FieldTextarea } from '@/components/ui/field'
import { assignRfq, updateRfqStatus } from '@/lib/actions/admin-actions'

const RFQ_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'CLARIFICATION_REQUIRED',
  'SUPPLIER_SOURCING',
  'QUOTATION_PREPARED',
  'QUOTATION_SENT',
  'CLIENT_REVIEWING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED_TO_ORDER',
  'CANCELLED',
] as const

/**
 * Status and assignment controls.
 *
 * Both actions re-check permissions server-side; hiding a control here is only
 * a convenience.
 */
export function RfqAdminControls({
  reference,
  currentStatus,
  currentAssigneeId,
  staff,
  canAssign,
}: {
  reference: string
  currentStatus: string
  currentAssigneeId: string | null
  staff: Array<{ id: string; name: string }>
  canAssign: boolean
}) {
  const t = useTranslations('rfq')
  const admin = useTranslations('admin')
  const common = useTranslations('common')

  const router = useRouter()
  const [status, setStatus] = React.useState(currentStatus)
  const [note, setNote] = React.useState('')
  const [assignee, setAssignee] = React.useState(currentAssigneeId ?? '')
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  function run(action: () => Promise<{ ok: boolean; error?: string }>, successText: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        setMessage({ kind: 'ok', text: successText })
        setNote('')
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: common('errorBody') })
      }
    })
  }

  return (
    <div className="space-y-6 rounded-xl border border-border-subtle p-6">
      <div>
        <h2 className="text-lg font-semibold">{common('status')}</h2>

        <div className="mt-4 space-y-4">
          <Field>
            <FieldLabel>{common('status')}</FieldLabel>
            <FieldSelect value={status} onChange={(event) => setStatus(event.target.value)}>
              {RFQ_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`status.${value}`)}
                </option>
              ))}
            </FieldSelect>
          </Field>

          <Field>
            <FieldLabel>{admin('internalNotes')}</FieldLabel>
            <FieldTextarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          <Button
            type="button"
            variant="primary"
            disabled={pending || status === currentStatus}
            onClick={() => run(() => updateRfqStatus({ reference, status, note }), common('save'))}
          >
            <Check className="size-4" aria-hidden="true" />
            {pending ? common('loading') : common('save')}
          </Button>
        </div>
      </div>

      {canAssign ? (
        <div className="border-t border-border-subtle pt-6">
          <h2 className="text-lg font-semibold">{admin('assignTo')}</h2>

          <div className="mt-4 space-y-4">
            <Field>
              <FieldLabel>{admin('assignTo')}</FieldLabel>
              <FieldSelect value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                <option value="">{admin('unassigned')}</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </FieldSelect>
            </Field>

            <Button
              type="button"
              variant="outline"
              disabled={pending || assignee === (currentAssigneeId ?? '')}
              onClick={() =>
                run(() => assignRfq({ reference, assigneeId: assignee }), common('save'))
              }
            >
              <UserCog className="size-4" aria-hidden="true" />
              {pending ? common('loading') : admin('assignTo')}
            </Button>
          </div>
        </div>
      ) : null}

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
