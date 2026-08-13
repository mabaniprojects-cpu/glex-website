'use client'

import { Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldInput,
  FieldLabel,
  FieldSelect,
  FieldTextarea,
} from '@/components/ui/field'
import { useRouter } from '@/i18n/navigation'
import { deleteProduct, saveProduct } from '@/lib/actions/content-actions'

/** Kept in sync with the `UnitOfMeasure` enum in prisma/schema.prisma. */
const UNITS = [
  'PIECE',
  'BOX',
  'CARTON',
  'PACK',
  'PALLET',
  'KILOGRAM',
  'TON',
  'METER',
  'SQUARE_METER',
  'CUBIC_METER',
  'ROLL',
  'SET',
  'CONTAINER',
] as const

export type ProductDraft = {
  id?: string
  name: string
  categoryId: string
  shortDescription: string
  description: string
  brand: string
  manufacturer: string
  countryOfOrigin: string
  hsCode: string
  packaging: string
  minimumOrderQty: string
  leadTimeDays: string
  isSaudiMade: boolean
  allowEquivalents: boolean
  isVisible: boolean
  isFeatured: boolean
  availableUnits: string[]
  certifications: string
}

export const EMPTY_PRODUCT: ProductDraft = {
  name: '',
  categoryId: '',
  shortDescription: '',
  description: '',
  brand: '',
  manufacturer: '',
  countryOfOrigin: '',
  hsCode: '',
  packaging: '',
  minimumOrderQty: '',
  leadTimeDays: '',
  isSaudiMade: false,
  allowEquivalents: true,
  isVisible: true,
  isFeatured: false,
  availableUnits: [],
  certifications: '',
}

/**
 * Product create/edit form.
 *
 * There is deliberately no price field: the catalogue is quotation-based and
 * the schema has no column for one (spec §7).
 */
