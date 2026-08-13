'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Send, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldInput,
  FieldLabel,
  FieldSelect,
  FieldTextarea,
} from '@/components/ui/field'
import { submitRfq } from '@/lib/actions/rfq-actions'
import type { HydratedCartLine } from '@/lib/rfq-cart'
import {
  INCOTERM_OPTIONS,
  UNIT_OPTIONS,
  rfqSubmitSchema,
  type RfqSubmitInput,
} from '@/lib/validation/rfq'

/**
 * RFQ builder and submission form.
 *
 * Pre-populated from the cart, but every line remains editable and free-text
 * lines can be added for products not yet in the catalogue.
 */
export function RfqForm({
  cartLines,
  signedIn,
  userName,
}: {
  cartLines: HydratedCartLine[]
  signedIn: boolean
  userName: string | null
}) {
  const t = useTranslations('rfq')
  const v = useTranslations('validation')
  const common = useTranslations('common')
  const units = useTranslations('units')
  const incoterms = useTranslations('incoterms')
  const contact = useTranslations('contact')
  const auth = useTranslations('auth')
  const errorsT = useTranslations('errors')
  const router = useRouter()

  const [formError, setFormError] = React.useState<string | null>(null)

  // Attachments are uploaded before submission and referenced by id. The action
  // re-checks each id against `uploadedById`, so this list is a convenience for
  // the user, never the authority on what may be attached.
  const [attachments, setAttachments] = React.useState<Array<{ id: string; name: string }>>([])
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  async function uploadAttachments(files: File[]) {
    setUploadError(null)
    setUploading(true)

    try {
      for (const file of files.slice(0, 5 - attachments.length)) {
        const body = new FormData()
        body.append('file', file)
        body.append('purpose', 'rfq')

        const response = await fetch('/api/uploads', { method: 'POST', body })
        const payload = (await response.json()) as { id?: string; error?: string }

        if (!response.ok || !payload.id) {
          setUploadError(errorsT('uploadFailed'))
          return
        }

        setAttachments((current) => [...current, { id: payload.id!, name: file.name }])
      }
    } catch {
      setUploadError(errorsT('uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RfqSubmitInput>({
    resolver: zodResolver(rfqSubmitSchema),
    defaultValues: {
      items: cartLines.length
        ? cartLines.map((line) => ({
            productId: line.productId,
            name: line.name,
            quantity: line.quantity,
            unit: line.unit,
            brand: line.brand ?? '',
            specification: '',
          }))
        : [{ name: '', quantity: 1, unit: 'PIECE', brand: '', specification: '' }],
      destinationCountry: '',
      destinationCity: '',
      destinationPort: '',
      requiredDeliveryDate: '',
      preferredBrands: '',
      allowEquivalents: true,
      projectName: '',
      projectDetails: '',
      notes: '',
      guestName: userName ?? '',
      guestEmail: '',
      guestCompany: '',
      guestPhone: '',
      consent: true,
      website: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  async function onSubmit(values: RfqSubmitInput) {
    setFormError(null)
    const result = await submitRfq({
      ...values,
      attachmentIds: attachments.map((file) => file.id),
    })

    if (result.ok) {
      router.push(`/rfq/${result.reference}` as Parameters<typeof router.push>[0])
      return
    }

    // Every failure path must say something. A server-side validation failure
    // that rendered nothing would look like a dead button.
    if (result.error === 'rate_limited') {
      setFormError(errorsT('rateLimited'))
    } else if (result.error === 'validation') {
      setFormError(v('required'))
    } else {
      setFormError(common('errorBody'))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-10">
      <div aria-hidden="true" className="hidden">
        <label htmlFor="rfq-website-hp">Website</label>
        <input id="rfq-website-hp" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      {/* --- Line items --- */}
      <section aria-labelledby="rfq-items-heading">
        <h2 id="rfq-items-heading" className="text-xl font-bold">
          {t('items')}
        </h2>

        <ul className="mt-5 space-y-4">
          {fields.map((field, index) => (
            <li key={field.id} className="rounded-xl border border-border-subtle p-5">
              <div className="grid gap-4 sm:grid-cols-12">
                <Field
                  className="sm:col-span-5"
                  error={errors.items?.[index]?.name ? v('required') : undefined}
                >
                  <FieldLabel required>{t('itemName')}</FieldLabel>
                  <FieldInput {...register(`items.${index}.name` as const)} />
                </Field>

                <Field
                  className="sm:col-span-2"
                  error={errors.items?.[index]?.quantity ? v('positiveNumber') : undefined}
                >
                  <FieldLabel required>{t('quantity')}</FieldLabel>
                  <FieldInput
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    dir="ltr"
                    {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                  />
                </Field>

                <Field className="sm:col-span-2">
                  <FieldLabel required>{t('unit')}</FieldLabel>
                  <FieldSelect {...register(`items.${index}.unit` as const)}>
                    {UNIT_OPTIONS.map((unit) => (
                      <option key={unit} value={unit}>
                        {units(unit)}
                      </option>
                    ))}
                  </FieldSelect>
                </Field>

                <Field className="sm:col-span-2">
                  <FieldLabel>{t('preferredBrands')}</FieldLabel>
                  <FieldInput {...register(`items.${index}.brand` as const)} />
                </Field>

                <div className="flex items-end sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    aria-label={t('removeItem')}
                  >
                    <Trash2 className="size-4 text-red-600" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <Field className="mt-3">
                <FieldLabel>{t('notes')}</FieldLabel>
                <FieldTextarea rows={2} {...register(`items.${index}.specification` as const)} />
              </Field>

              {/* Preserved so catalogue lines stay linked to their product. */}
              <input type="hidden" {...register(`items.${index}.productId` as const)} />
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({ name: '', quantity: 1, unit: 'PIECE', brand: '', specification: '' })
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('addItem')}
          </Button>
        </div>
      </section>

      {/* --- Destination --- */}
      <section aria-labelledby="rfq-destination-heading">
        <h2 id="rfq-destination-heading" className="text-xl font-bold">
          {t('destination')}
        </h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field error={errors.destinationCountry ? v('required') : undefined}>
            <FieldLabel required>{t('destinationCountry')}</FieldLabel>
            <FieldInput autoComplete="country-name" {...register('destinationCountry')} />
          </Field>

          <Field>
            <FieldLabel>{t('destinationCity')}</FieldLabel>
            <FieldInput {...register('destinationCity')} />
          </Field>

          <Field>
            <FieldLabel>{t('destinationPort')}</FieldLabel>
            <FieldInput {...register('destinationPort')} />
          </Field>

          <Field>
            <FieldLabel>{t('incoterm')}</FieldLabel>
            <FieldSelect {...register('incoterm')}>
              <option value="">{common('optional')}</option>
              {INCOTERM_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </FieldSelect>
            <FieldDescription>{incoterms('disclaimer')}</FieldDescription>
          </Field>

          <Field error={errors.requiredDeliveryDate ? v('invalidDate') : undefined}>
            <FieldLabel>{t('deliveryDate')}</FieldLabel>
            <FieldInput type="date" dir="ltr" {...register('requiredDeliveryDate')} />
          </Field>
        </div>
      </section>

      {/* --- Requirements --- */}
      <section aria-labelledby="rfq-requirements-heading">
        <h2 id="rfq-requirements-heading" className="text-xl font-bold">
          {t('title')}
        </h2>

        <div className="mt-5 space-y-5">
          <Field>
            <FieldLabel>{t('preferredBrands')}</FieldLabel>
            <FieldInput {...register('preferredBrands')} />
          </Field>

          <div className="flex items-start gap-3">
            <input
              id="allow-equivalents"
              type="checkbox"
              className="mt-1 size-4 shrink-0 rounded border-border-subtle accent-glex-green-600"
              {...register('allowEquivalents')}
            />
            <label htmlFor="allow-equivalents" className="text-sm text-glex-green-800/85">
              {t('allowEquivalents')}
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t('projectName')}</FieldLabel>
              <FieldInput {...register('projectName')} />
            </Field>
          </div>

          <Field>
            <FieldLabel>{t('projectDetails')}</FieldLabel>
            <FieldTextarea rows={3} {...register('projectDetails')} />
          </Field>

          <Field>
            <FieldLabel>{t('notes')}</FieldLabel>
            <FieldTextarea rows={3} {...register('notes')} />
          </Field>
        </div>
      </section>

      {/* --- Contact details (guests only) --- */}
      {!signedIn ? (
        <section aria-labelledby="rfq-contact-heading">
          <h2 id="rfq-contact-heading" className="text-xl font-bold">
            {contact('title')}
          </h2>
          <p className="mt-2 text-sm text-glex-green-800/70">{t('guestNotice')}</p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field error={errors.guestName ? v('required') : undefined}>
              <FieldLabel required>{auth('fullName')}</FieldLabel>
              <FieldInput autoComplete="name" {...register('guestName')} />
            </Field>

            <Field error={errors.guestEmail ? v('email') : undefined}>
              <FieldLabel required>{auth('email')}</FieldLabel>
              <FieldInput
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                {...register('guestEmail')}
              />
            </Field>

            <Field>
              <FieldLabel>{contact('company')}</FieldLabel>
              <FieldInput autoComplete="organization" {...register('guestCompany')} />
            </Field>

            <Field>
              <FieldLabel>{auth('phone')}</FieldLabel>
              <FieldInput type="tel" inputMode="tel" dir="ltr" {...register('guestPhone')} />
            </Field>
          </div>
        </section>
      ) : null}

      {/* --- Attachments ---
          Signed-in only: `/api/uploads` requires a session, and opening it to
          anonymous callers would make it a free file host. A guest is told
          plainly rather than shown a control that cannot work. */}
      <section aria-labelledby="rfq-attachments-heading" className="border-t border-border-subtle pt-6">
        <h2 id="rfq-attachments-heading" className="text-lg font-semibold">
          {t('attachments')}
        </h2>
        <p className="mt-1 text-sm text-glex-green-800/70">{t('attachmentsHint')}</p>

        {signedIn ? (
          <div className="mt-4">
            <label htmlFor="rfq-attachments" className="sr-only">
              {t('attachments')}
            </label>
            <input
              id="rfq-attachments"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.dwg"
              disabled={uploading || isSubmitting}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                if (files.length > 0) void uploadAttachments(files)
              }}
              className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-glex-green-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />

            {uploading ? (
              <p className="mt-2 text-sm text-glex-green-800/70">{common('loading')}</p>
            ) : null}

            {uploadError ? (
              <p role="alert" className="mt-2 text-sm font-medium text-red-800">
                {uploadError}
              </p>
            ) : null}

            {attachments.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {attachments.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle p-3 text-sm"
                  >
                    <span className="min-w-0 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((entry) => entry.id !== file.id)
                        )
                      }
                      className="shrink-0 text-xs font-medium text-glex-green-700 underline-offset-2 hover:underline"
                    >
                      {common('remove')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-surface-muted p-3 text-sm text-glex-green-800/80">
            {t('attachmentsSignedInOnly')}
          </p>
        )}
      </section>

      {/* --- Consent + submit --- */}
      <div className="space-y-5 border-t border-border-subtle pt-6">
        <div className="flex items-start gap-3">
          <input
            id="rfq-consent"
            type="checkbox"
            className="mt-1 size-4 shrink-0 rounded border-border-subtle accent-glex-green-600"
            {...register('consent')}
          />
          <label htmlFor="rfq-consent" className="text-sm leading-relaxed text-glex-green-800/85">
            {contact('consent')}
            <span className="ms-1 text-red-600" aria-hidden="true">
              *
            </span>
          </label>
        </div>
        {errors.consent ? (
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
          <Send className="size-4 rtl-flip" aria-hidden="true" />
          {isSubmitting ? common('loading') : t('submitAction')}
        </Button>
      </div>
    </form>
  )
}
