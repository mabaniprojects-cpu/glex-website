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
        <p className="text-sm font-semibold tracking-[0.18em] text-glex-green-500 uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-lg leading-relaxed text-glex-green-800/75">{description}</p>
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
              <span className="inline-flex size-12 items-center justify-center rounded-xl bg-glex-green-600 text-white">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{t(`${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-glex-green-800/75">
                {t(`${key}.body`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
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
              <span className="inline-flex size-11 items-center justify-center rounded-lg bg-glex-gold-100 text-glex-gold-700 transition-colors group-hover:bg-glex-gold-400 group-hover:text-glex-green-900">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">{t(`${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-glex-green-800/75">
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
          <li key={key} className="relative rounded-xl border border-border-subtle bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-glex-green-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <Icon className="size-5 text-glex-green-500" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-semibold">{t(`${key}.title`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-glex-green-800/75">
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
        <div className="flex flex-col rounded-2xl bg-glex-green-900 p-8 text-white lg:p-10">
          <Anchor className="size-8 text-glex-gold-400" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-bold text-white lg:text-3xl">{supplier('heading')}</h2>
          <p className="mt-4 flex-1 leading-relaxed text-glex-ivory/85">{supplier('body')}</p>
          <div className="mt-7">
            <Button asChild variant="gold" size="lg">
              <Link href="/register/supplier">
                {supplier('action')}
                <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-glex-green-200 bg-white p-8 lg:p-10">
          <Boxes className="size-8 text-glex-green-600" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-bold lg:text-3xl">{client('heading')}</h2>
          <p className="mt-4 flex-1 leading-relaxed text-glex-green-800/75">{client('body')}</p>
          <div className="mt-7">
            <Button asChild variant="primary" size="lg">
              <Link href="/register/client">
                {client('action')}
                <ArrowRight className="size-4 rtl-flip" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  )
}
