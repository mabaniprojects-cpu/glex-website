'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Incoterm, ShipmentMode } from '@prisma/client'
import { CheckCircle2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldInput,
  FieldLabel,
  FieldSelect,
  FieldTextarea,
} from '@/components/ui/field'
import { submitFreightInquiry } from '@/lib/actions/freight-actions'
import { freightInquirySchema, type FreightInquiryInput } from '@/lib/validation/freight'

/**
 * Freight quote request.
 *
 * Mirrors the contact form's structure deliberately — same resolver, same
 * honeypot, same success panel — so the two behave identically where they
 * overlap and only the freight-specific fields differ.
 */
export function FreightForm() {
  const t = useTranslations('freight')
  const contact = useTranslations('contact')
  const rfq = useTranslations('rfq')
  const v = useTranslations('validation')
  const common = useTranslations('common')
  const errors = useTranslations('errors')

  const [result, setResult] = React.useState<{ reference: string } | null>(null)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const form = useForm<FreightInquiryInput>({
    resolver: zodResolver(freightInquirySchema),
    defaultValues: {
      fullName: '',
      company: '',
      email: '',
      phone: '',
      country: '',
      mode: ShipmentMode.OCEAN,
      incoterm: '',
      originCountry: 'Saudi Arabia',
      originCity: '',
      originPort: '',
      destinationCountry: '',
      destinationCity: '',
      destinationPort: '',
      cargoDescription: '',
      weightKg: '',
      volumeCbm: '',
      containerType: '',
      // Dangerous goods are declared, never assumed.
      isHazardous: false,
      readyDate: '',
      consent: true,
      website: '',
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors: fieldErrors, isSubmitting },
  } = form

  async function onSubmit(values: FreightInquiryInput) {
    setServerError(null)
    const response = await submitFreightInquiry(values)

    if (response.ok) {
      setResult({ reference: response.reference })
      return
    }

    setServerError(response.error === 'rate_limited' ? errors('rateLimited') : common('errorBody'))
  }

  if (result) {
    return (
      <div
        role="status"
        className="rounded-xl border border-glex-green-200 bg-glex-green-50 p-8 text-center"
      >
        <CheckCircle2 className="mx-auto size-10 text-glex-green-600" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-bold">{t('submittedTitle')}</h2>
        <p className="mt-3 text-glex-green-800/80">{t('submittedBody')}</p>
        <p className="mt-4 font-mono text-sm font-semibold text-glex-green-700" dir="ltr">
          {result.reference}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      {/* Honeypot — visually and programmatically hidden from real users. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="freight-website-hp">Website</label>
        <input id="freight-website-hp" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      {/* --- Who is asking --- */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={fieldErrors.fullName ? v('required') : undefined}>
          <FieldLabel required>{contact('fullName')}</FieldLabel>
          <FieldInput {...register('fullName')} maxLength={120} />
        </Field>

        <Field>
          <FieldLabel>{contact('company')}</FieldLabel>
          <FieldInput {...register('company')} maxLength={160} />
        </Field>

        <Field error={fieldErrors.email ? v('email') : undefined}>
          <FieldLabel required>{contact('email')}</FieldLabel>
          <FieldInput type="email" dir="ltr" {...register('email')} maxLength={200} />
        </Field>

        <Field>
          <FieldLabel>{contact('phone')}</FieldLabel>
          <FieldInput type="tel" dir="ltr" {...register('phone')} maxLength={40} />
        </Field>
      </div>

      {/* --- The shipment --- */}
      <section aria-labelledby="freight-shipment-heading" className="space-y-5">
        <h2 id="freight-shipment-heading" className="text-lg font-semibold">
          {t('shipmentHeading')}
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel required>{t('mode')}</FieldLabel>
            <FieldSelect {...register('mode')}>
              {Object.values(ShipmentMode).map((mode) => (
                <option key={mode} value={mode}>
                  {mode.toLowerCase()}
                </option>
              ))}
            </FieldSelect>
          </Field>

          <Field>
            <FieldLabel>{t('incoterm')}</FieldLabel>
            <FieldSelect {...register('incoterm')}>
              {/* An empty default, because guessing an Incoterm on someone's
                  behalf changes who pays for what. */}
              <option value="">{t('incotermNone')}</option>
              {Object.values(Incoterm).map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </FieldSelect>
          </Field>

          <Field error={fieldErrors.originCountry ? v('required') : undefined}>
            <FieldLabel required>{t('originCountry')}</FieldLabel>
            <FieldInput {...register('originCountry')} maxLength={100} />
          </Field>

          <Field error={fieldErrors.destinationCountry ? v('required') : undefined}>
            <FieldLabel required>{t('destinationCountry')}</FieldLabel>
            <FieldInput {...register('destinationCountry')} maxLength={100} />
          </Field>

          <Field>
            <FieldLabel>{t('originCity')}</FieldLabel>
            <FieldInput {...register('originCity')} maxLength={100} />
          </Field>

          <Field>
            <FieldLabel>{t('destinationCity')}</FieldLabel>
            <FieldInput {...register('destinationCity')} maxLength={100} />
          </Field>

          <Field>
            <FieldLabel>{t('originPort')}</FieldLabel>
            <FieldInput {...register('originPort')} maxLength={100} />
          </Field>

          <Field>
            <FieldLabel>{t('destinationPort')}</FieldLabel>
            <FieldInput {...register('destinationPort')} maxLength={100} />
          </Field>
        </div>
      </section>

      {/* --- The cargo --- */}
      <section aria-labelledby="freight-cargo-heading" className="space-y-5">
        <h2 id="freight-cargo-heading" className="text-lg font-semibold">
          {t('cargoHeading')}
        </h2>

        <Field error={fieldErrors.cargoDescription ? v('required') : undefined}>
          <FieldLabel required>{t('cargoDescription')}</FieldLabel>
          <FieldTextarea rows={4} {...register('cargoDescription')} maxLength={4000} />
          <FieldDescription>{t('cargoHint')}</FieldDescription>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel>{t('weightKg')}</FieldLabel>
            <FieldInput type="number" step="0.01" min="0" dir="ltr" {...register('weightKg')} />
          </Field>

          <Field>
            <FieldLabel>{t('volumeCbm')}</FieldLabel>
            <FieldInput type="number" step="0.01" min="0" dir="ltr" {...register('volumeCbm')} />
          </Field>

          <Field>
            <FieldLabel>{t('containerType')}</FieldLabel>
            <FieldInput {...register('containerType')} maxLength={100} />
            <FieldDescription>{t('containerHint')}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>{t('readyDate')}</FieldLabel>
            <FieldInput type="date" dir="ltr" {...register('readyDate')} />
          </Field>
        </div>

        {/* Unticked by default, and the hint says what ticking commits the
            sender to — this is a safety declaration, not a preference. */}
        <label className="flex items-start gap-3 rounded-lg border border-border-subtle p-4 text-sm">
          <input
            type="checkbox"
            {...register('isHazardous')}
            className="mt-0.5 size-4 rounded border-border-subtle"
          />
          <span>
            <span className="font-medium">{t('isHazardous')}</span>
            <span className="mt-1 block text-glex-green-800/70">{t('hazardousHint')}</span>
          </span>
        </label>
      </section>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          {...register('consent')}
          className="mt-0.5 size-4 rounded border-border-subtle"
        />
        <span>{contact('consent')}</span>
      </label>

      <p className="text-sm text-glex-green-800/70">{t('noPriceNotice')}</p>

      {serverError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
        <Send className="size-4 rtl-flip" aria-hidden="true" />
        {isSubmitting ? common('loading') : t('submitAction')}
      </Button>

      <p className="text-xs text-glex-green-800/60">{rfq('guestNotice')}</p>
    </form>
  )
}
