'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck, UserPlus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldInput,
  FieldLabel,
  FieldSelect,
} from '@/components/ui/field'
import { localeLabels, locales, type AppLocale } from '@/i18n/routing'
import { registerClient } from '@/lib/actions/auth-actions'
import { CLIENT_TYPES, clientRegisterSchema, type ClientRegisterInput } from '@/lib/validation/auth'

export function ClientRegisterForm() {
  const t = useTranslations('client')
  const auth = useTranslations('auth')
  // Country/city labels are shared with the supplier registration namespace.
  const supplier = useTranslations('supplier')
  const v = useTranslations('validation')
  const common = useTranslations('common')
  const errorsT = useTranslations('errors')
  const activeLocale = useLocale() as AppLocale

  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientRegisterInput>({
    resolver: zodResolver(clientRegisterSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      companyName: '',
      position: '',
      clientType: 'CONTRACTOR',
      industry: '',
      country: '',
      city: '',
      preferredLocale: activeLocale,
      password: '',
      confirmPassword: '',
      acceptTerms: true,
      website: '',
    },
  })

  async function onSubmit(values: ClientRegisterInput) {
    setFormError(null)
    const result = await registerClient(values, activeLocale)

    if (result.ok) {
      setSubmittedEmail(values.email)
      return
    }

    setFormError(result.error === 'rate_limited' ? errorsT('rateLimited') : common('errorBody'))
  }

  if (submittedEmail) {
    return (
      <div
        role="status"
        className="rounded-xl border border-glex-green-200 bg-glex-green-50 p-8 text-center"
      >
        <MailCheck className="mx-auto size-10 text-glex-green-600" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-bold">{auth('verifyTitle')}</h2>
        <p className="mt-3 text-glex-green-800/80">
          {auth('verifySent', { email: submittedEmail })}
        </p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/login">{auth('loginAction')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div aria-hidden="true" className="hidden">
        <label htmlFor="reg-website-hp">Website</label>
        <input id="reg-website-hp" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={errors.fullName ? v('required') : undefined}>
          <FieldLabel required>{auth('fullName')}</FieldLabel>
          <FieldInput autoComplete="name" {...register('fullName')} />
        </Field>

        <Field error={errors.email ? v('email') : undefined}>
          <FieldLabel required>{auth('email')}</FieldLabel>
          <FieldInput type="email" inputMode="email" autoComplete="email" dir="ltr" {...register('email')} />
        </Field>

        <Field error={errors.phone ? v('phone') : undefined}>
          <FieldLabel>{auth('phone')}</FieldLabel>
          <FieldInput type="tel" inputMode="tel" autoComplete="tel" dir="ltr" {...register('phone')} />
        </Field>

        <Field error={errors.companyName ? v('required') : undefined}>
          <FieldLabel required>{t('companyName')}</FieldLabel>
          <FieldInput autoComplete="organization" {...register('companyName')} />
        </Field>

        <Field>
          <FieldLabel>{t('position')}</FieldLabel>
          <FieldInput autoComplete="organization-title" {...register('position')} />
        </Field>

        <Field>
          <FieldLabel required>{t('clientType')}</FieldLabel>
          <FieldSelect {...register('clientType')}>
            {CLIENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`type.${type}`)}
              </option>
            ))}
          </FieldSelect>
        </Field>

        <Field>
          <FieldLabel>{t('industry')}</FieldLabel>
          <FieldInput {...register('industry')} />
        </Field>

        <Field error={errors.country ? v('required') : undefined}>
          <FieldLabel required>{supplier('country')}</FieldLabel>
          <FieldInput autoComplete="country-name" {...register('country')} />
        </Field>

        <Field>
          <FieldLabel>{supplier('city')}</FieldLabel>
          <FieldInput autoComplete="address-level2" {...register('city')} />
        </Field>

        <Field>
          <FieldLabel required>{t('preferredLanguage')}</FieldLabel>
          <FieldSelect {...register('preferredLocale')}>
            {locales.map((locale) => (
              <option key={locale} value={locale}>
                {localeLabels[locale]}
              </option>
            ))}
          </FieldSelect>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={errors.password ? v('passwordWeak') : undefined}>
          <FieldLabel required>{auth('password')}</FieldLabel>
          <FieldInput type="password" autoComplete="new-password" dir="ltr" {...register('password')} />
          <FieldDescription>{auth('passwordHint')}</FieldDescription>
        </Field>

        <Field error={errors.confirmPassword ? v('passwordMismatch') : undefined}>
          <FieldLabel required>{auth('confirmPassword')}</FieldLabel>
          <FieldInput type="password" autoComplete="new-password" dir="ltr" {...register('confirmPassword')} />
        </Field>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="accept-terms"
          type="checkbox"
          className="mt-1 size-4 shrink-0 rounded border-border-subtle accent-glex-green-600"
          {...register('acceptTerms')}
        />
        <label htmlFor="accept-terms" className="text-sm leading-relaxed text-glex-green-800/85">
          {t('acceptTerms')}
          <span className="ms-1 text-red-600" aria-hidden="true">
            *
          </span>
        </label>
      </div>
      {errors.acceptTerms ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {v('consentRequired')}
        </p>
      ) : null}

      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="gold" size="lg" disabled={isSubmitting}>
        <UserPlus className="size-4" aria-hidden="true" />
        {isSubmitting ? common('loading') : auth('registerAction')}
      </Button>

      <p className="text-sm text-glex-green-800/70">
        {auth('haveAccount')}{' '}
        <Link href="/login" className="font-medium text-glex-green-700 underline-offset-4 hover:underline">
          {auth('loginAction')}
        </Link>
      </p>
    </form>
  )
}
