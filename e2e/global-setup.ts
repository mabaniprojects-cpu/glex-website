import type { FullConfig } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/**
 * Warms every route the suite touches before any worker starts.
 *
 * `next dev` compiles routes on first request. Without this, several workers hit
 * cold routes simultaneously, Turbopack serves incomplete RSC payloads, and the
 * browser reports `SyntaxError: Unexpected end of JSON input` while the page
 * stays on its `loading.tsx` fallback.
 *
 * Protected routes are warmed WITH a session. Requesting them signed out only
 * compiles the redirect to /login, leaving the page itself cold — which is
 * exactly how the admin overview kept flaking.
 */

const PUBLIC_ROUTES = [
  '/en',
  '/ar',
  '/de',
  '/fr',
  '/zh-CN',
  '/en/about',
  '/en/services',
  '/en/network',
  '/en/resources',
  '/en/faq',
  '/en/contact',
  '/en/freight',
  '/en/tracking',
  '/en/marketplace',
  '/en/marketplace/steel-and-reinforcement',
  '/en/products/ordinary-portland-cement-type-i-sample',
  '/en/rfq',
  '/en/news',
  '/en/news/sample-glex-launches-its-digital-export-platform',
  '/en/news/rss.xml',
  '/ar/news/rss.xml',
  '/en/login',
  '/en/register',
  '/en/register/client',
  '/en/register/supplier',
  '/en/forgot-password',
  '/en/reset-password',
  '/en/verify-email',
  '/robots.txt',
  '/sitemap.xml',
  // Route handlers compile on first request too. A GET returns 405, which is
  // fine — the point is to compile the module before a test posts to it.
  '/api/chat',
  '/api/chat/feedback',
  '/api/chat/handoff',
]

/** Routes that only compile once an authorised session is presented. */
const PROTECTED_ROUTES: Array<{ account: string; paths: string[] }> = [
  {
    account: 'client@glex.demo',
    paths: [
      '/en/dashboard',
      '/en/dashboard/rfqs',
      '/en/dashboard/rfqs/GLEX-RFQ-2026-000001',
      '/en/dashboard/shipments',
      '/en/dashboard/saved',
      '/en/dashboard/notifications',
      '/en/dashboard/security',
      '/en/dashboard/documents',
      '/en/dashboard/team',
      '/en/dashboard/organization',
      '/en/dashboard/support',
    ],
  },
  {
    account: 'admin@glex.demo',
    paths: [
      '/en/admin',
      '/en/admin/rfqs',
      '/en/admin/suppliers',
      '/en/admin/shipments',
      '/en/admin/inquiries',
      '/en/admin/audit',
      '/en/admin/products',
      '/en/admin/products/new',
      '/en/admin/categories',
      '/en/admin/news',
      '/en/admin/news/new',
      '/en/admin/settings',
      '/en/admin/faq',
      '/en/admin/routes',
      '/en/admin/users',
      '/en/admin/organizations',
      '/en/admin/offices',
      '/en/admin/emails',
      '/en/admin/chats',
      '/en/admin/tickets',
      '/en/admin/news/categories',
    ],
  },
  {
    account: 'supplier@glex.demo',
    paths: [
      '/en/supplier',
      '/en/supplier/opportunities',
      '/en/supplier/products',
      '/en/supplier/security',
    ],
  },
]

/** Collects Set-Cookie values into a single request header. */
function mergeCookies(existing: string, response: Response): string {
  const jar = new Map<string, string>()

  for (const pair of existing.split(';').map((c) => c.trim()).filter(Boolean)) {
    const index = pair.indexOf('=')
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1))
  }

  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';')
    const index = pair!.indexOf('=')
    if (index > 0) jar.set(pair!.slice(0, index), pair!.slice(index + 1))
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}

/**
 * Signs in through the Auth.js credentials callback and returns the cookie
 * header. Returns null on failure — warm-up must never block the suite.
 */
