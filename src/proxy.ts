import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. Unlike middleware, proxy
 * always runs on the Node.js runtime, which is what lets us keep next-intl and
 * the auth cookie check in a single file.
 *
 * IMPORTANT: the check here is an *optimistic* redirect for unauthenticated
 * visitors only — it reads the session cookie's presence, not its validity.
 * Real authorization is enforced in `src/lib/auth-guards.ts` on every page,
 * server action and route handler. Server Actions POST to the page's own URL,
 * so a proxy matcher can never be the only gate.
 */

const intlMiddleware = createIntlMiddleware(routing)

const localePattern = routing.locales.join('|')

/** Route groups that require an authenticated session. */
const PROTECTED = new RegExp(`^/(${localePattern})/(dashboard|supplier|admin|account)(/|$)`)

/** Auth pages an already-signed-in user should be bounced away from. */
const AUTH_PAGES = new RegExp(`^/(${localePattern})/(login|register)(/|$)`)

function hasSessionCookie(request: NextRequest): boolean {
  // Auth.js v5 uses `__Secure-` prefixed cookies over HTTPS.
  return Boolean(
    request.cookies.get('authjs.session-token')?.value ??
      request.cookies.get('__Secure-authjs.session-token')?.value
  )
}

export default function proxy(request: NextRequest) {
  // 1. Locale negotiation first — everything downstream reasons about a
  //    locale-prefixed pathname.
  const response = intlMiddleware(request)

  const { pathname } = request.nextUrl
  const signedIn = hasSessionCookie(request)

  if (PROTECTED.test(pathname) && !signedIn) {
    const url = request.nextUrl.clone()
    const locale = pathname.split('/')[1] || routing.defaultLocale
    url.pathname = `/${locale}/login`
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  if (AUTH_PAGES.test(pathname) && signedIn) {
    const url = request.nextUrl.clone()
    const locale = pathname.split('/')[1] || routing.defaultLocale
    url.pathname = `/${locale}/dashboard`
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Preserve next-intl's rewrite and locale headers.
  return response
}

export const config = {
  // Skip Next internals, the API surface, and anything with a file extension.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
