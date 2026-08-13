import { AlertTriangle, CheckCircle2, Circle, Info, Plane, Ship, Train, Truck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ShipmentMode, ShipmentStatus } from '@prisma/client'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import type { NormalizedTrackingResult } from '@/lib/tracking/types'
import { cn, formatDate } from '@/lib/utils'

const MODE_ICONS: Record<ShipmentMode, LucideIcon> = {
  OCEAN: Ship,
  AIR: Plane,
  ROAD: Truck,
  RAIL: Train,
  MULTIMODAL: Ship,
}

/** Statuses that should read as a problem rather than a milestone. */
const PROBLEM_STATUSES = new Set<ShipmentStatus>(['DELAYED', 'EXCEPTION', 'CANCELLED'])

export async function ShipmentView({
  result,
  locale,
}: {
  result: NormalizedTrackingResult
  locale: string
}) {
  const t = await getTranslations('tracking')
  const common = await getTranslations('common')

  if (!result.found || !result.status || !result.mode) return null

  const ModeIcon = MODE_ICONS[result.mode]
  const isProblem = PROBLEM_STATUSES.has(result.status)
  const progress = Math.min(100, Math.max(0, result.progressPercent ?? 0))

  const details: Array<{ label: string; value: string | null | undefined; ltr?: boolean }> = [
    { label: t('origin'), value: [result.originCity, result.originCountry].filter(Boolean).join(', ') },
    {
      label: t('destination'),
      value: [result.destinationCity, result.destinationCountry].filter(Boolean).join(', '),
    },
    { label: t('originPort'), value: result.originPort },
    { label: t('destinationPort'), value: result.destinationPort },
    { label: t('carrier'), value: result.carrier },
    { label: t('mode'), value: t(`mode_${result.mode}`) },
    { label: t('container'), value: result.containerNumber, ltr: true },
    { label: t('billOfLading'), value: result.billOfLading, ltr: true },
    {
      label: t('etd'),
      value: result.estimatedDeparture ? formatDate(result.estimatedDeparture, locale) : null,
    },
    {
      label: t('atd'),
      value: result.actualDeparture ? formatDate(result.actualDeparture, locale) : null,
    },
    {
      label: t('eta'),
      value: result.estimatedArrival ? formatDate(result.estimatedArrival, locale) : null,
    },
    {
      label: t('ata'),
      value: result.actualArrival ? formatDate(result.actualArrival, locale) : null,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Demonstration data must never be mistaken for a live carrier feed. */}
      {result.isDemo ? (
        <div
          role="note"
          className="flex gap-3 rounded-xl border border-glex-gold-300 bg-glex-gold-50 p-5"
        >
          <Info className="mt-0.5 size-5 shrink-0 text-glex-gold-700" aria-hidden="true" />
          <div>
            <p className="font-semibold text-glex-green-900">{t('demoModeTitle')}</p>
            <p className="mt-1 text-sm leading-relaxed text-glex-green-900/85">
              {t('demoModeBody')}
            </p>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <Card>
        <CardContent className="p-6 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-glex-green-800/60">{t('currentStatus')}</p>
              <p
                className={cn(
                  'mt-1 text-2xl font-bold',
                  isProblem ? 'text-red-700' : 'text-glex-green-700'
                )}
              >
                {t(`status.${result.status}`)}
              </p>
              <p className="mt-2 font-mono text-sm text-glex-green-800/70" dir="ltr">
                {result.reference}
              </p>
            </div>
            <ModeIcon className="size-10 text-glex-green-300 rtl-flip" aria-hidden="true" />
          </div>

          {/* Progress */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-glex-green-800/70">{t('progress')}</span>
              <span className="font-semibold text-glex-green-900">{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('progress')}
              className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-glex-green-100"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  isProblem ? 'bg-red-600' : 'bg-glex-green-600'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="mt-4 text-xs text-glex-green-800/55">
            {t('lastUpdate')}:{' '}
            {result.lastSyncedAt ? formatDate(result.lastSyncedAt, locale) : t('neverSynced')}
          </p>
        </CardContent>
      </Card>

      {/* Exception */}
      {result.exceptionNote ? (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-300 bg-red-50 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <p className="font-semibold text-red-900">{t('exception')}</p>
            <p className="mt-1 text-sm text-red-900/85">{result.exceptionNote}</p>
          </div>
        </div>
      ) : null}

      {/* Details */}
      <Card>
        <CardContent className="p-6 pt-6">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {details
              .filter((detail) => detail.value)
              .map((detail) => (
                <div key={detail.label}>
                  <dt className="text-sm text-glex-green-800/60">{detail.label}</dt>
                  <dd
                    className="mt-0.5 font-medium text-glex-green-900"
                    dir={detail.ltr ? 'ltr' : undefined}
                  >
                    {detail.value}
                  </dd>
                </div>
              ))}
          </dl>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div>
        <h2 className="text-xl font-bold">{t('timeline')}</h2>

        {result.events.length === 0 ? (
          <p className="mt-4 text-glex-green-800/70">{common('noResults')}</p>
        ) : (
          <ol className="mt-6 space-y-0">
            {result.events.map((event, index) => {
              const isLatest = index === 0
              const Icon = event.isException ? AlertTriangle : isLatest ? CheckCircle2 : Circle

              return (
                <li key={`${event.dedupeKey ?? event.title}-${index}`} className="flex gap-4">
                  {/* Rail */}
                  <div className="flex flex-col items-center">
                    <Icon
                      className={cn(
                        'size-5 shrink-0',
                        event.isException
                          ? 'text-red-600'
                          : isLatest
                            ? 'text-glex-green-600'
                            : 'text-glex-green-300'
                      )}
                      aria-hidden="true"
                    />
                    {index < result.events.length - 1 ? (
                      <span className="w-px flex-1 bg-glex-green-200" aria-hidden="true" />
                    ) : null}
                  </div>

                  <div className={cn('pb-8', index === result.events.length - 1 && 'pb-0')}>
                    <p
                      className={cn(
                        'font-semibold',
                        event.isException ? 'text-red-800' : 'text-glex-green-900'
                      )}
                    >
                      {event.title}
                    </p>
                    <p className="mt-0.5 text-sm text-glex-green-800/60">
                      <time dateTime={event.occurredAt.toISOString()}>
                        {formatDate(event.occurredAt, locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </time>
                      {event.location ? ` · ${event.location}` : null}
                    </p>
                    {event.description ? (
                      <p className="mt-1.5 text-sm text-glex-green-800/80">{event.description}</p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
