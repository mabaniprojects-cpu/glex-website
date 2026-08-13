'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Accessible form primitives.
 *
 * `Field` wires the label, description and error message to the control via
 * `id` / `aria-describedby` / `aria-invalid` automatically, so an error is
 * always announced by a screen reader (WCAG 2.2 AA, Section 25).
 */

type FieldContextValue = {
  id: string
  descriptionId: string
  errorId: string
  hasError: boolean
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

function useField() {
  const ctx = React.useContext(FieldContext)
  if (!ctx) throw new Error('Field subcomponents must be used inside <Field>')
  return ctx
}

export function Field({
  children,
  error,
  className,
}: {
  children: React.ReactNode
  error?: string
  className?: string
}) {
  const id = React.useId()
  const value = React.useMemo<FieldContextValue>(
    () => ({
      id,
      descriptionId: `${id}-description`,
      errorId: `${id}-error`,
      hasError: Boolean(error),
    }),
    [id, error]
  )

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        {children}
        {error ? (
          <p id={value.errorId} role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}

export function FieldLabel({
  children,
  required,
  className,
}: {
  children: React.ReactNode
  required?: boolean
  className?: string
}) {
  const { id } = useField()
  return (
    <label htmlFor={id} className={cn('text-sm font-medium text-glex-green-900', className)}>
      {children}
      {required ? (
        <span className="ms-1 text-red-600" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  )
}

export function FieldDescription({ children }: { children: React.ReactNode }) {
  const { descriptionId } = useField()
  return (
    <p id={descriptionId} className="text-sm text-glex-green-800/70">
      {children}
    </p>
  )
}

const controlClasses = cn(
  'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-glex-green-900',
  'border-border-subtle placeholder:text-glex-green-900/40',
  'transition-colors focus:border-glex-green-600',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
  'aria-[invalid=true]:border-red-600'
)

function useControlProps() {
  const { id, descriptionId, errorId, hasError } = useField()
  return {
    id,
    'aria-invalid': hasError || undefined,
    'aria-describedby': cn(descriptionId, hasError && errorId) || undefined,
  }
}

export const FieldInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} {...useControlProps()} className={cn(controlClasses, className)} {...props} />
))
FieldInput.displayName = 'FieldInput'

export const FieldTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 5, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    {...useControlProps()}
    className={cn(controlClasses, 'resize-y', className)}
    {...props}
  />
))
FieldTextarea.displayName = 'FieldTextarea'

export const FieldSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    {...useControlProps()}
    className={cn(controlClasses, 'pe-8', className)}
    {...props}
  >
    {children}
  </select>
))
FieldSelect.displayName = 'FieldSelect'
