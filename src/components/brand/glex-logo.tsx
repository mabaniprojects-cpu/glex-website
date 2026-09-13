import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * The official GLEX logo.
 *
 * The artwork is never redrawn or recoloured — each variant is a proportional
 * export of an official source file (see scripts/build-brand-assets.mjs and
 * scripts/build-arabic-logo.mjs). On the green footer the `white` variant uses
 * the official knockout artwork (scripts/build-white-logo.mjs).
 *
 * Arabic has its own lockup — جلكس / بيت التصدير العالمي — and until now it was
 * the one locale not using it: /ar rendered the Latin wordmark. The Arabic
 * files are separate artwork, not a mirrored or restyled copy, so they carry
 * their own dimensions.
 */

const LATIN = {
  nav: { src: '/brand/glex-logo-nav.png', width: 320, height: 137 },
  mobile: { src: '/brand/glex-logo-mobile.png', width: 200, height: 86 },
  footer: { src: '/brand/glex-logo-footer.png', width: 260, height: 112 },
  /** Knockout artwork for the green footer — see scripts/build-white-logo.mjs. */
  white: { src: '/brand/glex-logo-white.png', width: 640, height: 275 },
} as const

const ARABIC = {
  nav: { src: '/brand/glex-logo-ar-nav.png', width: 320, height: 154 },
  mobile: { src: '/brand/glex-logo-ar-mobile.png', width: 200, height: 96 },
  footer: { src: '/brand/glex-logo-ar-footer.png', width: 260, height: 125 },
  white: { src: '/brand/glex-logo-ar-white.png', width: 640, height: 307 },
} as const satisfies Record<keyof typeof LATIN, { src: string; width: number; height: number }>

export type LogoVariant = keyof typeof LATIN

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
  const locale = useLocale()
  // Only Arabic has its own lockup. The other four locales use the Latin one,
  // which is correct — de/fr/zh-CN have no separate wordmark.
  const { src, width, height } = (locale === 'ar' ? ARABIC : LATIN)[variant]

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
