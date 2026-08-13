import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Brand button. `gold` is reserved for the single most important action on a
 * view (Section 2: gold is a premium accent, not a general-purpose colour).
 * Every variant meets WCAG AA contrast against its own background.
 */
const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold',
    'transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50',
    // Icons inside buttons must flip with the writing direction.
    '[&_svg]:size-4 [&_svg]:shrink-0 rtl:[&_svg.rtl-flip]:-scale-x-100'
  ),
  {
    variants: {
      variant: {
        primary: 'bg-glex-green-600 text-white hover:bg-glex-green-700 active:bg-glex-green-800',
        gold: 'bg-glex-gold-400 text-glex-green-900 hover:bg-glex-gold-300 active:bg-glex-gold-500',
        outline:
          'border border-glex-green-600 text-glex-green-700 bg-transparent hover:bg-glex-green-50',
        subtle: 'bg-glex-green-50 text-glex-green-700 hover:bg-glex-green-100',
        ghost: 'text-glex-green-700 hover:bg-glex-green-50',
        inverse:
          'bg-white text-glex-green-800 hover:bg-glex-ivory-soft active:bg-glex-ivory',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        link: 'text-glex-green-700 underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-13 px-7 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        // A <button> inside a form defaults to type="submit"; being explicit
        // prevents accidental submissions from decorative buttons.
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { buttonVariants }
