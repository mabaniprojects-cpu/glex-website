import Link from 'next/link'
import { defaultLocale } from '@/i18n/routing'

/**
 * Root 404 for URLs that fall outside any locale segment, where no message
 * catalogue has been resolved. Deliberately English-only and dependency-free;
 * the localized version lives at `src/app/[locale]/not-found.tsx`.
 */
export default function RootNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          backgroundColor: '#ffffff',
          color: '#0F2B22',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <main>
          <p style={{ fontSize: '4rem', fontWeight: 700, color: '#94C4AF', margin: 0 }}>404</p>
          <h1 style={{ fontSize: '1.75rem', margin: '0.5rem 0 0' }}>Page not found</h1>
          <p style={{ marginTop: '0.75rem', color: 'rgba(15,43,34,0.72)' }}>
            The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
          </p>
          <p style={{ marginTop: '1.5rem' }}>
            <Link
              href={`/${defaultLocale}`}
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                backgroundColor: '#017A4D',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Return to the homepage
            </Link>
          </p>
        </main>
      </body>
    </html>
  )
}
