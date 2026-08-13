import type { Prisma } from '@prisma/client'
import { pickTranslation, toDbLocale } from '@/i18n/locale'
import type { AppLocale } from '@/i18n/routing'
import { db } from '@/lib/db'

/**
 * Catalogue queries.
 *
 * Filtering, sorting and pagination are all derived from URL search params, so
 * every result set is shareable and survives back-navigation.
 *
 * NOTE: the catalogue is RFQ-based. No price is stored or returned anywhere —
 * see `marketplace.priceOnRequest` in the message catalogues.
 */

export const PAGE_SIZE = 12

export const SORT_OPTIONS = ['featured', 'newest', 'nameAsc'] as const
export type SortOption = (typeof SORT_OPTIONS)[number]

export type CatalogueFilters = {
  q?: string
  category?: string
  brand?: string
  origin?: string
  saudiMade?: boolean
  featured?: boolean
  sort: SortOption
  page: number
}

/** Parses and clamps raw search params into a safe filter object. */
export function parseFilters(params: Record<string, string | string[] | undefined>): CatalogueFilters {
  const single = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() || undefined

  const rawSort = single(params.sort)
  const rawPage = Number(single(params.page) ?? '1')

  return {
    q: single(params.q)?.slice(0, 120),
    category: single(params.category),
    brand: single(params.brand),
    origin: single(params.origin),
    saudiMade: single(params.saudiMade) === 'true',
    featured: single(params.featured) === 'true',
    sort: (SORT_OPTIONS as readonly string[]).includes(rawSort ?? '')
      ? (rawSort as SortOption)
      : 'featured',
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(Math.floor(rawPage), 1000) : 1,
  }
}

function buildWhere(filters: CatalogueFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    isVisible: true,
    deletedAt: null,
  }

  if (filters.category) where.category = { slug: filters.category }
  if (filters.brand) where.brand = filters.brand
  if (filters.origin) where.countryOfOrigin = filters.origin
  if (filters.saudiMade) where.isSaudiMade = true
  if (filters.featured) where.isFeatured = true

  if (filters.q) {
    // Search the base record and its translations, so a query in Arabic or
    // Chinese matches a translated product name.
    where.OR = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { shortDescription: { contains: filters.q, mode: 'insensitive' } },
      { brand: { contains: filters.q, mode: 'insensitive' } },
      { manufacturer: { contains: filters.q, mode: 'insensitive' } },
      { translations: { some: { name: { contains: filters.q, mode: 'insensitive' } } } },
    ]
  }

  return where
}

/**
 * Every ordering ends with `id`.
 *
 * A LIMIT/OFFSET query needs a total order: without a unique tiebreaker,
 * records sharing a `createdAt` or `name` can be returned on two pages — or on
 * none — because PostgreSQL is free to break the tie differently per query.
 */
function buildOrderBy(sort: SortOption): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ createdAt: 'desc' }, { id: 'desc' }]
    case 'nameAsc':
      return [{ name: 'asc' }, { id: 'desc' }]
    default:
      return [{ isFeatured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
  }
}

export type ProductListItem = {
  id: string
  slug: string
  name: string
  shortDescription: string | null
  brand: string | null
  countryOfOrigin: string | null
  isSaudiMade: boolean
  isFeatured: boolean
  minimumOrderQty: number | null
  leadTimeDays: number | null
  imageUrl: string | null
  imageAlt: string | null
  categoryName: string
  categorySlug: string
}

/** Applies the best available translation for the active locale. */
function localizeListItem(
  product: Prisma.ProductGetPayload<{
    include: {
      translations: true
      images: true
      category: { include: { translations: true } }
    }
  }>,
  locale: AppLocale
): ProductListItem {
  const translation = pickTranslation(product.translations, locale)
  const categoryTranslation = pickTranslation(product.category.translations, locale)
  const image = product.images[0]

  return {
    id: product.id,
    slug: product.slug,
    name: translation?.name ?? product.name,
    shortDescription: translation?.shortDescription ?? product.shortDescription,
    brand: product.brand,
    countryOfOrigin: product.countryOfOrigin,
    isSaudiMade: product.isSaudiMade,
    isFeatured: product.isFeatured,
    minimumOrderQty: product.minimumOrderQty,
    leadTimeDays: product.leadTimeDays,
    imageUrl: image?.url ?? null,
    imageAlt: image?.alt ?? null,
    categoryName: categoryTranslation?.name ?? product.category.name,
    categorySlug: product.category.slug,
  }
}

