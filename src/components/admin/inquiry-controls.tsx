'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldSelect, FieldTextarea } from '@/components/ui/field'
import { updateInquiryStatus } from '@/lib/actions/admin-actions'

const INQUIRY_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'WAITING_ON_CLIENT',
  'RESOLVED',
  'CLOSED',
  'SPAM',
] as const

/**
 * Status and internal notes for one enquiry.
 *
 * `updateInquiryStatus` existed — permission-checked and audited — but nothing
 * ever called it, so every enquiry sat at NEW for its whole life. This is the
 * caller.
 *
 * Status and notes save together in one action rather than as two controls,
 * because they are one thought: "I have looked at this, here is what I found."
 * Splitting them invites saving one and losing the other.
 */
export function InquiryAdminControls({
  id,
  currentStatus,
  currentNotes,
}: {
  id: string
  currentStatus: string
  currentNotes: string | null
}) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')
  const contact = useTranslations('contact')

  const router = useRouter()
  const [status, setStatus] = React.useState(currentStatus)
  const [notes, setNotes] = React.useState(currentNotes ?? '')
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  function save() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateInquiryStatus({ id, status, internalNotes: notes })
      if (result.ok) {
        setMessage({ kind: 'ok', text: admin('saved') })
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: common('errorBody') })
      }
    })
  }

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel>{common('status')}</FieldLabel>
        <FieldSelect
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          disabled={pending}
        >
          {INQUIRY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {contact(`status.${value}`)}
            </option>
          ))}
        </FieldSelect>
      </Field>

      <Field>
        <FieldLabel>{admin('internalNotes')}</FieldLabel>
        <FieldTextarea
          rows={5}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={pending}
        />
      </Field>

      <Button type="button" onClick={save} disabled={pending} variant="primary" size="sm">
        <Check className="size-4" aria-hidden="true" />
        {pending ? common('loading') : common('save')}
      </Button>

      {message ? (
        <p
          role="status"
          className={message.kind === 'ok' ? 'text-glex-green-700 text-sm' : 'text-sm text-red-700'}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
