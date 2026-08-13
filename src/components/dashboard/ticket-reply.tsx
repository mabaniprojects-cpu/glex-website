'use client'

import { Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldTextarea } from '@/components/ui/field'
import { useRouter } from '@/i18n/navigation'
import { replyToTicket } from '@/lib/actions/ticket-actions'

/** Lets a requester add to their own ticket. */
export function TicketReplyForm({ reference }: { reference: string }) {
  const support = useTranslations('support')
  const rfq = useTranslations('rfq')
  const admin = useTranslations('admin')
  const common = useTranslations('common')

  const router = useRouter()
  const [body, setBody] = React.useState('')
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  return (
    <form
      className="mt-6"
      onSubmit={(event) => {
        event.preventDefault()
        setMessage(null)
        startTransition(async () => {
          const result = await replyToTicket({ reference, body })
          if (result.ok) {
            setBody('')
            setMessage({ kind: 'ok', text: support('replySent') })
            router.refresh()
            return
          }
          setMessage({
            kind: 'error',
            text:
              result.error === 'closed'
                ? support('errorClosed')
                : result.error === 'rate_limited'
                  ? rfq('errorTooMany')
                  : result.error === 'validation'
                    ? admin('checkFields')
                    : common('errorBody'),
          })
        })
      }}
    >
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

      <Button
        type="submit"
        variant="primary"
        className="mt-3"
        disabled={pending || body.trim().length < 2}
      >
        <Send className="size-4 rtl-flip" aria-hidden="true" />
        {pending ? common('loading') : support('sendReply')}
      </Button>

      {message ? (
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
      ) : null}
    </form>
  )
}
