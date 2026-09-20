'use client'

import { RfqOrderClass, RfqTrackStatus, RfqWorkflowStage } from '@prisma/client'
import { ArrowRight, CheckCircle2, FileUp, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/navigation'
import { advanceRfqWorkflow } from '@/lib/actions/workflow-actions'
import type { WorkflowAction } from '@/lib/rfq-workflow'

/**
 * The desk panel on an RFQ.
 *
 * It shows only the hand-offs this person may take right now — the list is
 * computed on the server from the permission matrix and the file's state, and
 * the action re-checks both. So an out-of-date page cannot skip a desk; it can
 * only fail.
 */

/** Which fields each hand-off needs. Mirrors the rules in `rfq-workflow.ts`. */
const FIELDS: Record<
  WorkflowAction,
  { amount?: boolean; estimate?: boolean; note?: 'required' | 'optional'; file?: boolean }
> = {
  forward_to_supply: { note: 'optional' },
  dispatch_pricing: { estimate: true, note: 'optional', file: true },
  send_to_technical: { note: 'optional', file: true },
  submit_technical: { note: 'required', file: true },
  submit_procurement: { amount: true, note: 'optional', file: true },
  submit_shipping: { amount: true, note: 'optional', file: true },
  submit_for_approval: { note: 'optional', file: true },
  approve: { note: 'optional' },
  return_to_supply: { note: 'required' },
}

export function RfqWorkflowPanel({
  reference,
  stage,
  procurementStatus,
  shippingStatus,
  orderClass,
  technicalDueDate,
  estimatedValueUsd,
  actions,
  waitingOnYou,
  technicalThreshold,
}: {
  reference: string
  stage: RfqWorkflowStage
  procurementStatus: RfqTrackStatus
  shippingStatus: RfqTrackStatus
  orderClass: RfqOrderClass | null
  /** Pre-formatted on the server, so the panel does no date maths. */
  technicalDueDate: string | null
  estimatedValueUsd: string | null
  actions: WorkflowAction[]
  waitingOnYou: boolean
  technicalThreshold: string
}) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')
  const router = useRouter()

  const [selected, setSelected] = React.useState<WorkflowAction | null>(null)
  const [note, setNote] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [currency, setCurrency] = React.useState('USD')
  const [estimate, setEstimate] = React.useState('')
  const [fileId, setFileId] = React.useState('')
  const [fileName, setFileName] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  const stageLabel = (value: RfqWorkflowStage) =>
    admin(`workflow.stages.${value}` as 'workflow.stages.INTAKE')
  const actionLabel = (value: WorkflowAction) =>
    admin(`workflow.actions.${value}` as 'workflow.actions.approve')

  const trackLabel = (value: RfqTrackStatus) =>
    value === RfqTrackStatus.SUBMITTED
      ? admin('workflow.trackSubmitted')
      : value === RfqTrackStatus.TECHNICAL_REVIEW
        ? admin('workflow.trackTechnical')
        : value === RfqTrackStatus.TECHNICAL_DONE
          ? admin('workflow.trackTechnicalDone')
          : admin('workflow.trackPending')

  function reset() {
    setSelected(null)
    setNote('')
    setAmount('')
    setEstimate('')
    setFileId('')
    setFileName('')
  }

  async function upload(file: File) {
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('purpose', 'rfq-workflow')

      const response = await fetch('/api/uploads', { method: 'POST', body: form })
      const payload = (await response.json()) as { id?: string }

      if (!response.ok || !payload.id) {
        setError(common('errorBody'))
        return
      }
      setFileId(payload.id)
      setFileName(file.name)
    } catch {
      setError(common('errorBody'))
    } finally {
      setUploading(false)
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    setError(null)
    startTransition(async () => {
      const result = await advanceRfqWorkflow({
        reference,
        action: selected,
        note,
        amount,
        currency,
        estimatedValueUsd: estimate,
        fileId,
      })

      if (result.ok) {
        reset()
        router.refresh()
        return
      }

      setError(
        result.error === 'forbidden' ||
          result.error === 'wrong_stage' ||
          result.error === 'note_required' ||
          result.error === 'amount_required' ||
          result.error === 'closed'
          ? admin(`workflow.errors.${result.error}` as 'workflow.errors.forbidden')
          : common('errorBody')
      )
    })
  }

  const fields = selected ? FIELDS[selected] : null

  return (
    <section
      aria-labelledby="rfq-workflow-heading"
      className="border-border-subtle rounded-xl border p-6"
    >
      <h2 id="rfq-workflow-heading" className="text-lg font-bold">
        {admin('workflow.heading')}
      </h2>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-glex-green-800/70">{admin('workflow.stage')}</dt>
          <dd className="font-semibold">{stageLabel(stage)}</dd>
        </div>

        {stage === RfqWorkflowStage.PRICING ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-glex-green-800/70">{admin('workflow.procurement')}</dt>
              <dd>{trackLabel(procurementStatus)}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-glex-green-800/70">{admin('workflow.shipping')}</dt>
              <dd>{trackLabel(shippingStatus)}</dd>
            </div>
          </>
        ) : null}

        {orderClass ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-glex-green-800/70">{admin('workflow.orderClass')}</dt>
            <dd>{admin(`workflow.classes.${orderClass}` as 'workflow.classes.ORDINARY')}</dd>
          </div>
        ) : null}

        {estimatedValueUsd ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-glex-green-800/70">{admin('workflow.estimatedValue')}</dt>
            <dd>{estimatedValueUsd}</dd>
          </div>
        ) : null}
      </dl>

      {technicalDueDate ? (
        <p className="text-glex-gold-700 mt-3 text-sm font-medium">
          {admin('workflow.technicalDue', { date: technicalDueDate })}
        </p>
      ) : null}

      {waitingOnYou ? (
        <p className="bg-glex-green-50 text-glex-green-800 mt-4 rounded-lg p-3 text-sm font-semibold">
          {admin('workflow.needsYou')}
        </p>
      ) : null}

      {actions.length === 0 ? null : selected === null ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              type="button"
              variant={action === 'return_to_supply' ? 'outline' : 'primary'}
              size="sm"
              onClick={() => setSelected(action)}
            >
              {action === 'approve' ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : (
                <ArrowRight className="rtl-flip size-4" aria-hidden="true" />
              )}
              {actionLabel(action)}
            </Button>
          ))}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <p className="font-semibold">{actionLabel(selected)}</p>

          {fields?.amount ? (
            <div className="flex gap-3">
              <label className="flex-1 text-sm">
                <span className="mb-1 block font-medium">{admin('workflow.amount')}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={amount}
                  dir="ltr"
                  onChange={(event) => setAmount(event.target.value)}
                  className="border-border-subtle h-11 w-full rounded-lg border px-3 text-sm"
                />
              </label>
              <label className="w-28 text-sm">
                <span className="mb-1 block font-medium">{admin('workflow.currency')}</span>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="border-border-subtle h-11 w-full rounded-lg border bg-white px-2 pe-7 text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="SAR">SAR</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>
          ) : null}

          {fields?.estimate ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{admin('workflow.estimatedValue')}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={estimate}
                dir="ltr"
                onChange={(event) => setEstimate(event.target.value)}
                className="border-border-subtle h-11 w-full rounded-lg border px-3 text-sm"
              />
              <span className="text-glex-green-800/70 mt-1 block text-xs">
                {admin('workflow.estimatedValueHint', { threshold: technicalThreshold })}
              </span>
            </label>
          ) : null}

          {fields?.note ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                {admin('workflow.note')}
                {fields.note === 'required' ? ' *' : ''}
              </span>
              <textarea
                rows={3}
                required={fields.note === 'required'}
                value={note}
                maxLength={4000}
                onChange={(event) => setNote(event.target.value)}
                className="border-border-subtle w-full rounded-lg border p-3 text-sm"
              />
              <span className="text-glex-green-800/70 mt-1 block text-xs">
                {admin('workflow.noteHint')}
              </span>
            </label>
          ) : null}

          {fields?.file ? (
            <div className="text-sm">
              <span className="mb-1 block font-medium">{admin('workflow.file')}</span>
              <label className="border-border-subtle inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileUp className="size-4" aria-hidden="true" />
                )}
                <span>{fileName || common('upload')}</span>
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void upload(file)
                  }}
                />
              </label>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="primary" size="sm" disabled={pending || uploading}>
              {pending ? common('loading') : admin('workflow.submit')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={pending}>
              {common('cancel')}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
