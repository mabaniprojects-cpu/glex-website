import { GlexLogo } from '@/components/brand/glex-logo'
import { cn } from '@/lib/utils'

/**
 * What fills a picture frame when there is no picture.
 *
 * Every frame used to hold a grey panel with a crossed-out-image icon — the
 * symbol browsers and editors use for a photograph that FAILED to load. Sixteen
 * products and two articles simply have none yet, which is not a fault, and on
 * the home page one of these sat directly beside a real photograph and read as
 * a broken card.
 *
 * A quiet branded panel says the same thing without the accusation. It is
 * decorative — the heading beside it already names the item — so it is hidden
 * from assistive technology, which also suppresses the logo's own alt text.
 */
export function MediaPlaceholder({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'from-glex-green-800 to-glex-green-950 flex size-full items-center justify-center bg-linear-to-br p-6',
        className
      )}
    >
      <GlexLogo variant="white" className="max-h-full w-1/2 max-w-40 opacity-80" />
    </span>
  )
}
