import {
  Anchor,
  ArrowRight,
  Boxes,
  ClipboardCheck,
  FileCheck2,
  Globe2,
  Handshake,
  Layers,
  MapPin,
  PackageSearch,
  Route,
  Ship,
  ShieldCheck,
  Truck,
  Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PhotoSection } from '@/components/visuals/photo-section'
import { PHOTOGRAPHY } from '@/lib/photography'
import { cn } from '@/lib/utils'

/** Shared section heading block. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow?: string
  title: string
  description?: string
  align?: 'center' | 'start'
}) {
  return (
    <div className={cn('max-w-3xl', align === 'center' ? 'mx-auto text-center' : 'text-start')}>
      {eyebrow ? (
        <p className="text-glex-green-500 text-sm font-semibold tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
      {description ? (
        <p className="text-glex-green-800/75 mt-4 text-lg leading-relaxed">{description}</p>
      ) : null}
    </div>
  )
}

export function Section({
  children,
  className,
  muted = false,
}: {
  children: ReactNode
  className?: string
  muted?: boolean
}) {
  return (
    <section className={cn('py-16 lg:py-24', muted && 'bg-surface-muted', className)}>
      <div className="container-glex">{children}</div>
    </section>
  )
}

// --- Company values ---------------------------------------------------------

// `as const` keeps the keys as string literals so `t()` can verify them
// against the message catalogue at compile time.
const VALUE_ITEMS = [
  { key: 'saudiAccess', icon: PackageSearch },
  { key: 'globalReach', icon: Globe2 },
  { key: 'reliableLogistics', icon: Ship },
  { key: 'endToEnd', icon: Route },
] as const satisfies ReadonlyArray<{ key: string; icon: LucideIcon }>

export async function ValuesSection() {
  const t = await getTranslations('home.values')

  return (
    <Section>
      <SectionHeading title={t('heading')} description={t('description')} />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {VALUE_ITEMS.map(({ key, icon: Icon }) => (
          <Card key={key} className="border-glex-green-100 bg-glex-green-50/40">
            <CardContent className="p-6 pt-6">
              <span className="bg-glex-green-600 inline-flex size-12 items-center justify-center rounded-xl text-white">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{t(`${key}.title`)}</h3>
              <p className="text-glex-green-800/75 mt-2 text-sm leading-relaxed">
                {t(`${key}.body`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  )
}

// --- Photographic bands -----------------------------------------------------

/**
 * Full-bleed image bands breaking up the run of cards.
 *
 * Both render nothing until a photograph is supplied — see
 * `src/lib/photography.ts`. The page is designed to read correctly with them
 * absent, so shipping before the shoot is safe.
 */
export async function NetworkPhotoSection() {
  const t = await getTranslations('home.photoNetwork')
  const common = await getTranslations('common')

  return (
    <PhotoSection
      slot={PHOTOGRAPHY.network}
      eyebrow={t('eyebrow')}
      title={t('title')}
      body={t('body')}
      alt={t('alt')}
      action={
        <Button asChild variant="gold" size="lg">
          <Link href="/network">
            {common('learnMore')}
            <ArrowRight className="rtl-flip size-4" aria-hidden="true" />
          </Link>
        </Button>
      }
    />
  )
}

export async function HandlingPhotoSection() {
  const t = await getTranslations('home.photoHandling')

  return (
    <PhotoSection
      slot={PHOTOGRAPHY.handling}
      eyebrow={t('eyebrow')}
      title={t('title')}
      body={t('body')}
      alt={t('alt')}
    />
  )
}

// --- Services ---------------------------------------------------------------

const SERVICE_ITEMS = [
  { key: 'sourcing', icon: PackageSearch },
  { key: 'supplierCoordination', icon: Handshake },
  { key: 'freight', icon: Ship },
  { key: 'documentation', icon: FileCheck2 },
  { key: 'customs', icon: ShieldCheck },
  { key: 'warehousing', icon: Warehouse },
  { key: 'tracking', icon: MapPin },
  { key: 'procurement', icon: Layers },
] as const satisfies ReadonlyArray<{ key: string; icon: LucideIcon }>

export async function ServicesSection() {
  const t = await getTranslations('home.services')

  return (
    <Section muted>
      <SectionHeading title={t('heading')} description={t('description')} />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICE_ITEMS.map(({ key, icon: Icon }) => (
          <Card key={key} className="group hover:shadow-md">
            <CardContent className="p-6 pt-6">
              <span className="bg-glex-gold-100 text-glex-gold-700 group-hover:bg-glex-gold-400 group-hover:text-glex-green-900 inline-flex size-11 items-center justify-center rounded-lg transition-colors">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">{t(`${key}.title`)}</h3>
              <p className="text-glex-green-800/75 mt-2 text-sm leading-relaxed">
                {t(`${key}.body`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  )
}

// --- How it works -----------------------------------------------------------

// Steps are listed explicitly rather than derived from an index so the message
// keys stay literal and type-checked.
const STEPS = [
  { key: 'step1', icon: Boxes },
  { key: 'step2', icon: ClipboardCheck },
  { key: 'step3', icon: FileCheck2 },
  { key: 'step4', icon: Handshake },
  { key: 'step5', icon: Ship },
  { key: 'step6', icon: Truck },
] as const satisfies ReadonlyArray<{ key: string; icon: LucideIcon }>

export async function HowItWorksSection() {
  const t = await getTranslations('home.howItWorks')

  return (
    <Section>
      <SectionHeading title={t('heading')} description={t('description')} />
      <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map(({ key, icon: Icon }, index) => (
          <li key={key} className="border-border-subtle relative rounded-xl border bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="bg-glex-green-600 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white">
                {index + 1}
              </span>
              <Icon className="text-glex-green-500 size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-semibold">{t(`${key}.title`)}</h3>
            <p className="text-glex-green-800/75 mt-2 text-sm leading-relaxed">
              {t(`${key}.body`)}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

// --- Supplier / client calls to action --------------------------------------

export async function CtaSections() {
  const supplier = await getTranslations('home.supplierCta')
  const client = await getTranslations('home.clientCta')

  return (
    <Section muted>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-glex-green-900 flex flex-col rounded-2xl p-8 text-white lg:p-10">
          <Anchor className="text-glex-gold-400 size-8" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-bold text-white lg:text-3xl">{supplier('heading')}</h2>
          <p className="text-glex-ivory/85 mt-4 flex-1 leading-relaxed">{supplier('body')}</p>
          <div className="mt-7">
            <Button asChild variant="gold" size="lg">
              <Link href="/register/supplier">
                {supplier('action')}
                <ArrowRight className="rtl-flip size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="border-glex-green-200 flex flex-col rounded-2xl border bg-white p-8 lg:p-10">
          <Boxes className="text-glex-green-600 size-8" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-bold lg:text-3xl">{client('heading')}</h2>
          <p className="text-glex-green-800/75 mt-4 flex-1 leading-relaxed">{client('body')}</p>
          <div className="mt-7">
            <Button asChild variant="primary" size="lg">
              <Link href="/register/client">
                {client('action')}
                <ArrowRight className="rtl-flip size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  )
}