export function ProductForm({
  initial,
  categories,
  canDelete,
}: {
  initial: ProductDraft
  categories: Array<{ id: string; name: string }>
  canDelete: boolean
}) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')
  const marketplace = useTranslations('marketplace')
  const units = useTranslations('units')

  const router = useRouter()
  const [draft, setDraft] = React.useState(initial)
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = React.useTransition()

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  function toggleUnit(unit: string, checked: boolean) {
    set(
      'availableUnits',
      checked
        ? [...draft.availableUnits, unit]
        : draft.availableUnits.filter((value) => value !== unit)
    )
  }

  function submit() {
    setMessage(null)

    startTransition(async () => {
      const result = await saveProduct({
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name,
        categoryId: draft.categoryId,
        shortDescription: draft.shortDescription,
        description: draft.description,
        brand: draft.brand,
        manufacturer: draft.manufacturer,
        countryOfOrigin: draft.countryOfOrigin,
        hsCode: draft.hsCode,
        packaging: draft.packaging,
        minimumOrderQty: draft.minimumOrderQty,
        leadTimeDays: draft.leadTimeDays,
        isSaudiMade: draft.isSaudiMade,
        allowEquivalents: draft.allowEquivalents,
        isVisible: draft.isVisible,
        isFeatured: draft.isFeatured,
        availableUnits: draft.availableUnits,
        // One certification per line.
        certifications: draft.certifications
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      })

      if (result.ok) {
        setMessage({ kind: 'ok', text: admin('saved') })
        router.push('/admin/products')
        router.refresh()
      } else {
        setMessage({
          kind: 'error',
          text: result.error === 'validation' ? admin('checkFields') : common('errorBody'),
        })
      }
    })
  }

  function remove() {
    if (!draft.id) return
    setMessage(null)

    startTransition(async () => {
      const result = await deleteProduct({ id: draft.id })
      if (result.ok) {
        router.push('/admin/products')
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: common('errorBody') })
      }
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="mt-6 max-w-3xl space-y-6"
    >
      <div className="space-y-4 rounded-xl border border-border-subtle p-6">
        <Field>
          <FieldLabel required>{admin('productName')}</FieldLabel>
          <FieldInput
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
            maxLength={200}
            required
          />
          <FieldDescription>{admin('slugAuto')}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel required>{marketplace('category')}</FieldLabel>
          <FieldSelect
            value={draft.categoryId}
            onChange={(event) => set('categoryId', event.target.value)}
            required
          >
            <option value="">{admin('selectCategory')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </FieldSelect>
        </Field>

        <Field>
          <FieldLabel>{admin('shortDescription')}</FieldLabel>
          <FieldTextarea
            rows={2}
            value={draft.shortDescription}
            onChange={(event) => set('shortDescription', event.target.value)}
            maxLength={500}
          />
        </Field>

        <Field>
          <FieldLabel>{admin('descriptionField')}</FieldLabel>
          <FieldTextarea
            rows={6}
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
            maxLength={8000}
          />
        </Field>
      </div>

      <div className="grid gap-4 rounded-xl border border-border-subtle p-6 sm:grid-cols-2">
        <Field>
          <FieldLabel>{marketplace('brand')}</FieldLabel>
          <FieldInput
            value={draft.brand}
            onChange={(event) => set('brand', event.target.value)}
            maxLength={120}
          />
        </Field>

        <Field>
          <FieldLabel>{marketplace('manufacturer')}</FieldLabel>
          <FieldInput
            value={draft.manufacturer}
            onChange={(event) => set('manufacturer', event.target.value)}
            maxLength={120}
          />
        </Field>

        <Field>
          <FieldLabel>{marketplace('origin')}</FieldLabel>
          <FieldInput
            value={draft.countryOfOrigin}
            onChange={(event) => set('countryOfOrigin', event.target.value)}
            maxLength={80}
          />
        </Field>

        <Field>
          <FieldLabel>{marketplace('hsCode')}</FieldLabel>
          <FieldInput
            value={draft.hsCode}
            onChange={(event) => set('hsCode', event.target.value)}
            maxLength={20}
            dir="ltr"
          />
        </Field>

        <Field>
          <FieldLabel>{marketplace('moq')}</FieldLabel>
          <FieldInput
            type="number"
            min={1}
            value={draft.minimumOrderQty}
            onChange={(event) => set('minimumOrderQty', event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel>{marketplace('leadTime')}</FieldLabel>
          <FieldInput
            type="number"
            min={1}
            value={draft.leadTimeDays}
            onChange={(event) => set('leadTimeDays', event.target.value)}
          />
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel>{marketplace('packaging')}</FieldLabel>
          <FieldInput
            value={draft.packaging}
            onChange={(event) => set('packaging', event.target.value)}
            maxLength={200}
          />
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel>{marketplace('certifications')}</FieldLabel>
          <FieldTextarea
            rows={3}
            value={draft.certifications}
            onChange={(event) => set('certifications', event.target.value)}
          />
          <FieldDescription>{admin('onePerLine')}</FieldDescription>
        </Field>
      </div>

      <fieldset className="rounded-xl border border-border-subtle p-6">
        <legend className="px-2 text-sm font-semibold">{admin('availableUnits')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {UNITS.map((unit) => (
            <label key={unit} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.availableUnits.includes(unit)}
                onChange={(event) => toggleUnit(unit, event.target.checked)}
                className="size-4 rounded border-border-subtle"
              />
              {units(unit)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3 rounded-xl border border-border-subtle p-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isVisible}
            onChange={(event) => set('isVisible', event.target.checked)}
            className="size-4 rounded border-border-subtle"
          />
          {admin('visibleField')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isFeatured}
            onChange={(event) => set('isFeatured', event.target.checked)}
            className="size-4 rounded border-border-subtle"
          />
          {marketplace('sortFeatured')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isSaudiMade}
            onChange={(event) => set('isSaudiMade', event.target.checked)}
            className="size-4 rounded border-border-subtle"
          />
          {marketplace('saudiMade')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.allowEquivalents}
            onChange={(event) => set('allowEquivalents', event.target.checked)}
            className="size-4 rounded border-border-subtle"
          />
          {marketplace('equivalentsAccepted')}
        </label>
      </div>

      {message ? (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={
            message.kind === 'error'
              ? 'rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800'
              : 'rounded-lg bg-glex-green-50 p-3 text-sm font-medium text-glex-green-800'
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={pending || !draft.name.trim() || !draft.categoryId}
        >
          <Save className="size-4" aria-hidden="true" />
          {pending ? common('loading') : common('save')}
        </Button>

        {draft.id && canDelete ? (
          <Button type="button" variant="danger" onClick={remove} disabled={pending}>
            <Trash2 className="size-4" aria-hidden="true" />
            {common('delete')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
