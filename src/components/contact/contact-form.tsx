'use client'

import { zodResolver } from '@hookform/resolvers/zod'
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
import { submitContactInquiry } from '@/lib/actions/contact-actions'
import { contactSchema, INQUIRY_TYPES, type ContactInput } from '@/lib/validation/contact'

export function ContactForm() {
  const t = useTranslations('contact')
  const v = useTranslations('validation')
  const common = useTranslations('common')
  const errors = useTranslations('errors')

  const [result, setResult] = React.useState<{ reference: string } | null>(null)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      fullName: '',
      company: '',
      email: '',
      phone: '',
      country: '',
      type: 'GENERAL',
      subject: '',
      message: '',
      consent: true,
      website: '',
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors: fieldErrors, isSubmitting },
  } = form

  async function onSubmit(values: ContactInput) {
    setServerError(null)
    const response = await submitContactInquiry(values)

    if (response.ok) {
      setResult({ reference: response.reference })
      return
    }

    setServerError(
      response.error === 'rate_limited' ? errors('rateLimited') : common('errorBody')
    )
  }

  if (result) {
    return (
      <div
        role="status"
        className="rounded-xl border border-glex-green-200 bg-glex-green-50 p-8 text-center"
      >
        <CheckCircle2 className="mx-auto size-10 text-glex-green-600" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-bold">{t('successTitle')}</h2>
        <p className="mt-3 text-glex-green-800/80">
          {t('successBody', { reference: result.reference })}
        </p>
        <p className="mt-4 font-mono text-sm font-semibold text-glex-green-700" dir="ltr">
          {result.reference}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Honeypot — visually and programmatically hidden from real users. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="website-hp">Website</label>
        <input id="website-hp" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={fieldErrors.fullName ? v('required') : undefined}>
          <FieldLabel required>{t('fullName')}</FieldLabel>
          <FieldInput autoComplete="name" {...register('fullName')} />
        </Field>

        <Field error={fieldErrors.company ? v('max', { max: 160 }) : undefined}>
          <FieldLabel>{t('company')}</FieldLabel>
          <FieldInput autoComplete="organization" {...register('company')} />
        </Field>

        <Field error={fieldErrors.email ? v('email') : undefined}>
          <FieldLabel required>{t('email')}</FieldLabel>
          <FieldInput type="email" inputMode="email" autoComplete="email" dir="ltr" {...register('email')} />
        </Field>

        <Field error={fieldErrors.phone ? v('phone') : undefined}>
          <FieldLabel>{t('phone')}</FieldLabel>
          <FieldInput type="tel" inputMode="tel" autoComplete="tel" dir="ltr" {...register('phone')} />
        </Field>

        <Field>
          <FieldLabel>{t('country')}</FieldLabel>
          <FieldInput autoComplete="country-name" {...register('country')} />
        </Field>

        <Field>
          <FieldLabel required>{t('inquiryType')}</FieldLabel>
          <FieldSelect {...register('type')}>
            {INQUIRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`type.${type}`)}
              </option>
            ))}
          </FieldSelect>
        </Field>
      </div>

      <Field error={fieldErrors.subject ? v('required') : undefined}>
        <FieldLabel required>{t('subject')}</FieldLabel>
        <FieldInput {...register('subject')} />
      </Field>

      <Field error={fieldErrors.message ? v('min', { min: 10 }) : undefined}>
        <FieldLabel required>{t('message')}</FieldLabel>
        <FieldTextarea rows={6} {...register('message')} />
        <FieldDescription>{t('description')}</FieldDescription>
      </Field>

      <div className="flex items-start gap-3">
        <input
          id="contact-consent"
          type="checkbox"
          className="mt-1 size-4 shrink-0 rounded border-border-subtle accent-glex-green-600"
          {...register('consent')}
        />
        <label htmlFor="contact-consent" className="text-sm leading-relaxed text-glex-green-800/85">
          {t('consent')}
          <span className="ms-1 text-red-600" aria-hidden="true">
            *
          </span>
        </label>
      </div>
      {fieldErrors.consent ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {v('consentRequired')}
        </p>
      ) : null}

      {serverError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" variant="gold" size="lg" disabled={isSubmitting}>
        <Send className="size-4 rtl-flip" aria-hidden="true" />
        {isSubmitting ? common('loading') : t('sendAction')}
      </Button>
    </form>
  )
}
