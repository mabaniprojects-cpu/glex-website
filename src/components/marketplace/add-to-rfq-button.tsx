'use client'

import { Check, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { addToCart } from '@/lib/actions/cart-actions'

/**
 * Adds a product to the RFQ cart.
 *
 * Deliberately never mentions a price — the catalogue is quotation-based.
 */
export function AddToRfqButton({
  productId,
  variant = 'primary',
  size = 'sm',
  className,
  fullWidth = false,
}: {
  productId: string
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
  fullWidth?: boolean
}) {
  const t = useTranslations('marketplace')
  const common = useTranslations('common')

  const [state, setState] = React.useState<'idle' | 'pending' | 'added' | 'error'>('idle')

  async function onClick() {
    setState('pending')
    const result = await addToCart({ productId })

    if (result.ok) {
      setState('added')
      // Revert so the control can be used again after a quantity change.
      window.setTimeout(() => setState('idle'), 2500)
      return
    }
    setState('error')
  }

  return (
    <div className={fullWidth ? 'w-full' : undefined}>
      <Button
        type="button"
        variant={state === 'added' ? 'subtle' : variant}
        size={size}
        onClick={onClick}
        disabled={state === 'pending'}
        className={className}
        // Announce the outcome without stealing focus.
        aria-live="polite"
      >
        {state === 'added' ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Plus className="size-4" aria-hidden="true" />
        )}
        {state === 'pending'
          ? common('loading')
          : state === 'added'
            ? t('inRfq')
            : t('addToRfq')}
      </Button>

      {state === 'error' ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {common('errorBody')}
        </p>
      ) : null}
    </div>
  )
}
