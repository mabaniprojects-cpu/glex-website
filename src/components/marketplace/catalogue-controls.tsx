'use client'

import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import * as React from 'react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type FilterOptions = {
  categories: Array<{ slug: string; name: string; count: number }>
  brands: string[]
  origins: string[]
}

/**
 * Search, sort and filter controls.
 *
 * All state lives in the URL, so results are shareable, the back button works,
 * and the server does the filtering. On small screens the filters collapse into
 * a focus-trapped drawer.
 */
export function CatalogueControls({ options }: { options: FilterOptions }) {
  const t = useTranslations('marketplace')
  const common = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [query, setQuery] = React.useState(searchParams.get('q') ?? '')
  const [pending, startTransition] = React.useTransition()

  /** Rewrites the query string, always resetting to page 1. */
  const apply = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      params.delete('page')

      startTransition(() => {
        const search = params.toString()
        router.push(`${pathname}${search ? `?${search}` : ''}` as Parameters<typeof router.push>[0])
      })
    },
    [pathname, router, searchParams]
  )

  function setParam(key: string, value: string | null) {
    apply((params) => {
      if (value === null || value === '') params.delete(key)
      else params.set(key, value)
    })
  }

  function onSearch(event: React.FormEvent) {
    event.preventDefault()
    setParam('q', query.trim() || null)
  }

  const activeCount = ['category', 'brand', 'origin', 'saudiMade', 'featured'].filter((key) =>
    searchParams.get(key)
  ).length

  const filters = (
    <div className="space-y-7">
      <FilterGroup label={t('category')}>
        <SelectControl
          label={t('category')}
          value={searchParams.get('category') ?? ''}
          onChange={(value) => setParam('category', value || null)}
          options={[
            { value: '', label: t('allCategories') },
            ...options.categories.map((category) => ({
              value: category.slug,
              label: `${category.name} (${category.count})`,
            })),
          ]}
        />
      </FilterGroup>

      {options.brands.length > 0 ? (
        <FilterGroup label={t('brand')}>
          <SelectControl
            label={t('brand')}
            value={searchParams.get('brand') ?? ''}
            onChange={(value) => setParam('brand', value || null)}
            options={[
              { value: '', label: t('allCategories') },
              ...options.brands.map((brand) => ({ value: brand, label: brand })),
            ]}
          />
        </FilterGroup>
      ) : null}

      {options.origins.length > 0 ? (
        <FilterGroup label={t('origin')}>
          <SelectControl
            label={t('origin')}
            value={searchParams.get('origin') ?? ''}
            onChange={(value) => setParam('origin', value || null)}
            options={[
              { value: '', label: t('allCategories') },
              ...options.origins.map((origin) => ({ value: origin, label: origin })),
            ]}
          />
        </FilterGroup>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold text-glex-green-900">
          {t('filters')}
        </legend>

        <CheckboxControl
          label={t('saudiMade')}
          checked={searchParams.get('saudiMade') === 'true'}
          onChange={(checked) => setParam('saudiMade', checked ? 'true' : null)}
        />
        <CheckboxControl
          label={t('sortFeatured')}
          checked={searchParams.get('featured') === 'true'}
          onChange={(checked) => setParam('featured', checked ? 'true' : null)}
        />
      </fieldset>

      {activeCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            apply((params) => {
              for (const key of ['category', 'brand', 'origin', 'saudiMade', 'featured']) {
                params.delete(key)
              }
            })
          }
        >
          <X className="size-4" aria-hidden="true" />
          {t('clearFilters')}
        </Button>
      ) : null}
    </div>
  )

  return (
    <>
      {/* Search + sort */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <form onSubmit={onSearch} className="flex-1">
          <label htmlFor="catalogue-search" className="mb-1.5 block text-sm font-medium">
            {common('search')}
          </label>
          <div className="flex gap-2">
            <input
              id="catalogue-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={common('searchPlaceholder')}
              className="h-11 w-full rounded-lg border border-border-subtle bg-white px-3 text-sm placeholder:text-glex-green-900/40 focus:border-glex-green-600"
            />
            <Button type="submit" variant="primary" disabled={pending}>
              <Search className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{common('search')}</span>
            </Button>
          </div>
        </form>

        <div className="lg:w-56">
          <SelectControl
            label={t('sortBy')}
            value={searchParams.get('sort') ?? 'featured'}
            onChange={(value) => setParam('sort', value)}
            options={[
              { value: 'featured', label: t('sortFeatured') },
              { value: 'newest', label: t('sortNewest') },
              { value: 'nameAsc', label: t('sortNameAsc') },
            ]}
          />
        </div>

        {/* Mobile filter trigger */}
        <Button
          type="button"
          variant="outline"
          className="lg:hidden"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {t('filters')}
          {activeCount > 0 ? (
            <span className="ms-1 rounded-full bg-glex-green-600 px-1.5 text-xs text-white">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </div>

      {/* Desktop filters */}
      <aside className="mt-8 hidden lg:block" aria-label={t('filters')}>
        {filters}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <FilterDrawer title={t('filters')} onClose={() => setDrawerOpen(false)}>
          {filters}
          <div className="mt-8">
            <Button type="button" variant="primary" className="w-full" onClick={() => setDrawerOpen(false)}>
              {t('applyFilters')}
            </Button>
          </div>
        </FilterDrawer>
      ) : null}
    </>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-glex-green-900">{label}</p>
      {children}
    </div>
  )
}

function SelectControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  const id = React.useId()
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-border-subtle bg-white px-3 pe-8 text-sm focus:border-glex-green-600"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  )
}

function CheckboxControl({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-border-subtle accent-glex-green-600"
      />
      <label htmlFor={id} className="text-sm text-glex-green-900">
        {label}
      </label>
    </div>
  )
}

/** Focus-trapped drawer, opening from the inline-end edge so it mirrors in RTL. */
function FilterDrawer({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables?.length) return

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-100 lg:hidden">
      <div className="absolute inset-0 bg-glex-green-950/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 end-0 w-[min(22rem,90vw)] overflow-y-auto',
          'bg-white p-6 shadow-2xl outline-none'
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-11 items-center justify-center rounded-lg text-glex-green-800 hover:bg-glex-green-50"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
