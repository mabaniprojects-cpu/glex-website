'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, KeyRound, MailCheck } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldInput, FieldLabel } from '@/components/ui/field'
import {
  acceptStaffInvitation,
  requestPasswordReset,
  resetPassword,
} from '@/lib/actions/auth-actions'
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from '@/lib/validation/auth'

/** Step 1 — request a reset link. */
export function ForgotPasswordForm() {
  const t = useTranslations('auth')
  const v = useTranslations('validation')
  const common = useTranslations('common')
  const errorsT = useTranslations('errors')
  const locale = useLocale()

  const [sent, setSent] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '', website: '' },
  })

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null)
    const result = await requestPasswordReset(values, locale)
    if (result.ok) {
      setSent(true)
      return
    }
    setFormError(result.error === 'rate_limited' ? errorsT('rateLimited') : common('errorBody'))
  }

  if (sent) {
    return (
      <div
        role="status"
        className="border-glex-green-200 bg-glex-green-50 rounded-xl border p-8 text-center"
      >
        <MailCheck className="text-glex-green-600 mx-auto size-10" aria-hidden="true" />
        {/* Deliberately does not confirm whether an account exists. */}
        <p className="text-glex-green-800/85 mt-4">{t('resetSent')}</p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/login">{t('loginAction')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div aria-hidden="true" className="hidden">
        <label htmlFor="fp-website-hp">Website</label>
        <input id="fp-website-hp" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      <Field error={errors.email ? v('email') : undefined}>
        <FieldLabel required>{t('email')}</FieldLabel>
        <FieldInput
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          dir="ltr"
          {...register('email')}
        />
      </Field>

      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? common('loading') : t('resetAction')}
      </Button>

      <p className="text-center text-sm">
        <Link href="/login" className="text-glex-green-700 underline-offset-4 hover:underline">
          {t('loginAction')}
        </Link>
      </p>
    </form>
  )
}

/** Step 2 — choose a new password with a valid token. */
/**
 * Step 2 — choose a password.
 *
 * Shared by the reset link and the staff invitation link. They differ only in
 * which action consumes the token: the two token purposes are separate on
 * purpose, so neither link can do the other's job.
 */
export function ResetPasswordForm({
  token,
  mode = 'reset',
}: {
  token: string
  mode?: 'reset' | 'invite'
}) {
  const t = useTranslations('auth')
  const v = useTranslations('validation')
  const common = useTranslations('common')

  const [done, setDone] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  })

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null)
    const result =
      mode === 'invite' ? await acceptStaffInvitation(values) : await resetPassword(values)

    if (result.ok) {
      setDone(true)
      return
    }

    setFormError(
      result.error === 'expired' || result.error === 'used' || result.error === 'invalid'
        ? t('resetInvalid')
        : common('errorBody')
    )
  }

  if (done) {
    return (
      <div
        role="status"
        className="border-glex-green-200 bg-glex-green-50 rounded-xl border p-8 text-center"
      >
        <CheckCircle2 className="text-glex-green-600 mx-auto size-10" aria-hidden="true" />
        <p className="text-glex-green-900 mt-4 font-medium">
          {mode === 'invite' ? t('inviteSuccess') : t('resetSuccess')}
        </p>
        <div className="mt-6">
          <Button asChild variant="primary">
            <Link href="/login">{t('loginAction')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <input type="hidden" {...register('token')} />

      <Field error={errors.password ? v('passwordWeak') : undefined}>
        <FieldLabel required>{t('newPassword')}</FieldLabel>
        <FieldInput
          type="password"
          autoComplete="new-password"
          autoFocus
          dir="ltr"
          {...register('password')}
        />
        <FieldDescription>{t('passwordHint')}</FieldDescription>
      </Field>

      <Field error={errors.confirmPassword ? v('passwordMismatch') : undefined}>
        <FieldLabel required>{t('confirmPassword')}</FieldLabel>
        <FieldInput
          type="password"
          autoComplete="new-password"
          dir="ltr"
          {...register('confirmPassword')}
        />
      </Field>

      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
        <KeyRound className="size-4" aria-hidden="true" />
        {isSubmitting
          ? common('loading')
          : mode === 'invite'
            ? t('inviteAction')
            : t('resetAction')}
      </Button>
    </form>
  )
}
