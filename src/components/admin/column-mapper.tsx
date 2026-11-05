'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { saveSupplierMapping } from '@/lib/actions/import-actions'
import type { DetectedSheet, WorkbookInspection } from '@/lib/import/inspect-workbook'
import type { SheetMapping } from '@/lib/import/parse-supplier-sheet'
import { PRODUCT_COLUMNS } from '@/lib/import/sheet-columns'
import { cn } from '@/lib/utils'

/**
 * Matching a supplier's own columns to ours, once.
 *
 * Their columns down the left with real values beside them, a dropdown of
 * ours on the right. That way round deliberately: the supplier's file is the
 * fixed thing and ours is the question being answered, and showing three
 * actual values is what lets someone tell a product code from a product name
 * without opening the spreadsheet.
 *
 * Suggestions are pre-selected but every one is visible and changeable. The
 * cost of a wrong match is a supplier's prices loaded against the wrong
 * products, so nothing is applied until a person has looked at the list.
 */
export function ColumnMapper({
  supplierId,
  inspection,
  savedMapping,
  reason,
  onSaved,
}: {
  supplierId: string
  inspection: WorkbookInspection
  savedMapping: SheetMapping | null
  reason: string
  onSaved: () => void
}) {
  const t = useTranslations('admin.import')

  const [sheetName, setSheetName] = React.useState(
    savedMapping?.sheetName ?? inspection.bestSheet ?? inspection.sheets[0]?.name ?? ''
  )
  const sheet = inspection.sheets.find((s) => s.name === sheetName)

  /** Their header to our column. Seeded from the suggestions, or the saved mapping. */
  const [choice, setChoice] = React.useState<Record<string, string>>(() =>
    seed(sheet, savedMapping)
  )
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function pickSheet(name: string) {
    setSheetName(name)
    setChoice(seed(inspection.sheets.find((s) => s.name === name), null))
  }

  // Two of our columns reading one of theirs is always a mistake, and it is
  // the mistake a dropdown per row invites. Shown rather than prevented, so
  // the person can see which two.
  const taken = Object.values(choice).filter(Boolean)
  const duplicated = new Set(taken.filter((v, i) => taken.indexOf(v) !== i))

  const mappedCount = taken.length
  const canSave = mappedCount > 0 && duplicated.size === 0 && Boolean(sheet)

  function save() {
    if (!sheet) return
    setError(null)

    // Stored our-column -> their-column, which is the direction the parser
    // reads it in.
    const columns: Record<string, string> = {}
    for (const [theirHeader, ourColumn] of Object.entries(choice)) {
      if (ourColumn) columns[ourColumn] = theirHeader
    }

    startTransition(async () => {
      const result = await saveSupplierMapping({
        supplierId,
        sheetName: sheet.name,
        headerRow: sheet.headerRow,
        columns,
      })

      if (!result.ok) {
        setError(t('errorServer'))
        return
      }
      onSaved()
    })
  }

  return (
    <section className="space-y-5">
      <div className="border-glex-gold-300 bg-glex-gold-50 rounded-xl border p-4">
        <h2 className="text-glex-green-900 font-semibold">{t('mapTitle')}</h2>
        <p className="text-glex-green-800/85 mt-1 text-sm leading-relaxed">{reason}</p>
      </div>

      {inspection.sheets.length > 1 ? (
        <label className="block text-sm">
          <span className="font-medium">{t('mapSheet')}</span>
          <select
            value={sheetName}
            onChange={(event) => pickSheet(event.target.value)}
            className="border-border-subtle mt-1 block w-full max-w-sm rounded-lg border p-2"
          >
            {inspection.sheets.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name} ({option.dataRows})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {sheet ? (
        <div className="border-border-subtle max-h-[30rem] overflow-auto rounded-lg border">
          <table className="w-full text-start text-sm">
            <thead className="bg-glex-green-50 sticky top-0">
              <tr>
                <th scope="col" className="p-2 text-start font-semibold">
                  {t('mapTheirColumn')}
                </th>
                <th scope="col" className="p-2 text-start font-semibold">
                  {t('mapSample')}
                </th>
                <th scope="col" className="p-2 text-start font-semibold">
                  {t('mapOurColumn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.columns.map((column) => {
                const value = choice[column.header] ?? ''
                const clash = value !== '' && duplicated.has(value)

                return (
                  <tr key={column.index} className="border-border-subtle border-t align-top">
                    <td className="p-2 font-medium">{column.header}</td>
                    <td className="text-glex-green-800/60 p-2 text-xs">
                      {column.samples.join(' · ') || '—'}
                    </td>
                    <td className="p-2">
                      <select
                        value={value}
                        aria-label={`${column.header} maps to`}
                        onChange={(event) =>
                          setChoice((current) => ({
                            ...current,
                            [column.header]: event.target.value,
                          }))
                        }
                        className={cn(
                          'border-border-subtle w-full rounded-lg border p-1.5 text-sm',
                          clash && 'border-red-600 bg-red-50'
                        )}
                      >
                        <option value="">{t('mapIgnore')}</option>
                        {PRODUCT_COLUMNS.map((ours) => (
                          <option key={ours.header} value={ours.header}>
                            {ours.header}
                            {ours.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {duplicated.size > 0 ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {t('mapDuplicate', { columns: [...duplicated].join(', ') })}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="button" onClick={save} disabled={!canSave || pending}>
          {pending ? t('importing') : t('mapSave')}
        </Button>
        <span className="text-glex-green-800/70 text-sm">
          {t('mapCount', { count: mappedCount })}
        </span>
      </div>
    </section>
  )
}

/** Their header to our column, from the suggestions or a saved mapping. */
function seed(
  sheet: DetectedSheet | undefined,
  savedMapping: SheetMapping | null
): Record<string, string> {
  if (!sheet) return {}

  // A saved mapping is somebody's earlier decision and outranks a fresh guess.
  const fromSaved = new Map(
    Object.entries(savedMapping?.columns ?? {}).map(([ours, theirs]) => [theirs, ours])
  )

  const seeded: Record<string, string> = {}
  for (const column of sheet.columns) {
    const chosen = fromSaved.get(column.header) ?? column.suggested
    if (chosen) seeded[column.header] = chosen
  }
  return seeded
}
