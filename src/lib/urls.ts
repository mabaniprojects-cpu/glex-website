import { env } from '@/lib/env'

/**
 * Builds an absolute URL from an app-relative path.
 *
 * Email has no page context, so every link in a message must carry the origin.
 * `APP_URL` is validated at startup; the localhost fallback exists only so a
 * developer with a partial `.env` still gets a clickable link in the console
 * transport.
 */
export function absoluteUrl(path: string): string {
  const base = (env().APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  return `${base}${path}`
}