async function signIn(baseURL: string, email: string, password: string): Promise<string | null> {
  try {
    const csrfResponse = await fetch(`${baseURL}/api/auth/csrf`)
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string }
    let cookies = mergeCookies('', csrfResponse)

    const body = new URLSearchParams({ csrfToken, email, password, redirect: 'false' })
    const loginResponse = await fetch(`${baseURL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cookies },
      body,
      redirect: 'manual',
    })
    cookies = mergeCookies(cookies, loginResponse)

    return cookies.includes('authjs.session-token') ? cookies : null
  } catch {
    return null
  }
}

/**
 * Editor routes keyed by a record id, e.g. `/admin/news/[id]`.
 *
 * These cannot be listed as literals like the rest, so a real id is looked up
 * and the route warmed with it. Leaving them cold means the first test to open
 * an editor waits on a route Turbopack is still compiling, which surfaces as a
 * locator timing out against a page still showing its loading fallback.
 */
async function editorRoutes(): Promise<string[]> {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  try {
    const [article, product] = await Promise.all([
      db.newsArticle.findFirst({ where: { deletedAt: null }, select: { id: true } }),
      db.product.findFirst({ where: { deletedAt: null }, select: { id: true } }),
    ])

    return [
      ...(article ? [`/en/admin/news/${article.id}`] : []),
      ...(product ? [`/en/admin/products/${product.id}`] : []),
    ]
  } catch (error) {
    console.warn('[global-setup] could not resolve editor routes:', error)
    return []
  } finally {
    await db.$disconnect()
  }
}

/**
 * Clears rate-limit buckets belonging to the loopback address.
 *
 * Every request in the suite arrives from one IP, so the per-IP ceilings —
 * 5 contact messages an hour, 10 RFQs, 5 registrations — are shared by both
 * projects and by consecutive local runs. Without this, a second run inside the
 * window fails on a limit that is behaving exactly as designed. The limits
 * themselves are covered by src/lib/__tests__/rate-limit.test.ts.
 *
 * Scoped to loopback keys so pointing E2E at a shared environment cannot wipe
 * that environment's real limiter state.
 */
async function clearLoopbackRateLimits() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  try {
    const { count } = await db.rateLimit.deleteMany({
      where: {
        OR: [
          { key: { contains: ':::1' } },
          { key: { contains: '127.0.0.1' } },
          { key: { contains: ':unknown' } },
        ],
      },
    })
    if (count > 0) console.log(`[global-setup] cleared ${count} loopback rate-limit buckets`)
  } catch (error) {
    console.warn('[global-setup] could not clear rate-limit buckets:', error)
  } finally {
    await db.$disconnect()
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL ?? process.env.E2E_BASE_URL ?? 'http://localhost:3000'
  const password = process.env.SEED_DEMO_PASSWORD ?? 'GlexDemo!2026'

  // Wait for the server to accept connections at all.
  const deadline = Date.now() + 180_000
  for (;;) {
    try {
      await fetch(`${baseURL}/en`)
      break
    } catch {
      if (Date.now() > deadline) throw new Error(`Dev server never became ready at ${baseURL}`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  await clearLoopbackRateLimits()

  const started = Date.now()
  let warmed = 0

  /** Serially, so only one route compiles at a time. */
  async function warm(path: string, cookie?: string) {
    try {
      const response = await fetch(`${baseURL}${path}`, {
        headers: cookie ? { cookie } : undefined,
      })
      // Consume the body so streaming completes before the next request.
      await response.text()
      warmed += 1
    } catch (error) {
      console.warn(`[global-setup] warm-up failed for ${path}:`, error)
    }
  }

  for (const path of PUBLIC_ROUTES) await warm(path)

  const dynamicEditors = await editorRoutes()

  for (const group of PROTECTED_ROUTES) {
    const cookie = await signIn(baseURL, group.account, password)
    if (!cookie) {
      console.warn(`[global-setup] could not sign in as ${group.account}; skipping its routes`)
      continue
    }

    const paths =
      group.account === 'admin@glex.demo' ? [...group.paths, ...dynamicEditors] : group.paths

    for (const path of paths) await warm(path, cookie)
  }

  console.log(`[global-setup] warmed ${warmed} routes in ${Date.now() - started}ms`)
}
