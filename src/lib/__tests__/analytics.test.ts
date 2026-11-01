import { afterEach, describe, expect, it } from 'vitest'
import { analyticsScript, analyticsScriptOrigin } from '@/lib/analytics'

/**
 * Which analytics tag gets rendered, and what the CSP must allow.
 *
 * The CSP case is the one that matters: `script-src 'self'` silently refuses a
 * third-party tag, and a refused tag reports nothing while looking exactly
 * like a site nobody visits. Worth a test that fails loudly instead.
 */

const KEYS = ['ANALYTICS_PROVIDER', 'ANALYTICS_SITE_ID', 'ANALYTICS_SCRIPT_URL'] as const

function configure(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) {
    if (values[key] === undefined) delete process.env[key]
    else process.env[key] = values[key]
  }
}

afterEach(() => configure({}))

describe('the analytics tag', () => {
  it('is absent when no provider is chosen', () => {
    configure({})
    expect(analyticsScript()).toBeNull()
    expect(analyticsScriptOrigin()).toBeNull()
  })

  it('is absent when the provider is explicitly none', () => {
    configure({ ANALYTICS_PROVIDER: 'none', ANALYTICS_SITE_ID: 'exporthouse.com.sa' })
    expect(analyticsScript()).toBeNull()
  })

  it('is absent when a provider is set without a site id, rather than half-loading', () => {
    configure({ ANALYTICS_PROVIDER: 'plausible' })
    expect(analyticsScript()).toBeNull()
  })

  it('puts a Plausible site id in data-domain', () => {
    configure({ ANALYTICS_PROVIDER: 'plausible', ANALYTICS_SITE_ID: 'exporthouse.com.sa' })

    expect(analyticsScript()).toEqual({
      src: 'https://plausible.io/js/script.js',
      attributes: { 'data-domain': 'exporthouse.com.sa' },
    })
  })

  it('puts a Umami site id in data-website-id instead', () => {
    configure({ ANALYTICS_PROVIDER: 'umami', ANALYTICS_SITE_ID: 'abc-123' })

    expect(analyticsScript()).toEqual({
      src: 'https://cloud.umami.is/script.js',
      attributes: { 'data-website-id': 'abc-123' },
    })
  })

  it('accepts a self-hosted script url in place of the provider default', () => {
    configure({
      ANALYTICS_PROVIDER: 'umami',
      ANALYTICS_SITE_ID: 'abc-123',
      ANALYTICS_SCRIPT_URL: 'https://stats.exporthouse.com.sa/script.js',
    })

    expect(analyticsScript()?.src).toBe('https://stats.exporthouse.com.sa/script.js')
  })

  it('ignores an unrecognised provider rather than rendering a broken tag', () => {
    configure({ ANALYTICS_PROVIDER: 'google-analytics', ANALYTICS_SITE_ID: 'G-123' })
    expect(analyticsScript()).toBeNull()
  })
})

describe('the origin the CSP must allow', () => {
  it('is the script host, not the whole url', () => {
    configure({ ANALYTICS_PROVIDER: 'plausible', ANALYTICS_SITE_ID: 'exporthouse.com.sa' })
    expect(analyticsScriptOrigin()).toBe('https://plausible.io')
  })

  it('follows a self-hosted script url', () => {
    configure({
      ANALYTICS_PROVIDER: 'umami',
      ANALYTICS_SITE_ID: 'abc-123',
      ANALYTICS_SCRIPT_URL: 'https://stats.exporthouse.com.sa/script.js',
    })

    expect(analyticsScriptOrigin()).toBe('https://stats.exporthouse.com.sa')
  })

  it('returns null for a malformed url rather than failing the build', () => {
    configure({
      ANALYTICS_PROVIDER: 'plausible',
      ANALYTICS_SITE_ID: 'exporthouse.com.sa',
      ANALYTICS_SCRIPT_URL: 'not a url',
    })

    expect(analyticsScriptOrigin()).toBeNull()
  })
})
