import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { PARTNER_LOGOS } from '@/lib/partners.generated'
import { SectionHeading } from './sections'

/**
 * Supplier network, as a continuously scrolling logo strip, with GLEX's own
 * group companies set apart underneath.
 *
 * The band is pure white, not the page surface or brand green: the logos are
 * flattened onto white, and six of them carry opaque white plates that would
 * show as boxes on anything else (see scripts/build-partner-logos.mjs).
 *
 * The scroll is CSS only — no JavaScript, no carousel library. The list is
 * rendered twice and the track slides by exactly half its width, then repeats,
 * which reads as an endless loop. Spacing is padding on each item rather than a
 * flex gap: with a gap, the two halves differ by half a gap and the loop visibly
 * jumps at the seam.
 *
 * Forced LTR. The logos are images, so direction means nothing to them, while
 * under dir="rtl" a -50% translate slides the track the wrong way and opens a
 * gap. Reduced motion stops the scroll, drops the duplicate copy and wraps the
 * logos into a static centred grid instead.
 */
export async function PartnersSection() {
  const t = await getTranslations('home.partners')

  const network = PARTNER_LOGOS.filter((logo) => logo.group === 'network')
  const group = PARTNER_LOGOS.filter((logo) => logo.group === 'group')

  if (network.length === 0) return null

  return (
    <section className="border-border-subtle border-y bg-white py-14 lg:py-16">
      <div className="container-glex">
        <SectionHeading title={t('heading')} description={t('description')} />
      </div>

      <div className="group relative mt-10 overflow-hidden" dir="ltr">
        {/* Edge fades, so logos enter and leave rather than being cut by the viewport. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-white to-transparent motion-reduce:hidden sm:w-28"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-white to-transparent motion-reduce:hidden sm:w-28"
          aria-hidden="true"
        />

        <ul className="animate-marquee flex w-max items-center group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-8">
          {[...network, ...network].map((logo, index) => {
            const isCopy = index >= network.length
            return (
              <li
                key={`${logo.slug}-${index}`}
                // The second copy exists only to make the loop seamless; screen
                // readers should hear each company once.
                aria-hidden={isCopy ? true : undefined}
                className={
                  isCopy
                    ? 'flex shrink-0 items-center px-7 motion-reduce:hidden sm:px-10'
                    : 'flex shrink-0 items-center px-7 sm:px-10'
                }
              >
                <Image
                  src={logo.src}
                  alt={isCopy ? '' : logo.name}
                  width={logo.width}
                  height={logo.height}
                  // Already optimised lossless at 2x by the build script; the
                  // optimiser's lossy re-encode would smear the fine text.
                  unoptimized
                  loading="lazy"
                />
              </li>
            )
          })}
        </ul>
      </div>

      {group.length > 0 ? (
        <div className="container-glex mt-12">
          <div className="border-border-subtle flex flex-wrap items-center justify-center gap-x-10 gap-y-5 border-t pt-8">
            <p className="text-glex-green-800/70 text-sm font-medium">{t('groupLabel')}</p>
            {group.map((logo) => (
              <Image
                key={logo.slug}
                src={logo.src}
                alt={logo.name}
                width={logo.width}
                height={logo.height}
                unoptimized
                loading="lazy"
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
