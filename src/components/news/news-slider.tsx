'use client'

import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, ImageOff, Pause, Play } from 'lucide-react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'
import { Link } from '@/i18n/navigation'
import { cn, formatDate } from '@/lib/utils'

export type SlideItem = {
  id: string
  slug: string
  title: string
  summary: string
  featuredImage: string | null
  publishedAt: string
  readingMinutes: number
  isSample: boolean
  categoryName: string | null
}

/**
 * Featured-news carousel.
 *
 * Accessibility notes:
 * - The track is a `aria-roledescription="carousel"` region with a live area
 *   announcing the current slide.
 * - Autoplay stops on hover, on focus, and via an explicit pause control
 *   (WCAG 2.2 — Pause, Stop, Hide).
 * - Autoplay never starts when the user prefers reduced motion.
 * - Arrow keys move between slides; every slide's link stays reachable by Tab.
 */
export function NewsSlider({ slides }: { slides: SlideItem[] }) {
  const t = useTranslations('news')
  const common = useTranslations('common')
  const locale = useLocale()

  const prefersReducedMotion = React.useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)')
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false // server: assume motion is fine, then correct on hydration
  )

  /**
   * Created once via a lazy initialiser rather than a ref: the plugin instance
   * must be passed to `useEmblaCarousel` during render, and reading
   * `ref.current` at that point is not allowed.
   */
  const [autoplay] = React.useState(() =>
    Autoplay({ delay: 6000, stopOnInteraction: true, stopOnMouseEnter: true, playOnInit: false })
  )

  const [emblaRef, embla] = useEmblaCarousel(
    { loop: true, align: 'start', direction: locale === 'ar' ? 'rtl' : 'ltr' },
    [autoplay]
  )

  const [selected, setSelected] = React.useState(0)

  /**
   * `playing` is DERIVED, not mirrored.
   *
   * Storing it separately would mean calling setState inside an effect to sync
   * it with the plugin, which causes a cascading re-render. Instead the user's
   * explicit pause is the only state, and the effect below does nothing but
   * push that decision into the carousel — which is what effects are for.
   */
  const [pausedByUser, setPausedByUser] = React.useState(false)
  const playing = !pausedByUser && !prefersReducedMotion

  React.useEffect(() => {
    if (!embla) return
    const onSelect = () => setSelected(embla.selectedScrollSnap())
    onSelect()
    embla.on('select', onSelect)
    return () => {
      embla.off('select', onSelect)
    }
  }, [embla])

  React.useEffect(() => {
    if (!embla) return

    /**
     * Reach the plugin through Embla's registry rather than the instance we
     * constructed. The constructed object exists immediately, but its internal
     * state is only wired up once Embla initialises it — calling `play()`
     * before that throws inside the plugin's own timer setup.
     */
    const plugin = embla.plugins().autoplay
    if (!plugin) return

    /**
     * The Autoplay plugin returns early from its own `init` when there is only
     * one scroll snap — i.e. every slide already fits on screen — and leaves
     * its internal delay table undefined. `play()` is still callable at that
     * point and throws `Cannot read properties of undefined (reading '0')` from
     * inside `setTimer`. So only start it when the carousel can actually move.
     *
     * Whether that holds depends on the viewport: three slides at `basis-1/3`
     * fit exactly on a wide screen and produce a single snap, which is why this
     * only reproduced on large displays.
     *
     * Re-checked on `reInit`, which Embla emits on resize, because the snap
     * count changes with the viewport.
     */
    const sync = () => {
      if (playing && embla.scrollSnapList().length > 1) plugin.play()
      else plugin.stop()
    }

    sync()
    embla.on('reInit', sync)
    return () => {
      embla.off('reInit', sync)
    }
  }, [embla, playing])

  function toggle() {
    setPausedByUser((paused) => !paused)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!embla) return
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      embla.scrollNext()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      embla.scrollPrev()
    }
  }

  if (slides.length === 0) return null

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('sliderLabel')}
      onKeyDown={onKeyDown}
      className="relative"
    >
      <div ref={emblaRef} className="overflow-hidden">
        <ul className="flex touch-pan-y">
          {slides.map((slide, index) => (
            <li
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} ${common('of')} ${slides.length}`}
              className="min-w-0 shrink-0 grow-0 basis-full ps-4 first:ps-0 sm:basis-1/2 lg:basis-1/3"
            >
              <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-white">
                <Link
                  href={`/news/${slide.slug}` as Parameters<typeof Link>[0]['href']}
                  className="relative block aspect-16/9 bg-surface-muted"
                  tabIndex={-1}
                >
                  {slide.featuredImage ? (
                    <Image
                      src={slide.featuredImage}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-glex-green-200">
                      <ImageOff className="size-10" aria-hidden="true" />
                    </span>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {slide.categoryName ? (
                      <span className="font-semibold tracking-wide text-glex-green-500 uppercase">
                        {slide.categoryName}
                      </span>
                    ) : null}
                    {slide.isSample ? (
                      <span className="rounded-full bg-glex-gold-100 px-2 py-0.5 font-semibold text-glex-gold-800">
                        {common('sampleBadge')}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-2 leading-snug font-semibold">
                    <Link
                      href={`/news/${slide.slug}` as Parameters<typeof Link>[0]['href']}
                      className="hover:text-glex-green-600"
                    >
                      {slide.title}
                    </Link>
                  </h3>

                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-glex-green-800/75">
                    {slide.summary}
                  </p>

                  <p className="mt-4 flex flex-wrap items-center gap-x-3 text-xs text-glex-green-800/60">
                    <time dateTime={slide.publishedAt}>
                      {formatDate(slide.publishedAt, locale, { dateStyle: 'medium' })}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span>{t('readingTime', { minutes: slide.readingMinutes })}</span>
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>

      {/* Announces slide changes without moving focus. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {`${selected + 1} ${common('of')} ${slides.length}`}
      </p>

      <div className="mt-6 flex items-center justify-center gap-2">
        <ControlButton onClick={() => embla?.scrollPrev()} label={t('slidePrevious')}>
          <ChevronLeft className="size-5 rtl-flip" aria-hidden="true" />
        </ControlButton>

        <ControlButton onClick={toggle} label={playing ? t('slidePause') : t('slidePlay')}>
          {playing ? (
            <Pause className="size-4" aria-hidden="true" />
          ) : (
            <Play className="size-4" aria-hidden="true" />
          )}
        </ControlButton>

        <ControlButton onClick={() => embla?.scrollNext()} label={t('slideNext')}>
          <ChevronRight className="size-5 rtl-flip" aria-hidden="true" />
        </ControlButton>
      </div>
    </section>
  )
}

function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-lg border border-border-subtle',
        'text-glex-green-800 transition-colors hover:bg-glex-green-50'
      )}
    >
      {children}
    </button>
  )
}
