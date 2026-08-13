import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { GlexLogo } from '@/components/brand/glex-logo'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/** Centred card layout shared by every authentication page. */
export async function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  wide?: boolean
}) {
  const common = await getTranslations('common')

  return (
    <div className="bg-surface-muted py-14 lg:py-20">
      <div className={cn('container-glex', wide ? 'max-w-3xl' : 'max-w-md')}>
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block" aria-label={common('brand')}>
            <GlexLogo variant="mobile" className="mx-auto h-12 w-auto" />
          </Link>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle ? <p className="mt-2 text-glex-green-800/75">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  )
}
