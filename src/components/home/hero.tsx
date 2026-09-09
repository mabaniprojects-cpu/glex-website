import { ArrowRight, Ship } from 'lucide-react'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { hasPhoto, PHOTOGRAPHY } from '@/lib/photography'
import { TrackingQuickSearch } from '@/components/tracking/tracking-quick-search'
import { RouteMap } from '@/components/visuals/route-map'

export async function Hero() {
  const t = await getTranslations('home.hero')
  const common = await getTranslations('common')

  // Only the map fallback needs these; skip the query when a photo is in place.
  const routes = hasPhoto(PHOTOGRAPHY.hero)
    ? []
    : await db.globalRoute
        .findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 12 })
        .catch(() => [])

  return (
    <section className="bg-glex-green-900 relative overflow-hidden text-white">
      {/*
        Photograph when one has been supplied, the animated route map otherwise.
        The map is a genuine fallback, not scaffolding: it renders the live
        GlobalRoute records and stands on its own if the shoot never happens.
      */}
      {hasPhoto(PHOTOGRAPHY.hero) ? (
        <Image
          src={PHOTOGRAPHY.hero.src}
          alt=""
          fill
          sizes="100vw"
          // Above the fold and the page's largest element — this is the LCP.
          priority
          quality={82}
          className="object-cover"
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 opacity-45" aria-hidden="true">
          <RouteMap routes={routes} />
        </div>
      )}

      {/*
        Readability scrim. The two backdrops need different treatments.

        The map is line art we are happy to bury, so it takes a flat vertical
        wash in brand green. A photograph is the opposite: wash it evenly and
        the green cast destroys the thing we put there. It gets the same
        directional scrim as the photographic bands — heavy where the type is,
        releasing across the frame so the image reads — plus a light vertical
        pass so the tracking field at the bottom stays legible.

        Alphas are the measured ones: white on green-950 over a blown-out sky
        is 13.7:1 at 0.90 and 8.1:1 at 0.75. Below lg the copy spans the full
        column, so the directional gradient would put its transparent end under
        the last words; flat 80% there instead.
      */}
      {hasPhoto(PHOTOGRAPHY.hero) ? (
        <>
          <div
            className="bg-glex-green-950/80 lg:from-glex-green-950/92 lg:via-glex-green-950/75 pointer-events-none absolute inset-0 lg:bg-transparent lg:bg-linear-to-r lg:via-55% lg:to-transparent lg:to-90%"
            aria-hidden="true"
          />
          <div
            className="to-glex-green-950/70 pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-transparent"
            aria-hidden="true"
          />
        </>
      ) : (
        <div
          className="from-glex-green-950/85 via-glex-green-900/70 to-glex-green-900/95 pointer-events-none absolute inset-0 bg-linear-to-b"
          aria-hidden="true"
        />
      )}

      <div className="container-glex relative py-20 lg:py-28">
        <div className="max-w-3xl">
          <p className="animate-fade-up text-glex-gold-400 text-sm font-semibold tracking-[0.2em] uppercase">
            {common('tagline')}
          </p>

          <h1 className="animate-fade-up mt-5 text-4xl leading-[1.08] font-bold text-white sm:text-5xl lg:text-6xl">
            {t('headline')}
          </h1>

          <p className="animate-fade-up text-glex-ivory/90 mt-6 max-w-2xl text-lg leading-relaxed">
            {t('description')}
          </p>

          <div className="animate-fade-up mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild variant="gold" size="lg">
              <Link href="/rfq">
                {t('ctaQuote')}
                <ArrowRight className="rtl-flip size-4" aria-hidden="true" />
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
                <Ship className="rtl-flip size-4" aria-hidden="true" />
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
