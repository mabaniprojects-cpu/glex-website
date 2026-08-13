'use client'

/**
 * Last-resort boundary for failures in the root layout itself.
 *
 * It replaces the whole document, so it must render its own <html> and <body>
 * and cannot rely on the app's stylesheet, fonts or i18n provider — hence the
 * inline styles and English-only copy. `metadata` exports are not supported
 * here; the title is set with React's <title>.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
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
        <title>Something went wrong — GLEX</title>
        <main>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: '0.75rem', color: 'rgba(15,43,34,0.72)', maxWidth: '32rem' }}>
            An unexpected error occurred on our side. Please try again, or contact us if the
            problem continues.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: '0.75rem',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.75rem',
                color: 'rgba(15,43,34,0.45)',
              }}
            >
              {error.digest}
            </p>
          ) : null}
          <p style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: '#017A4D',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </p>
        </main>
      </body>
    </html>
  )
}
