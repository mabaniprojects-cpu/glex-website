import { ArrowRight, Ship } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { TrackingQuickSearch } from '@/components/tracking/tracking-quick-search'
import { RouteMap } from '@/components/visuals/route-map'

export async function Hero() {
  const t = await getTranslations('home.hero')
  const common = await getTranslations('common')

  const routes = await db.globalRoute
    .findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 12 })
    .catch(() => [])

  return (
    <section className="relative overflow-hidden bg-glex-green-900 text-white">
      {/* Animated route map sits behind the copy and is purely decorative. */}
      <div className="pointer-events-none absolute inset-0 opacity-45" aria-hidden="true">
        <RouteMap routes={routes} />
      </div>

      {/* Readability scrim — keeps text contrast above 4.5:1 over the map. */}
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-glex-green-950/85 via-glex-green-900/70 to-glex-green-900/95"
        aria-hidden="true"
      />

      <div className="container-glex relative py-20 lg:py-28">
        <div className="max-w-3xl">
          <p className="animate-fade-up text-sm font-semibold tracking-[0.2em] text-glex-gold-400 uppercase">
            {common('tagline')}
          </p>

          <h1 className="animate-fade-up mt-5 text-4xl leading-[1.08] font-bold text-white sm:text-5xl lg:text-6xl">
            {t('headline')}
          </h1>

          <p className="animate-fade-up mt-6 max-w-2xl text-lg leading-relaxed text-glex-ivory/90">
            {t('description')}
          </p>

          <div className="animate-fade-up mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild variant="gold" size="lg">
              <Link href="/rfq">
                {t('ctaQuote')}
                <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="inverse" size="lg">
              <Link href="/register/supplier">{t('ctaSupplier')}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 text-white hover:bg-white/10"
            >
              <Link href="/tracking">
                <Ship className="size-4 rtl-flip" aria-hidden="true" />
                {t('ctaTrack')}
              </Link>
            </Button>
          </div>

          <div className="mt-10 max-w-xl">
            <TrackingQuickSearch variant="hero" />
          </div>
        </div>
      </div>
    </section>
  )
}
