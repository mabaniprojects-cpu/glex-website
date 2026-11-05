'use client'

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { FileUpload, type UploadedFile } from '@/components/ui/file-upload'
import { commitSupplierImport, previewSupplierImport } from '@/lib/actions/import-actions'
import type { Issue } from '@/lib/import/parse-supplier-sheet'
import type { ImportPlan, RowPlan } from '@/lib/import/plan-import'
import { cn } from '@/lib/utils'

/**
 * Loading a supplier's returned data sheet.
 *
 * Upload, see exactly what it would do, then confirm. The preview is not a
 * courtesy: a sheet is the one input GLEX does not control the shape of, and
 * a supplier who renamed a column or typed over a dropdown should find that
 * out before fifty products change, not after.
 *
 * The plan shown here is never sent back to be acted on. Confirming re-runs
 * the whole read on the server from the same stored file, so what is written
 * cannot be edited in the browser on the way through.
 */
export function SupplierImport({ supplierId }: { supplierId: string }) {
  const t = useTranslations('admin.import')

  const [files, setFiles] = React.useState<UploadedFile[]>([])
  const [plan, setPlan] = React.useState<ImportPlan | null>(null)
  const [fileIssues, setFileIssues] = React.useState<Issue[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  const fileId = files[0]?.id ?? null

  const message = (code: string) =>
    ({
      unreadable: t('errorUnreadable'),
      too_large: t('errorTooLarge'),
      not_found: t('errorNotFound'),
      nothing_to_do: t('nothingToDo'),
    })[code] ?? t('errorServer')

  /**
   * Reading starts as soon as a file lands — there is nothing to ask first,
   * and the preview is what the person came here for.
   *
   * Driven from the upload callback rather than an effect watching the file
   * id. Uploading is an event, not external state to synchronise against,
   * and an effect here would re-read the sheet on every unrelated re-render
   * that happened to change the identity it watched.
   */
  function onFiles(next: UploadedFile[]) {
    setFiles(next)
    setError(null)
    setDone(null)

    const uploaded = next[0]
    if (!uploaded) {
      setPlan(null)
      setFileIssues([])
      return
    }

    startTransition(async () => {
      const result = await previewSupplierImport({ supplierId, fileId: uploaded.id })
      if (!result.ok) {
        setError(message(result.error))
        setPlan(null)
        return
      }
      setPlan(result.plan)
      setFileIssues(result.fileIssues)
    })
  }

  function confirm() {
    if (!fileId) return
    setError(null)

    startTransition(async () => {
      const result = await commitSupplierImport({ supplierId, fileId })
      if (!result.ok) {
        setError(message(result.error))
        return
      }
      setDone(t('done'))
      setPlan(null)
      setFiles([])
    })
  }

  const blockingIssues = fileIssues.filter((issue) => issue.level === 'error')
  const canImport =
    plan !== null && blockingIssues.length === 0 && plan.summary.create + plan.summary.update > 0

  return (
    <div className="space-y-6">
      <p className="text-glex-green-800/80 max-w-2xl text-sm leading-relaxed">{t('intro')}</p>

      <FileUpload
        value={files}
        onChange={onFiles}
        purpose="supplier-sheets"
        accept=".xlsx"
        maxFiles={1}
      />

      {pending && !plan ? (
        <p role="status" className="text-glex-green-800/70 text-sm">
          {t('checking')}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {done ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-glex-green-50 p-4 text-sm font-medium text-glex-green-800"
        >
          <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
          {done}
        </p>
      ) : null}

      {fileIssues.length > 0 ? <IssueList title={t('issuesTitle')} issues={fileIssues} /> : null}

      {plan ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('preview')}</h2>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Figure label={t('willCreate')} value={plan.summary.create} />
            <Figure label={t('willUpdate')} value={plan.summary.update} />
            <Figure label={t('willSkip')} value={plan.summary.skip} muted />
            <Figure label={t('pricesAdded')} value={plan.summary.pricesAdded} />
            <Figure label={t('packings')} value={plan.summary.packings} />
          </dl>

          <PlanTable
            rows={plan.rows}
            labels={{
              row: t('rowColumn'),
              product: t('productColumn'),
              action: t('actionColumn'),
              notes: t('notesColumn'),
              create: t('actionCreate'),
              update: t('actionUpdate'),
              skip: t('actionSkip'),
            }}
          />

          <Button type="button" onClick={confirm} disabled={!canImport || pending}>
            {pending ? t('importing') : t('confirm')}
          </Button>

          {!canImport && plan.summary.skip > 0 ? (
            <p className="text-glex-green-800/70 text-sm">{t('nothingToDo')}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function Figure({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="border-border-subtle rounded-lg border p-3">
      <dt className="text-glex-green-800/70 text-xs">{label}</dt>
      <dd
        className={cn(
          'mt-1 text-2xl font-bold',
          muted ? 'text-glex-green-800/50' : 'text-glex-green-900'
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function IssueList({ title, issues }: { title: string; issues: Issue[] }) {
  return (
    <section className="border-border-subtle rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-2 space-y-1.5">
        {issues.map((issue, index) => (
          <li key={index} className="flex gap-2 text-sm">
            {issue.level === 'error' ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-700" aria-hidden="true" />
            ) : (
              <Info className="text-glex-gold-700 mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <span className="text-glex-green-800/85">
              {issue.column ? <strong>{issue.column}: </strong> : null}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Every row, not only the interesting ones.
 *
 * A supplier sheet is someone's work; showing only the failures invites the
 * reader to assume the rest is what they expected. Rows carrying a problem
 * are ordered first so a long sheet does not bury them.
 */
function PlanTable({
  rows,
  labels,
}: {
  rows: RowPlan[]
  labels: Record<'row' | 'product' | 'action' | 'notes' | 'create' | 'update' | 'skip', string>
}) {
  const ordered = [...rows].sort((a, b) => {
    const weight = (row: RowPlan) =>
      row.action === 'skip' ? 0 : row.issues.some((i) => i.level === 'warning') ? 1 : 2
    return weight(a) - weight(b) || a.rowNumber - b.rowNumber
  })

  const actionLabel = { create: labels.create, update: labels.update, skip: labels.skip }

  return (
    <div className="border-border-subtle max-h-[28rem] overflow-auto rounded-lg border">
      <table className="w-full text-start text-sm">
        <thead className="bg-glex-green-50 sticky top-0">
          <tr>
            <th scope="col" className="p-2 text-start font-semibold">
              {labels.row}
            </th>
            <th scope="col" className="p-2 text-start font-semibold">
              {labels.product}
            </th>
            <th scope="col" className="p-2 text-start font-semibold">
              {labels.action}
            </th>
            <th scope="col" className="p-2 text-start font-semibold">
              {labels.notes}
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => (
            <tr key={row.rowNumber} className="border-border-subtle border-t align-top">
              <td className="text-glex-green-800/60 p-2 tabular-nums">{row.rowNumber}</td>
              <td className="p-2 font-medium">{row.name}</td>
              <td className="p-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    row.action === 'create' && 'bg-glex-green-100 text-glex-green-800',
                    row.action === 'update' && 'bg-glex-gold-100 text-glex-gold-800',
                    row.action === 'skip' && 'bg-surface-muted text-glex-green-800/60'
                  )}
                >
                  {actionLabel[row.action]}
                </span>
              </td>
              <td className="text-glex-green-800/75 p-2">
                {row.skipReason ?? row.changes.join(', ')}
                {row.issues.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {row.issues.map((issue, index) => (
                      <li
                        key={index}
                        className={cn(
                          'text-xs',
                          issue.level === 'error' ? 'text-red-700' : 'text-glex-gold-800'
                        )}
                      >
                        {issue.column ? `${issue.column}: ` : ''}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
