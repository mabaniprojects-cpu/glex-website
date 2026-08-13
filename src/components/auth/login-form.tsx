'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldInput, FieldLabel } from '@/components/ui/field'
import { loginSchema, type LoginInput } from '@/lib/validation/auth'

/**
 * Sign-in form.
 *
 * `signIn` is called from the CLIENT with `redirect: false`. Auth.js v5 has an
 * open bug where invoking `signIn` from a Server Action fails on Next 16
 * (nextauthjs/next-auth#13388), so the client path is used deliberately.
 */
export function LoginForm() {
  const t = useTranslations('auth')
  const v = useTranslations('validation')
  const common = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [formError, setFormError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setFormError(null)

    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    })

    if (!result || result.error) {
      // Auth.js returns a single opaque error for bad credentials, unverified
      // accounts and lockouts alike — we must not reveal which applied.
      setFormError(t('invalidCredentials'))
      return
    }

    // `callbackUrl` is validated as a relative path so it cannot be used as an
    // open redirect to an external host.
    const callbackUrl = searchParams.get('callbackUrl')
    const safePath =
      callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
        ? callbackUrl
        : null

    if (safePath) {
      // Already locale-prefixed by the proxy redirect that sent us here.
      window.location.assign(safePath)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
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

      <Field error={errors.password ? v('required') : undefined}>
        <FieldLabel required>{t('password')}</FieldLabel>
        <FieldInput type="password" autoComplete="current-password" dir="ltr" {...register('password')} />
      </Field>

      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
        <LogIn className="size-4 rtl-flip" aria-hidden="true" />
        {isSubmitting ? common('loading') : t('loginAction')}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href="/forgot-password" className="text-glex-green-700 underline-offset-4 hover:underline">
          {t('forgotPassword')}
        </Link>
        <span className="text-glex-green-800/70">
          {t('noAccount')}{' '}
          <Link href="/register" className="font-medium text-glex-green-700 underline-offset-4 hover:underline">
            {t('registerAction')}
          </Link>
        </span>
      </div>
    </form>
  )
}
