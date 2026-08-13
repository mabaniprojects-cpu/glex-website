'use client'

import { FileUp, Send } from 'lucide-react'
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
import { issueQuotation, replyOnRfqAsStaff } from '@/lib/actions/quotation-actions'

type Result = { ok: boolean; error?: string }

function useRfqAction() {
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
            : result.error === 'validation'
              ? admin('checkFields')
              : common('errorBody'),
      })
    })
  }

  return { run, message, pending, admin, common, rfq }
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

/**
 * Issues a quotation against an RFQ.
 *
 * The commercial figures live in the uploaded document — there is deliberately
 * no price field anywhere in this application. What is recorded here is that an
 * offer was made, by whom, and until when it stands.
 */
export function IssueQuotationForm({ reference }: { reference: string }) {
  const { run, message, pending, common, rfq } = useRfqAction()

  const [fileId, setFileId] = React.useState('')
  const [fileName, setFileName] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [currency, setCurrency] = React.useState('SAR')
  const [validUntil, setValidUntil] = React.useState('')
  const [notes, setNotes] = React.useState('')

  async function upload(file: File) {
    setUploadError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      // Groups offer documents under their own storage prefix rather than the
      // generic `uploads/` bucket.
      form.append('purpose', 'quotations')

      const response = await fetch('/api/uploads', { method: 'POST', body: form })
      const payload = (await response.json()) as { id?: string; error?: string }

      if (!response.ok || !payload.id) {
        setUploadError(common('errorBody'))
        return
      }

      setFileId(payload.id)
      setFileName(file.name)
    } catch {
      setUploadError(common('errorBody'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <form
      className="rounded-xl border border-border-subtle p-6"
      onSubmit={(event) => {
        event.preventDefault()
        run(
          () => issueQuotation({ reference, fileId, currency, validUntil, notes }),
          rfq('replySent'),
          () => {
            setFileId('')
            setFileName('')
            setNotes('')
            setValidUntil('')
          }
        )
      }}
    >
      <h2 className="text-lg font-semibold">{rfq('issueQuotation')}</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel>{rfq('quotationFile')}</FieldLabel>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            disabled={uploading || pending}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
            }}
            className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-glex-green-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
          <FieldDescription>
            {uploading
              ? common('loading')
              : fileName
                ? fileName
                : rfq('quotationNotes')}
          </FieldDescription>
          {uploadError ? (
            <p role="alert" className="text-xs font-medium text-red-800">
              {uploadError}
            </p>
          ) : null}
        </Field>

        <Field>
          <FieldLabel>{rfq('validUntil')}</FieldLabel>
          <FieldInput
            type="datetime-local"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel>{'Currency'}</FieldLabel>
          <FieldSelect value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {['SAR', 'USD', 'EUR', 'AED'].map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </FieldSelect>
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel>{rfq('quotationNotes')}</FieldLabel>
          <FieldTextarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
          />
        </Field>
      </div>

      <Button type="submit" variant="primary" className="mt-4" disabled={pending || uploading}>
        <FileUp className="size-4" aria-hidden="true" />
        {pending ? common('loading') : rfq('issueQuotation')}
      </Button>

      <Feedback message={message} />
    </form>
  )
}

/**
 * A staff message on an RFQ.
 *
 * Visibility is an explicit choice with no default that reaches the client —
 * the destructive mistake here is an internal remark going out by accident, so
 * "GLEX staff only" is what the control starts on.
 */
export function StaffReplyForm({ reference }: { reference: string }) {
  const { run, message, pending, common, rfq } = useRfqAction()

  const [body, setBody] = React.useState('')
  const [isInternal, setIsInternal] = React.useState(true)

  return (
    <form
      className="rounded-xl border border-border-subtle p-6"
      onSubmit={(event) => {
        event.preventDefault()
        run(() => replyOnRfqAsStaff({ reference, body, isInternal }), rfq('replySent'), () =>
          setBody('')
        )
      }}
    >
      <h2 className="text-lg font-semibold">{rfq('messages')}</h2>

      <div className="mt-4 space-y-4">
        <Field>
          <FieldLabel>{rfq('replyVisibility')}</FieldLabel>
          <FieldSelect
            value={isInternal ? 'internal' : 'client'}
            onChange={(event) => setIsInternal(event.target.value === 'internal')}
          >
            <option value="internal">{rfq('replyInternal')}</option>
            <option value="client">{rfq('replyClient')}</option>
          </FieldSelect>
          <FieldDescription>
            {isInternal ? rfq('replyInternal') : rfq('sendToClient')}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel required>{rfq('messages')}</FieldLabel>
          <FieldTextarea
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
            required
          />
        </Field>
      </div>

      <Button
        type="submit"
        // Sending to a client is the consequential choice, so it is the one
        // that looks like a send rather than a save.
        variant={isInternal ? 'outline' : 'primary'}
        className="mt-4"
        disabled={pending || body.trim().length < 2}
      >
        <Send className="size-4 rtl-flip" aria-hidden="true" />
        {/* Not a bare "Save": the status form on this same page already has
            one, and a button should say which of the two things it does. */}
        {pending ? common('loading') : isInternal ? rfq('saveNote') : rfq('sendToClient')}
      </Button>

      <Feedback message={message} />
    </form>
  )
}
