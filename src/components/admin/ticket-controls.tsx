'use client'

import { TicketPriority, TicketStatus } from '@prisma/client'
import { Save, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldSelect,
  FieldTextarea,
} from '@/components/ui/field'
import { useRouter } from '@/i18n/navigation'
import { replyToTicketAsStaff, updateTicket } from '@/lib/actions/ticket-actions'

type Result = { ok: boolean; error?: string }

function useTicketAction() {
  const admin = useTranslations('admin')
  const common = useTranslations('common')
  const support = useTranslations('support')

  const router = useRouter()
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  function run(action: () => Promise<Result>, successText: string, onOk?: () => void) {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        onOk?.()
        setMessage({ kind: 'ok', text: successText })
        router.refresh()
        return
      }
      setMessage({
        kind: 'error',
        text:
          result.error === 'closed'
            ? support('errorClosed')
            : result.error === 'validation'
              ? admin('checkFields')
              : common('errorBody'),
      })
    })
  }

  return { run, message, pending, admin, common, support }
}

function Feedback({ message }: { message: { kind: 'ok' | 'error'; text: string } | null }) {
  if (!message) return null

  return (
    <p
      role={message.kind === 'error' ? 'alert' : 'status'}
      className={
        message.kind === 'error'
          ? 'mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800'
          : 'mt-3 rounded-lg bg-glex-green-50 p-3 text-sm font-medium text-glex-green-800'
      }
    >
      {message.text}
    </p>
  )
}

/** Status and priority. */
export function TicketStatusControls({
  reference,
  currentStatus,
  currentPriority,
}: {
  reference: string
  currentStatus: TicketStatus
  currentPriority: TicketPriority
}) {
  const { run, message, pending, common, support } = useTicketAction()

  const [status, setStatus] = React.useState<TicketStatus>(currentStatus)
  const [priority, setPriority] = React.useState<TicketPriority>(currentPriority)

  return (
    <div className="rounded-xl border border-border-subtle p-6">
      <h2 className="text-lg font-semibold">{support('updateAction')}</h2>

      <div className="mt-4 space-y-4">
        <Field>
          <FieldLabel>{support('status')}</FieldLabel>
          <FieldSelect
            value={status}
            onChange={(event) => setStatus(event.target.value as TicketStatus)}
          >
            {Object.values(TicketStatus).map((value) => (
              <option key={value} value={value}>
                {support(`status${value}`)}
              </option>
            ))}
          </FieldSelect>
        </Field>

        <Field>
          <FieldLabel>{support('priority')}</FieldLabel>
          <FieldSelect
            value={priority}
            onChange={(event) => setPriority(event.target.value as TicketPriority)}
          >
            {Object.values(TicketPriority).map((value) => (
              <option key={value} value={value}>
                {support(`priority${value}`)}
              </option>
            ))}
          </FieldSelect>
        </Field>
      </div>

      <Button
        type="button"
        variant="primary"
        className="mt-4"
        disabled={pending}
        onClick={() =>
          run(() => updateTicket({ reference, status, priority }), common('save'))
        }
      >
        <Save className="size-4" aria-hidden="true" />
        {pending ? common('loading') : support('updateAction')}
      </Button>

      <Feedback message={message} />
    </div>
  )
}

/**
 * A staff message on a ticket.
 *
 * Visibility is explicit with no default that reaches the requester — the
 * damaging mistake is an internal remark going out by accident, so the control
 * starts on "GLEX staff only".
 */
export function TicketReplyControls({ reference }: { reference: string }) {
  const { run, message, pending, common, support } = useTicketAction()

  const [body, setBody] = React.useState('')
  const [isInternal, setIsInternal] = React.useState(true)

  return (
    <form
      className="rounded-xl border border-border-subtle p-6"
      onSubmit={(event) => {
        event.preventDefault()
        run(
          () => replyToTicketAsStaff({ reference, body, isInternal }),
          support('replySent'),
          () => setBody('')
        )
      }}
    >
      <h2 className="text-lg font-semibold">{support('replyLabel')}</h2>

      <div className="mt-4 space-y-4">
        <Field>
          <FieldLabel>{support('visibility')}</FieldLabel>
          <FieldSelect
            value={isInternal ? 'internal' : 'client'}
            onChange={(event) => setIsInternal(event.target.value === 'internal')}
          >
            <option value="internal">{support('visibilityInternal')}</option>
            <option value="client">{support('visibilityClient')}</option>
          </FieldSelect>
          <FieldDescription>
            {isInternal ? support('visibilityInternal') : support('sendToClient')}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel required>{support('replyLabel')}</FieldLabel>
          <FieldTextarea
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
            required
          />
        </Field>
      </div>

      {/* Names its object: this page already has an "Update ticket" button, and
          two controls reading "Save" would tell the user nothing. */}
      <Button
        type="submit"
        variant={isInternal ? 'outline' : 'primary'}
        className="mt-4"
        disabled={pending || body.trim().length < 2}
      >
        <Send className="size-4 rtl-flip" aria-hidden="true" />
        {pending ? common('loading') : isInternal ? support('saveNote') : support('sendToClient')}
      </Button>

      <Feedback message={message} />
    </form>
  )
}
