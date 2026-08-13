import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * The official GLEX logo.
 *
 * The artwork is never redrawn or recoloured — each variant is a proportional
 * export of the same source file (see scripts/build-brand-assets.mjs). On dark
 * surfaces the `onDark` variant places the untouched logo on a warm-ivory
 * plate, because the deep green would otherwise fail contrast.
 */

const SOURCES = {
  nav: { src: '/brand/glex-logo-nav.png', width: 320, height: 137 },
  mobile: { src: '/brand/glex-logo-mobile.png', width: 200, height: 86 },
  footer: { src: '/brand/glex-logo-footer.png', width: 260, height: 112 },
  onDark: { src: '/brand/glex-logo-on-dark.png', width: 640, height: 306 },
} as const

export type LogoVariant = keyof typeof SOURCES

export function GlexLogo({
  variant = 'nav',
  className,
  eager = false,
}: {
  variant?: LogoVariant
  className?: string
  /** Set on the header logo so the LCP element is not lazy-loaded. */
  eager?: boolean
}) {
  const t = useTranslations('common')
  const { src, width, height } = SOURCES[variant]

  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt={t('logoAlt')}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      quality={90}
      className={cn('h-auto w-auto object-contain', className)}
    />
  )
}
