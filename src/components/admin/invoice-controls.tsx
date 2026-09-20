'use client'

import { Receipt, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/navigation'
import { markQuotationInvoiced } from '@/lib/actions/finance-actions'

/** Records — or corrects — that a quotation has been invoiced. */
export function InvoiceControls({
  id,
  invoicedAt,
  invoiceReference,
}: {
  id: string
  invoicedAt: string | null
  invoiceReference: string | null
}) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')
  const router = useRouter()

  const [reference, setReference] = React.useState(invoiceReference ?? '')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function run(invoiced: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await markQuotationInvoiced({ id, invoiced, invoiceReference: reference })
      if (result.ok) {
        router.refresh()
        return
      }
      setError(common('errorBody'))
    })
  }

  if (invoicedAt) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-glex-green-700 text-sm font-medium">
          {admin('finance.invoiced')}
          {invoiceReference ? ` · ${invoiceReference}` : ''}
        </span>
        <span className="text-glex-green-800/60 text-xs">{invoicedAt}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(false)}
        >
          <Undo2 className="rtl-flip size-4" aria-hidden="true" />
          {common('undo')}
        </Button>
        {error ? (
          <p role="alert" className="text-xs font-medium text-red-800">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <label className="text-xs">
        <span className="sr-only">{admin('finance.invoiceReference')}</span>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder={admin('finance.invoiceReference')}
          maxLength={64}
          dir="ltr"
          className="border-border-subtle h-9 w-40 rounded-lg border px-2 text-sm"
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(true)}
      >
        <Receipt className="size-4" aria-hidden="true" />
        {pending ? common('loading') : admin('finance.markInvoiced')}
      </Button>
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  )
}
