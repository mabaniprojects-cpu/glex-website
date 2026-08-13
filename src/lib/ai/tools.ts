import { tool } from 'ai'
import { z } from 'zod'
import type { AppLocale } from '@/i18n/routing'
import type { SessionUser } from '@/lib/auth-guards'
import { listProducts, parseFilters } from '@/lib/catalogue'
import { rfqScope, shipmentScope } from '@/lib/dashboard'
import { db } from '@/lib/db'
import { nextReference } from '@/lib/references'

/**
 * Assistant tools.
 *
 * SECURITY MODEL: authorization lives here, not in the prompt. Every private
 * lookup derives its scope from the server-side session, so no instruction a
 * visitor types — however cleverly phrased — can widen what these return.
 * An unauthenticated caller simply has no private tools registered at all.
 */

export type ToolContext = {
  user: SessionUser | null
  locale: AppLocale
}

/** Public tools, available to everyone including anonymous visitors. */
export function buildPublicTools(context: ToolContext) {
  return {
    searchCatalogue: tool({
      description:
        'Search the GLEX building-materials catalogue by keyword. Returns product names and categories. There are no prices — the catalogue is quotation-based.',
      inputSchema: z.object({
        query: z.string().min(1).max(120).describe('Keywords, e.g. "cement" or "steel bar"'),
      }),
      execute: async ({ query }) => {
        const { items, total } = await listProducts(
          parseFilters({ q: query }),
          context.locale
        )

        return {
          total,
          products: items.slice(0, 6).map((item) => ({
            name: item.name,
            category: item.categoryName,
            saudiMade: item.isSaudiMade,
            minimumOrder: item.minimumOrderQty,
            url: `/${context.locale}/products/${item.slug}`,
            // Stated explicitly so the model cannot infer a price exists.
            price: 'Price on request — submit an RFQ for a quotation',
          })),
        }
      },
    }),

    listProductCategories: tool({
      description: 'List the building-material categories GLEX sources and exports.',
      inputSchema: z.object({}),
      execute: async () => {
        const categories = await db.category.findMany({
          where: { isActive: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          select: { name: true, slug: true },
          take: 40,
        })
        return { categories: categories.map((c) => c.name) }
      },
    }),

    suggestPage: tool({
      description:
        'Return the URL of a GLEX page so the visitor can be directed to it. Use for navigation questions.',
      inputSchema: z.object({
        page: z.enum([
          'marketplace',
          'rfq',
          'tracking',
          'contact',
          'about',
          'services',
          'network',
          'resources',
          'faq',
          'news',
          'registerClient',
          'registerSupplier',
          'login',
        ]),
      }),
      execute: async ({ page }) => {
        const paths: Record<string, string> = {
          marketplace: '/marketplace',
          rfq: '/rfq',
          tracking: '/tracking',
          contact: '/contact',
          about: '/about',
          services: '/services',
          network: '/network',
          resources: '/resources',
          faq: '/faq',
          news: '/news',
          registerClient: '/register/client',
          registerSupplier: '/register/supplier',
          login: '/login',
        }
        return { url: `/${context.locale}${paths[page]}` }
      },
    }),
  }
}

/**
 * Tools that read the signed-in person's own records.
 *
 * These are only ever registered when a session exists, and each query is
 * scoped by the SAME helpers the dashboard uses — so the assistant can never
 * see more than the person could see themselves.
 */
export function buildPrivateTools(user: SessionUser, context: ToolContext) {
  return {
    listMyRfqs: tool({
      description:
        "List the signed-in person's own requests for quotation, with their current status.",
      inputSchema: z.object({}),
      execute: async () => {
        const rfqs = await db.rFQ.findMany({
          where: { ...rfqScope(user), deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            reference: true,
            status: true,
            destinationCountry: true,
            submittedAt: true,
          },
        })

        return {
          count: rfqs.length,
          rfqs: rfqs.map((rfq) => ({
            reference: rfq.reference,
            status: rfq.status,
            destination: rfq.destinationCountry,
            submitted: rfq.submittedAt?.toISOString() ?? null,
            url: `/${context.locale}/dashboard/rfqs/${rfq.reference}`,
          })),
        }
      },
    }),

    listMyShipments: tool({
      description:
        "List the signed-in person's own shipments, with status and estimated arrival.",
      inputSchema: z.object({}),
      execute: async () => {
        const shipments = await db.shipment.findMany({
          where: { ...shipmentScope(user), deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            reference: true,
            status: true,
            destinationCountry: true,
            estimatedArrival: true,
            isDemo: true,
          },
        })

        return {
          count: shipments.length,
          shipments: shipments.map((shipment) => ({
            reference: shipment.reference,
            status: shipment.status,
            destination: shipment.destinationCountry,
            // Presented as an estimate, never as a promise.
            estimatedArrival: shipment.estimatedArrival?.toISOString() ?? null,
            isDemonstrationRecord: shipment.isDemo,
          })),
        }
      },
    }),

    createSupportHandoff: tool({
      description:
        'Escalate to a human. Creates a support ticket for the GLEX team. Use when the person asks for a person, or when you cannot answer.',
      inputSchema: z.object({
        subject: z.string().min(3).max(200),
        summary: z.string().min(3).max(2000),
      }),
      execute: async ({ subject, summary }) => {
        const reference = await db.$transaction(async (tx) => {
          const ref = await nextReference(tx, 'TKT')
          await tx.supportTicket.create({
            data: {
              reference: ref,
              subject,
              requesterId: user.id,
              messages: { create: [{ authorId: user.id, body: summary }] },
            },
          })
          return ref
        })

        return { reference, message: 'A support ticket has been created for the GLEX team.' }
      },
    }),
  }
}

/**
 * Names of the tools that were invoked.
 *
 * Only names are ever persisted (see `ChatMessage.toolsUsed`) — arguments and
 * retrieved records must never reach the transcript store.
 */
export function extractToolNames(steps: readonly unknown[]): string[] {
  const names = new Set<string>()

  // The SDK types a step's `toolCalls` as a union generic over the tool map,
  // which does not structurally match a plain `{ toolName }` shape. All we need
  // is the name, so the shape is narrowed at runtime instead.
  for (const step of steps) {
    const calls = (step as { toolCalls?: unknown } | null)?.toolCalls
    if (!Array.isArray(calls)) continue

    for (const call of calls) {
      const name = (call as { toolName?: unknown } | null)?.toolName
      if (typeof name === 'string') names.add(name)
    }
  }

  return [...names]
}