export async function listProducts(filters: CatalogueFilters, locale: AppLocale) {
  const where = buildWhere(filters)
  const skip = (filters.page - 1) * PAGE_SIZE

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: buildOrderBy(filters.sort),
      skip,
      take: PAGE_SIZE,
      include: {
        translations: { where: { locale: { in: [toDbLocale(locale), 'en'] } } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
        category: { include: { translations: { where: { locale: { in: [toDbLocale(locale), 'en'] } } } } },
      },
    }),
    db.product.count({ where }),
  ])

  return {
    items: rows.map((row) => localizeListItem(row, locale)),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

/** Distinct filter values, restricted to visible products so no dead option is offered. */
export async function getFilterOptions(locale: AppLocale) {
  const visible: Prisma.ProductWhereInput = { isVisible: true, deletedAt: null }

  const [categories, brands, origins] = await Promise.all([
    db.category.findMany({
      where: { isActive: true, deletedAt: null, products: { some: visible } },
      orderBy: { sortOrder: 'asc' },
      include: {
        translations: { where: { locale: { in: [toDbLocale(locale), 'en'] } } },
        _count: { select: { products: { where: visible } } },
      },
    }),
    db.product.findMany({
      where: { ...visible, brand: { not: null } },
      distinct: ['brand'],
      select: { brand: true },
      orderBy: { brand: 'asc' },
    }),
    db.product.findMany({
      where: { ...visible, countryOfOrigin: { not: null } },
      distinct: ['countryOfOrigin'],
      select: { countryOfOrigin: true },
      orderBy: { countryOfOrigin: 'asc' },
    }),
  ])

  return {
    categories: categories.map((category) => ({
      slug: category.slug,
      name: pickTranslation(category.translations, locale)?.name ?? category.name,
      count: category._count.products,
    })),
    brands: brands.map((row) => row.brand!).filter(Boolean),
    origins: origins.map((row) => row.countryOfOrigin!).filter(Boolean),
  }
}

export async function getProductBySlug(slug: string, locale: AppLocale) {
  const product = await db.product.findFirst({
    where: { slug, isVisible: true, deletedAt: null },
    include: {
      translations: { where: { locale: { in: [toDbLocale(locale), 'en'] } } },
      images: { orderBy: { sortOrder: 'asc' } },
      documents: { include: { file: true } },
      category: { include: { translations: { where: { locale: { in: [toDbLocale(locale), 'en'] } } } } },
      supplier: { select: { legalName: true, country: true, status: true } },
    },
  })

  if (!product) return null

  const translation = pickTranslation(product.translations, locale)
  const categoryTranslation = pickTranslation(product.category.translations, locale)

  return {
    ...product,
    displayName: translation?.name ?? product.name,
    displayShortDescription: translation?.shortDescription ?? product.shortDescription,
    displayDescription: translation?.description ?? product.description,
    categoryName: categoryTranslation?.name ?? product.category.name,
  }
}

export async function getCategoryBySlug(slug: string, locale: AppLocale) {
  const category = await db.category.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    include: { translations: { where: { locale: { in: [toDbLocale(locale), 'en'] } } } },
  })

  if (!category) return null

  const translation = pickTranslation(category.translations, locale)
  return {
    ...category,
    displayName: translation?.name ?? category.name,
    displayDescription: translation?.description ?? category.description,
  }
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  locale: AppLocale,
  take = 4
): Promise<ProductListItem[]> {
  const rows = await db.product.findMany({
    where: { categoryId, isVisible: true, deletedAt: null, id: { not: productId } },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take,
    include: {
      translations: { where: { locale: { in: [toDbLocale(locale), 'en'] } } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      category: { include: { translations: { where: { locale: { in: [toDbLocale(locale), 'en'] } } } } },
    },
  })

  return rows.map((row) => localizeListItem(row, locale))
}

/**
 * Technical specifications are stored as JSON. Narrow defensively rather than
 * trusting the shape, since admins can edit the field.
 */
export type Specification = { key: string; value: string; unit?: string }

export function parseSpecifications(value: unknown): Specification[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const record = entry as Record<string, unknown>
    if (typeof record.key !== 'string' || typeof record.value !== 'string') return []
    return [
      {
        key: record.key,
        value: record.value,
        unit: typeof record.unit === 'string' ? record.unit : undefined,
      },
    ]
  })
}
