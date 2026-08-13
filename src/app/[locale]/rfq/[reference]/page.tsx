import { CheckCircle2, Info, MailCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Section } from '@/components/home/sections'
import { PageHero } from '@/components/layout/page-hero'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getRfqSummary } from '@/lib/actions/rfq-actions'
import { formatDate } from '@/lib/utils'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'rfq' })
  return {
    title: t('submittedTitle'),
    // A reference is semi-private; never index a specific request.
    robots: { index: false, follow: false },
  }
}

export default async function RfqConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>
}) {
  const { locale, reference } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('rfq')
  const nav = await getTranslations('nav')
  const units = await getTranslations('units')

  const rfq = await getRfqSummary(reference)
  if (!rfq) notFound()

  return (
    <>
      <PageHero
        title={t('submittedTitle')}
        locale={locale}
        breadcrumbs={[
          { href: '/', label: nav('home') },
          { href: '/rfq', label: nav('rfq') },
        ]}
      />

      <Section>
        <div className="mx-auto max-w-2xl">
          <div
            role="status"
            className="rounded-xl border border-glex-green-200 bg-glex-green-50 p-8 text-center"
          >
            <CheckCircle2 className="mx-auto size-10 text-glex-green-600" aria-hidden="true" />
            <p className="mt-4 text-lg text-glex-green-800/85">
              {t('submittedBody', { reference: rfq.reference })}
            </p>

            <p className="mt-5 text-sm text-glex-green-800/60">{t('yourReference')}</p>
            <p className="mt-1 font-mono text-xl font-bold text-glex-green-700" dir="ltr">
              {rfq.reference}
            </p>
          </div>

          {/* Guests must confirm their address before GLEX treats it as final. */}
          {!rfq.emailVerified ? (
            <div
              role="note"
              className="mt-6 flex gap-3 rounded-xl border border-glex-gold-300 bg-glex-gold-50 p-5"
            >
              <MailCheck className="mt-0.5 size-5 shrink-0 text-glex-gold-700" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-glex-green-900">
                {t('verifyRequired')}
              </p>
            </div>
          ) : null}

          <dl className="mt-8 grid gap-x-8 gap-y-4 rounded-xl border border-border-subtle p-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-glex-green-800/60">{t('status.SUBMITTED')}</dt>
              <dd className="mt-0.5 font-semibold">{t(`status.${rfq.status}`)}</dd>
            </div>
            <div>
              <dt className="text-sm text-glex-green-800/60">{t('items')}</dt>
              <dd className="mt-0.5 font-semibold">{rfq.itemCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-glex-green-800/60">{t('activity')}</dt>
              <dd className="mt-0.5 font-semibold">
                <time dateTime={rfq.submittedAt.toISOString()}>
                  {formatDate(rfq.submittedAt, locale)}
                </time>
              </dd>
            </div>
            {rfq.destinationCountry ? (
              <div>
                <dt className="text-sm text-glex-green-800/60">{t('destination')}</dt>
                <dd className="mt-0.5 font-semibold">
                  {[rfq.destinationCity, rfq.destinationCountry].filter(Boolean).join(', ')}
                </dd>
              </div>
            ) : null}
          </dl>

          {/* Full line items are shown only to the owner. */}
          {rfq.isOwner && rfq.items.length > 0 ? (
            <div className="mt-8">
              <h2 className="text-lg font-bold">{t('items')}</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">{t('items')}</caption>
                  <thead>
                    <tr className="border-b border-border-subtle text-start">
                      <th scope="col" className="py-2 pe-4 text-start font-medium">
                        {t('items')}
                      </th>
                      <th scope="col" className="py-2 pe-4 text-start font-medium">
                        {t('quantity')}
                      </th>
                      <th scope="col" className="py-2 text-start font-medium">
                        {t('unit')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfq.items.map((item) => (
                      <tr key={item.id} className="border-b border-border-subtle">
                        <td className="py-3 pe-4">{item.name}</td>
                        <td className="py-3 pe-4" dir="ltr">
                          {String(item.quantity)}
                        </td>
                        <td className="py-3">{units(item.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {!rfq.isOwner ? (
            <p className="mt-6 flex items-start gap-2 text-sm text-glex-green-800/60">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t('guestNotice')}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="primary">
              <Link href="/marketplace">{nav('marketplace')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">{nav('contact')}</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}
