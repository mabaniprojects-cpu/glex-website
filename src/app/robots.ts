import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Authenticated surfaces and machine endpoints carry no public value
        // and must never surface in search results.
        disallow: [
          '/api/',
          '/*/dashboard',
          '/*/supplier',
          '/*/admin',
          '/*/login',
          '/*/reset-password',
          '/*/verify-email',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
