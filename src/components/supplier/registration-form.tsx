'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, ChevronLeft, ChevronRight, Info, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldInput,
  FieldLabel,
  FieldSelect,
  FieldTextarea,
} from '@/components/ui/field'
import { FileUpload, type UploadedFile } from '@/components/ui/file-upload'
import { submitSupplierRegistration } from '@/lib/actions/supplier-registration-actions'
import {
  CONTACT_KINDS,
  INCOTERM_CHOICES,
  STEP_FIELDS,
  SUPPLIER_KINDS,
  supplierRegistrationSchema,
  type SupplierRegistrationInput,
} from '@/lib/validation/supplier-registration'
import { cn } from '@/lib/utils'

const STEP_KEYS = [
  'stepAccount',
  'stepCompany',
  'stepCapabilities',
  'stepDocuments',
  'stepContacts',
  'stepDeclaration',
] as const

const DRAFT_KEY = 'glex-supplier-registration-draft'

export function SupplierRegistrationForm({
  categories,
}: {
  categories: Array<{ slug: string; name: string }>
}) {
  const t = useTranslations('supplier')
  const auth = useTranslations('auth')
  const v = useTranslations('validation')
  const common = useTranslations('common')
  const errorsT = useTranslations('errors')
  const contact = useTranslations('contact')
  const marketplace = useTranslations('marketplace')

  const [step, setStep] = React.useState(0)
  const [documents, setDocuments] = React.useState<UploadedFile[]>([])
  const [submitted, setSubmitted] = React.useState(false)
  const [draftSaved, setDraftSaved] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const form = useForm<SupplierRegistrationInput>({
    resolver: zodResolver(supplierRegistrationSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      legalName: '',
      tradingName: '',
      companyType: '',
      kind: 'SUPPLIER',
      country: '',
      city: '',
      address: '',
      website: '',
      crNumber: '',
      vatNumber: '',
      employeeCount: '',
      description: '',
      categorySlugs: [],
      brands: '',
      isManufacturer: true,
      isDistributor: false,
      monthlyCapacity: '',
      minimumOrderNotes: '',
      exportExperience: '',
      marketsServed: '',
      availableIncoterms: [],
      leadTimeNotes: '',
      qualityControlNotes: '',
      documentIds: [],
      contacts: CONTACT_KINDS.map((kind) => ({
        kind,
        name: '',
        email: '',
        phone: '',
        position: '',
      })),
      declaration: true,
      website_hp: '',
    },
  })

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = form

  /**
   * `useWatch` rather than `watch()`: the latter returns a fresh function each
   * render, which the React Compiler cannot memoize safely.
   *
   * Declared here, above the early `submitted` return, so the hook order is
   * identical on every render.
   */
  const selectedCategories = useWatch({ control, name: 'categorySlugs' })
  const selectedIncoterms = useWatch({ control, name: 'availableIncoterms' })

  // Restore a saved draft. Credentials are never persisted — see saveDraft.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY)
      if (raw) reset({ ...getValues(), ...JSON.parse(raw) })
    } catch {
      // A corrupt draft is discarded rather than blocking registration.
    }
  }, [reset, getValues])

  function saveDraft() {
    const values = getValues()
    // Never write a password to browser storage.
    const { password: _password, confirmPassword: _confirm, ...safe } = values
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(safe))
      setDraftSaved(true)
      window.setTimeout(() => setDraftSaved(false), 3000)
    } catch {
      // Storage can be unavailable (private mode, quota) — not fatal.
    }
  }

  async function next() {
    const valid = await trigger(STEP_FIELDS[step] as never)
    if (valid) setStep((current) => Math.min(current + 1, STEP_KEYS.length - 1))
  }

  async function onSubmit(values: SupplierRegistrationInput) {
    /**
     * Refuse a submission raised from any step but the last.
     *
     * "Next" and "Submit application" occupy the same position in the button
     * row. React reuses that DOM node across the re-render, so a click on
     * "Next" at step 5 can be delivered to the freshly-rendered submit button
     * and post the application a step early. This guard makes that impossible
     * regardless of how the click races.
     */
    if (step !== STEP_KEYS.length - 1) return

    setFormError(null)
    const result = await submitSupplierRegistration({
      ...values,
      documentIds: documents.map((file) => file.id),
    })

    if (result.ok) {
      window.localStorage.removeItem(DRAFT_KEY)
      setSubmitted(true)
      return
    }

    setFormError(
      result.error === 'rate_limited'
        ? errorsT('rateLimited')
        : result.error === 'validation'
          ? v('required')
          : common('errorBody')
    )
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="rounded-xl border border-glex-green-200 bg-glex-green-50 p-8 text-center"
      >
        <CheckCircle2 className="mx-auto size-10 text-glex-green-600" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-bold">{t('submittedTitle')}</h2>
        <p className="mt-3 text-glex-green-800/80">{t('submittedBody')}</p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/login">{auth('loginAction')}</Link>
          </Button>
        </div>
      </div>
    )
  }


  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      <div aria-hidden="true" className="hidden">
        <label htmlFor="sup-website-hp">Website</label>
        <input id="sup-website-hp" tabIndex={-1} autoComplete="off" {...register('website_hp')} />
      </div>

      {/* Step indicator */}
      <ol className="flex flex-wrap gap-2" aria-label={t('stepOf', { current: step + 1, total: 6 })}>
        {STEP_KEYS.map((key, index) => {
          const state = index === step ? 'current' : index < step ? 'done' : 'todo'
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => index < step && setStep(index)}
                disabled={index > step}
                aria-current={index === step ? 'step' : undefined}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors',
                  state === 'current' && 'bg-glex-green-600 text-white',
                  state === 'done' && 'bg-glex-green-50 text-glex-green-700 hover:bg-glex-green-100',
                  state === 'todo' && 'border border-border-subtle text-glex-green-800/50'
                )}
              >
                <span dir="ltr">{index + 1}</span>
                <span className="hidden sm:inline">{t(key)}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <p className="text-sm font-medium text-glex-green-800/70">
        {t('stepOf', { current: step + 1, total: 6 })}
      </p>

      {/* --- Step 1: account --- */}
      {step === 0 ? (
        <section aria-label={t('stepAccount')} className="grid gap-5 sm:grid-cols-2">
          <Field error={errors.fullName ? v('required') : undefined}>
            <FieldLabel required>{auth('fullName')}</FieldLabel>
            <FieldInput autoComplete="name" {...register('fullName')} />
          </Field>

          <Field error={errors.email ? v('email') : undefined}>
            <FieldLabel required>{auth('email')}</FieldLabel>
            <FieldInput type="email" autoComplete="email" dir="ltr" {...register('email')} />
          </Field>

          <Field>
            <FieldLabel>{auth('phone')}</FieldLabel>
            <FieldInput type="tel" autoComplete="tel" dir="ltr" {...register('phone')} />
          </Field>

          <div className="hidden sm:block" />

          <Field error={errors.password ? v('passwordWeak') : undefined}>
            <FieldLabel required>{auth('password')}</FieldLabel>
            <FieldInput type="password" autoComplete="new-password" dir="ltr" {...register('password')} />
            <FieldDescription>{auth('passwordHint')}</FieldDescription>
          </Field>

          <Field error={errors.confirmPassword ? v('passwordMismatch') : undefined}>
            <FieldLabel required>{auth('confirmPassword')}</FieldLabel>
            <FieldInput
              type="password"
              autoComplete="new-password"
              dir="ltr"
              {...register('confirmPassword')}
            />
          </Field>
        </section>
      ) : null}

      {/* --- Step 2: company --- */}
      {step === 1 ? (
        <section aria-label={t('stepCompany')} className="grid gap-5 sm:grid-cols-2">
          <Field error={errors.legalName ? v('required') : undefined}>
            <FieldLabel required>{t('legalName')}</FieldLabel>
            <FieldInput autoComplete="organization" {...register('legalName')} />
          </Field>

          <Field>
            <FieldLabel>{t('tradingName')}</FieldLabel>
            <FieldInput {...register('tradingName')} />
          </Field>

          <Field>
            <FieldLabel>{t('companyType')}</FieldLabel>
            <FieldInput {...register('companyType')} />
          </Field>

          <Field>
            <FieldLabel required>{t('supplierOrDistributor')}</FieldLabel>
            <FieldSelect {...register('kind')}>
              {SUPPLIER_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind === 'SUPPLIER'
                    ? t('registerTitle').split(' ')[0]
                    : kind === 'DISTRIBUTOR'
                      ? contact('type.SUPPLIER_REGISTRATION')
                      : common('yes')}
                </option>
              ))}
            </FieldSelect>
          </Field>

          <Field error={errors.country ? v('required') : undefined}>
            <FieldLabel required>{t('country')}</FieldLabel>
            <FieldInput autoComplete="country-name" {...register('country')} />
          </Field>

          <Field>
            <FieldLabel>{t('city')}</FieldLabel>
            <FieldInput autoComplete="address-level2" {...register('city')} />
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel>{t('address')}</FieldLabel>
            <FieldInput autoComplete="street-address" {...register('address')} />
          </Field>

          <Field error={errors.website ? v('url') : undefined}>
            <FieldLabel>{t('website')}</FieldLabel>
            <FieldInput type="url" dir="ltr" placeholder="https://" {...register('website')} />
          </Field>

          <Field>
            <FieldLabel>{t('crNumber')}</FieldLabel>
            <FieldInput dir="ltr" {...register('crNumber')} />
          </Field>

          <Field>
            <FieldLabel>{t('vatNumber')}</FieldLabel>
            <FieldInput dir="ltr" {...register('vatNumber')} />
          </Field>

          <Field>
            <FieldLabel>{t('yearEstablished')}</FieldLabel>
            <FieldInput
              type="number"
              inputMode="numeric"
              dir="ltr"
              {...register('yearEstablished', { valueAsNumber: true })}
            />
          </Field>

          <Field>
            <FieldLabel>{t('employeeCount')}</FieldLabel>
            <FieldInput {...register('employeeCount')} />
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel>{t('companyDescription')}</FieldLabel>
            <FieldTextarea rows={4} {...register('description')} />
          </Field>
        </section>
      ) : null}

      {/* --- Step 3: products and capabilities --- */}
      {step === 2 ? (
        <section aria-label={t('stepCapabilities')} className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-glex-green-900">
              {t('productCategories')}
            </legend>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const checked = selectedCategories.includes(category.slug)
                return (
                  <li key={category.slug} className="flex items-center gap-2.5">
                    <input
                      id={`cat-${category.slug}`}
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setValue(
                          'categorySlugs',
                          event.target.checked
                            ? [...selectedCategories, category.slug]
                            : selectedCategories.filter((slug) => slug !== category.slug),
                          { shouldDirty: true }
                        )
                      }
                      className="size-4 shrink-0 rounded border-border-subtle accent-glex-green-600"
                    />
                    <label htmlFor={`cat-${category.slug}`} className="text-sm">
                      {category.name}
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-glex-green-900">
              {t('manufacturingOrDistribution')}
            </legend>
            <div className="mt-3 flex flex-wrap gap-5">
              <div className="flex items-center gap-2.5">
                <input
                  id="is-manufacturer"
                  type="checkbox"
                  className="size-4 rounded border-border-subtle accent-glex-green-600"
                  {...register('isManufacturer')}
                />
                <label htmlFor="is-manufacturer" className="text-sm">
                  {t('stepCapabilities')}
                </label>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  id="is-distributor"
                  type="checkbox"
                  className="size-4 rounded border-border-subtle accent-glex-green-600"
                  {...register('isDistributor')}
                />
                <label htmlFor="is-distributor" className="text-sm">
                  {contact('type.SUPPLIER_REGISTRATION')}
                </label>
              </div>
            </div>
            {errors.isManufacturer ? (
              <p role="alert" className="mt-2 text-sm font-medium text-red-700">
                {v('selectOne')}
              </p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-glex-green-900">
              {t('availableIncoterms')}
            </legend>
            <ul className="mt-3 flex flex-wrap gap-3">
              {INCOTERM_CHOICES.map((code) => {
                const checked = selectedIncoterms.includes(code)
                return (
                  <li key={code} className="flex items-center gap-2">
                    <input
                      id={`inco-${code}`}
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setValue(
                          'availableIncoterms',
                          event.target.checked
                            ? [...selectedIncoterms, code]
                            : selectedIncoterms.filter((value) => value !== code),
                          { shouldDirty: true }
                        )
                      }
                      className="size-4 rounded border-border-subtle accent-glex-green-600"
                    />
                    <label htmlFor={`inco-${code}`} className="text-sm" dir="ltr">
                      {code}
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t('brands')}</FieldLabel>
              <FieldInput {...register('brands')} />
              <FieldDescription>{marketplace('brand')}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>{t('marketsServed')}</FieldLabel>
              <FieldInput {...register('marketsServed')} />
            </Field>

            <Field>
              <FieldLabel>{t('monthlyCapacity')}</FieldLabel>
              <FieldInput {...register('monthlyCapacity')} />
            </Field>

            <Field>
              <FieldLabel>{t('minimumOrderQuantities')}</FieldLabel>
              <FieldInput {...register('minimumOrderNotes')} />
            </Field>

            <Field>
              <FieldLabel>{t('leadTimes')}</FieldLabel>
              <FieldInput {...register('leadTimeNotes')} />
            </Field>

            <Field>
              <FieldLabel>{t('exportExperience')}</FieldLabel>
              <FieldInput {...register('exportExperience')} />
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel>{t('qualityControl')}</FieldLabel>
              <FieldTextarea rows={3} {...register('qualityControlNotes')} />
            </Field>
          </div>
        </section>
      ) : null}

      {/* --- Step 4: documents --- */}
      {step === 3 ? (
        <section aria-label={t('stepDocuments')}>
          <FileUpload value={documents} onChange={setDocuments} purpose="supplier-documents" />

          <div
            role="note"
            className="mt-6 flex gap-3 rounded-xl border border-glex-gold-300 bg-glex-gold-50 p-5"
          >
            <Info className="mt-0.5 size-5 shrink-0 text-glex-gold-700" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-glex-green-900">{t('noBankingNotice')}</p>
          </div>
        </section>
      ) : null}

      {/* --- Step 5: contacts --- */}
      {step === 4 ? (
        <section aria-label={t('stepContacts')} className="space-y-6">
          {CONTACT_KINDS.map((kind, index) => (
            <fieldset key={kind} className="rounded-xl border border-border-subtle p-5">
              <legend className="px-2 text-sm font-semibold">{kind}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" {...register(`contacts.${index}.kind` as const)} />

                <Field>
                  <FieldLabel>{auth('fullName')}</FieldLabel>
                  <FieldInput {...register(`contacts.${index}.name` as const)} />
                </Field>

                <Field error={errors.contacts?.[index]?.email ? v('email') : undefined}>
                  <FieldLabel>{auth('email')}</FieldLabel>
                  <FieldInput type="email" dir="ltr" {...register(`contacts.${index}.email` as const)} />
                </Field>

                <Field>
                  <FieldLabel>{auth('phone')}</FieldLabel>
                  <FieldInput type="tel" dir="ltr" {...register(`contacts.${index}.phone` as const)} />
                </Field>

                <Field>
                  <FieldLabel>{contact('company')}</FieldLabel>
                  <FieldInput {...register(`contacts.${index}.position` as const)} />
                </Field>
              </div>
            </fieldset>
          ))}
        </section>
      ) : null}

      {/* --- Step 6: declaration --- */}
      {step === 5 ? (
        <section aria-label={t('stepDeclaration')} className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-border-subtle p-5">
            <input
              id="declaration"
              type="checkbox"
              className="mt-1 size-4 shrink-0 rounded border-border-subtle accent-glex-green-600"
              {...register('declaration')}
            />
            <label htmlFor="declaration" className="text-sm leading-relaxed text-glex-green-800/85">
              {t('declarationText')}
              <span className="ms-1 text-red-600" aria-hidden="true">
                *
              </span>
            </label>
          </div>
          {errors.declaration ? (
            <p role="alert" className="text-sm font-medium text-red-700">
              {v('consentRequired')}
            </p>
          ) : null}

          <div
            role="note"
            className="flex gap-3 rounded-xl border border-glex-gold-300 bg-glex-gold-50 p-5"
          >
            <Info className="mt-0.5 size-5 shrink-0 text-glex-gold-700" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-glex-green-900">{t('noBankingNotice')}</p>
          </div>
        </section>
      ) : null}

      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
          {formError}
        </p>
      ) : null}

      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-6">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="size-4 rtl-flip" aria-hidden="true" />
            {common('previous')}
          </Button>
        ) : null}

        {/* Distinct keys force React to replace the DOM node rather than reuse
            it, so an in-flight click cannot transfer from Next to Submit. */}
        {step < STEP_KEYS.length - 1 ? (
          <Button key="next" type="button" variant="primary" onClick={next}>
            {common('next')}
            <ChevronRight className="size-4 rtl-flip" aria-hidden="true" />
          </Button>
        ) : (
          <Button key="submit" type="submit" variant="gold" size="lg" disabled={isSubmitting}>
            <Send className="size-4 rtl-flip" aria-hidden="true" />
            {isSubmitting ? common('loading') : t('submitApplication')}
          </Button>
        )}

        <Button type="button" variant="ghost" onClick={saveDraft} className="ms-auto">
          {common('saveDraft')}
        </Button>
      </div>

      {draftSaved ? (
        <p role="status" className="text-sm font-medium text-glex-green-700">
          {t('savedDraft')}
        </p>
      ) : null}
    </form>
  )
}
