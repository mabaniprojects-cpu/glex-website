import { describe, expect, it } from 'vitest'
import { buildPgConfig } from '@/lib/pg-config'

/**
 * The rule being pinned here is invisible at runtime: `pg` merges the parsed
 * connection string OVER the explicit config, so an `sslmode` left in the URL
 * silently discards the `ssl` object and the CA is never used. Nothing errors —
 * the connection just fails to verify, which looks like a certificate problem
 * rather than a precedence one.
 */

const URL_WITH_SSLMODE = 'postgresql://u:p@db.example.com:25060/glex?sslmode=require'
const CA = '-----BEGIN CERTIFICATE-----\nMIIexample\n-----END CERTIFICATE-----'

describe('buildPgConfig', () => {
  it('leaves the connection string alone when no CA is supplied', () => {
    const config = buildPgConfig(URL_WITH_SSLMODE, {})

    expect(config.connectionString).toBe(URL_WITH_SSLMODE)
    expect(config.ssl).toBeUndefined()
  })

  it('removes sslmode from the URL once a CA is supplied', () => {
    const config = buildPgConfig(URL_WITH_SSLMODE, { DATABASE_CA_CERT: CA })

    // If this ever regresses, TLS silently stops verifying against the CA.
    expect(config.connectionString).not.toContain('sslmode')
    expect(config.ssl).toEqual({ ca: CA, rejectUnauthorized: true })
  })

  it('removes uselibpqcompat too, for the same reason', () => {
    const url = 'postgresql://u:p@db.example.com:25060/glex?uselibpqcompat=true&sslmode=require'
    const config = buildPgConfig(url, { DATABASE_CA_CERT: CA })

    expect(config.connectionString).not.toContain('uselibpqcompat')
    expect(config.connectionString).not.toContain('sslmode')
  })

  it('keeps every other query parameter', () => {
    const url = 'postgresql://u:p@db.example.com:25060/glex?sslmode=require&application_name=glex'
    const config = buildPgConfig(url, { DATABASE_CA_CERT: CA })

    expect(config.connectionString).toContain('application_name=glex')
  })

  it('preserves the host, port, database and credentials', () => {
    const config = buildPgConfig(URL_WITH_SSLMODE, { DATABASE_CA_CERT: CA })
    const parsed = new URL(config.connectionString)

    expect(parsed.hostname).toBe('db.example.com')
    expect(parsed.port).toBe('25060')
    expect(parsed.pathname).toBe('/glex')
    expect(parsed.username).toBe('u')
    expect(parsed.password).toBe('p')
  })

  it('repairs a PEM whose newlines were flattened to backslash-n', () => {
    // Several hosting panels do this to multi-line values, and a PEM without
    // real newlines is rejected by OpenSSL with an unhelpful message.
    const flattened = CA.replace(/\n/g, '\\n')
    const config = buildPgConfig(URL_WITH_SSLMODE, { DATABASE_CA_CERT: flattened })

    expect(config.ssl?.ca).toBe(CA)
  })

  it('ignores a blank CA rather than half-configuring TLS', () => {
    expect(buildPgConfig(URL_WITH_SSLMODE, { DATABASE_CA_CERT: '   ' }).ssl).toBeUndefined()
  })

  it('applies the pool cap, and ignores nonsense values', () => {
    expect(buildPgConfig(URL_WITH_SSLMODE, { DATABASE_POOL_MAX: '4' }).max).toBe(4)
    expect(buildPgConfig(URL_WITH_SSLMODE, { DATABASE_POOL_MAX: '0' }).max).toBeUndefined()
    expect(buildPgConfig(URL_WITH_SSLMODE, { DATABASE_POOL_MAX: 'many' }).max).toBeUndefined()
  })
})

describe('connection timeout', () => {
  it('never waits forever, which is pg default of 0', () => {
    // A firewall that DROPS packets produces silence, not an error. Without a
    // timeout the request hangs until something upstream gives up.
    expect(buildPgConfig(URL_WITH_SSLMODE, {}).connectionTimeoutMillis).toBe(10_000)
  })

  it('applies the timeout with a CA too, not only without one', () => {
    const config = buildPgConfig(URL_WITH_SSLMODE, { DATABASE_CA_CERT: CA })
    expect(config.connectionTimeoutMillis).toBe(10_000)
  })

  it('is tunable, and ignores nonsense', () => {
    expect(
      buildPgConfig(URL_WITH_SSLMODE, { DATABASE_CONNECT_TIMEOUT_MS: '3000' }).connectionTimeoutMillis
    ).toBe(3000)
    expect(
      buildPgConfig(URL_WITH_SSLMODE, { DATABASE_CONNECT_TIMEOUT_MS: '0' }).connectionTimeoutMillis
    ).toBe(10_000)
    expect(
      buildPgConfig(URL_WITH_SSLMODE, { DATABASE_CONNECT_TIMEOUT_MS: 'soon' }).connectionTimeoutMillis
    ).toBe(10_000)
  })
})
