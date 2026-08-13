import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Accordion built on native <details>/<summary>.
 *
 * The browser supplies correct expand/collapse semantics, keyboard operation
 * and screen-reader announcement for free — no JavaScript, and it still works
 * if hydration fails.
 */
export function Accordion({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-border-subtle border-y border-border-subtle', className)}>{children}</div>
}

export function AccordionItem({
  question,
  children,
  name,
}: {
  question: string
  children: ReactNode
  /** Shared name makes the group exclusive (only one open at a time). */
  name?: string
}) {
  return (
    <details name={name} className="group">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-4 py-5',
          'text-start font-semibold text-glex-green-900 transition-colors hover:text-glex-green-600',
          // Hide the default marker in WebKit.
          '[&::-webkit-details-marker]:hidden'
        )}
      >
        <span>{question}</span>
        <ChevronDown
          className="size-5 shrink-0 text-glex-green-500 transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="pb-5 leading-relaxed text-glex-green-800/80">{children}</div>
    </details>
  )
}
