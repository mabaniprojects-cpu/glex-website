import Image from 'next/image'
import type { ReactNode } from 'react'
import { hasPhoto, type PhotoSlot } from '@/lib/photography'
import { cn } from '@/lib/utils'

/**
 * Full-bleed photographic band with the headline laid over the image.
 *
 * The scrim is a two-stop gradient anchored to the text side rather than a flat
 * overlay: a flat wash at the opacity needed for contrast over a bright sky
 * would grey out the whole photograph, which is the thing we are paying for.
 *
 * When the slot has no photograph the band renders a brief in development and
 * nothing at all in production — see `src/lib/photography.ts`.
 */
export function PhotoSection({
  slot,
  eyebrow,
  title,
  body,
  alt,
  action,
  className,
}: {
  slot: PhotoSlot
  eyebrow?: string
  title: string
  body: string
  /** Locale-specific; empty string marks the image as decorative. */
  alt: string
  action?: ReactNode
  className?: string
}) {
  if (!hasPhoto(slot)) {
    return <PhotoPlaceholder slot={slot} title={title} />
  }

  const toText = slot.textSide === 'start' ? 'lg:bg-linear-to-r' : 'lg:bg-linear-to-l'

  return (
    <section
      className={cn(
        'bg-glex-green-950 relative isolate flex min-h-[26rem] items-center overflow-hidden text-white lg:min-h-[34rem]',
        className
      )}
    >
      <Image
        src={slot.src}
        alt={alt}
        fill
        // Full-bleed at every breakpoint, so the browser should never pick a
        // candidate narrower than the viewport.
        sizes="100vw"
        className="object-cover"
        // Below the fold on every page that uses it; the hero passes its own.
        loading="lazy"
        quality={82}
      />

      {/*
        Readability scrim.

        Alpha is chosen against the worst case — white text over a blown-out
        sky. Compositing happens in sRGB, so the contrast of white on
        green-950 at alpha a over white is: 0.90 -> 13.7:1, 0.75 -> 8.1:1,
        0.65 -> 5.6:1, 0.55 -> 4.0:1. The body copy is 18px, which is not
        "large text", so it needs 4.5:1 and anything at or below 0.55 fails.

        Two treatments, because the text occupies different fractions of the
        width at different sizes:

        - Below lg the copy spans the full column, so a directional gradient
          would run its transparent end straight under the last words. Flat
          80% instead (9.7:1 everywhere).
        - At lg and above the copy sits in one half, so the gradient can hold
          92% through the text and release by 88% across, letting the
          photograph show. The stops are placed so alpha never drops below
          ~0.75 anywhere type can reach.
      */}
      <div
        className={cn(
          'bg-glex-green-950/80 absolute inset-0 lg:bg-transparent',
          'lg:from-glex-green-950/92 lg:via-glex-green-950/75 lg:via-55% lg:to-transparent lg:to-88%',
          toText
        )}
        aria-hidden="true"
      />

      <div className="container-glex relative py-16 lg:py-24">
        <div className={cn('max-w-xl', slot.textSide === 'end' && 'ms-auto')}>
          {eyebrow ? (
            <p className="text-glex-gold-400 text-sm font-semibold tracking-[0.2em] uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-4 text-3xl leading-tight font-bold text-white sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="text-glex-ivory/90 mt-5 text-lg leading-relaxed">{body}</p>
          {action ? <div className="mt-8">{action}</div> : null}
        </div>
      </div>
    </section>
  )
}

/**
 * Development-only stand-in showing what the slot is waiting for.
 *
 * Returns null in production. This is checked at render rather than stripped by
 * the bundler on purpose: the component is server-rendered, so the branch never
 * reaches the client either way, and an explicit check is easier to reason
 * about than trusting dead-code elimination with something that must not ship.
 */
function PhotoPlaceholder({ slot, title }: { slot: PhotoSlot; title: string }) {
  if (process.env.NODE_ENV === 'production') return null

  return (
    <section
      className="border-glex-gold-400/60 bg-glex-green-950 relative flex min-h-[26rem] items-center border-y-2 border-dashed text-white lg:min-h-[34rem]"
      data-photo-placeholder={slot.id}
    >
      {/* Diagonal hatch, so it reads as scaffolding at a glance. */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #fff 0 2px, transparent 2px 14px)',
        }}
        aria-hidden="true"
      />

      <div className="container-glex relative py-16 lg:py-24">
        <div className={cn('max-w-xl', slot.textSide === 'end' && 'ms-auto')}>
          <p className="text-glex-gold-400 text-xs font-semibold tracking-[0.2em] uppercase">
            Photography needed · {slot.id}
          </p>
          <h2 className="mt-4 text-3xl leading-tight font-bold text-white sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="text-glex-ivory/85 mt-5 leading-relaxed">{slot.brief}</p>
          <dl className="text-glex-ivory/70 mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="inline font-semibold">Minimum </dt>
              <dd className="inline tabular-nums">
                {slot.minWidth}×{slot.minHeight}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">Type sits </dt>
              <dd className="inline">
                {slot.textSide === 'start' ? 'left / leading' : 'right / trailing'}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">File </dt>
              <dd className="inline">public/photography/{slot.id}.jpg</dd>
            </div>
          </dl>
          <p className="text-glex-ivory/50 mt-6 text-xs">
            Development only — this band is not rendered in production.
          </p>
        </div>
      </div>
    </section>
  )
}
