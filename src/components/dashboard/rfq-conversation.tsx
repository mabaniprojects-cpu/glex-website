'use client'

import { Check, Send, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldTextarea } from '@/components/ui/field'
import { useRouter } from '@/i18n/navigation'
import { replyToRfq, respondToQuotation } from '@/lib/actions/rfq-conversation-actions'

type Result = { ok: boolean; error?: string }

function useAction() {
  const admin = useTranslations('admin')
  const common = useTranslations('common')
  const rfq = useTranslations('rfq')

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
            ? rfq('errorClosed')
            : result.error === 'rate_limited'
              ? rfq('errorTooMany')
              : result.error === 'validation'
                ? admin('checkFields')
                : common('errorBody'),
      })
    })
  }

  return { run, message, pending, common, rfq }
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

/** Lets the client add to the thread on their own RFQ. */
export function RfqReplyForm({ reference }: { reference: string }) {
  const { run, message, pending, common, rfq } = useAction()
  const [body, setBody] = React.useState('')

  return (
    <form
      className="mt-6"
      onSubmit={(event) => {
        event.preventDefault()
        run(() => replyToRfq({ reference, body }), rfq('replySent'), () => setBody(''))
      }}
    >
      <Field>
        <FieldLabel required>{rfq('messages')}</FieldLabel>
        <FieldTextarea
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          placeholder={rfq('messagePlaceholder')}
          required
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        className="mt-3"
        disabled={pending || body.trim().length < 2}
      >
        <Send className="size-4 rtl-flip" aria-hidden="true" />
        {pending ? common('loading') : rfq('sendMessage')}
      </Button>

      <Feedback message={message} />
    </form>
  )
}

/**
 * Accept or decline a quotation.
 *
 * Declining asks for a reason before it will submit — a rejection with no
 * explanation tells the sourcing team nothing, and asking afterwards rarely
 * gets an answer.
 */
export function QuotationDecision({ quotationId }: { quotationId: string }) {
  const { run, message, pending, common, rfq } = useAction()
  const [declining, setDeclining] = React.useState(false)
  const [reason, setReason] = React.useState('')

  if (declining) {
    return (
      <form
        className="mt-4 w-full"
        onSubmit={(event) => {
          event.preventDefault()
          run(
            () => respondToQuotation({ quotationId, accept: false, reason }),
            rfq('decisionRecorded'),
            () => setDeclining(false)
          )
        }}
      >
        <Field>
          <FieldLabel required>{rfq('rejectReason')}</FieldLabel>
          <FieldTextarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={1000}
            required
          />
        </Field>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={pending || !reason.trim()}>
            {pending ? common('loading') : rfq('reject')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDeclining(false)}
            disabled={pending}
          >
            {common('cancel')}
          </Button>
        </div>

        <Feedback message={message} />
      </form>
    )
  }

  return (
    <div className="mt-4 w-full">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => respondToQuotation({ quotationId, accept: true }), rfq('decisionRecorded'))
          }
        >
          <Check className="size-4" aria-hidden="true" />
          {rfq('accept')}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setDeclining(true)}
        >
          <X className="size-4" aria-hidden="true" />
          {rfq('reject')}
        </Button>
      </div>

      <Feedback message={message} />
    </div>
  )
}
