// @vitest-environment node

import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ignoreErrors, monitoringOptions } from '@/lib/monitoring'

/**
 * Proves the monitoring options actually work, by running a stand-in for
 * Sentry's ingest endpoint and asserting what does and does not arrive.
 *
 * Asserting the shape of the options object would only restate the source. The
 * question worth answering is whether a real fault leaves the process and
 * whether the filters keep working traffic out — a filter that silently stops
 * matching would make the reporter useless in the opposite direction to a
 * filter that stops firing.
 */

type Envelope = { url: string; body: string }

const received: Envelope[] = []
let server: http.Server
let port: number

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      received.push({ url: req.url ?? '', body })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{"id":"stub"}')
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as AddressInfo).port

  const Sentry = await import('@sentry/nextjs')
  Sentry.init(monitoringOptions(`http://publickey@127.0.0.1:${port}/1`, 'test', 0))

  Sentry.captureException(new Error('a genuine fault'))
  for (const ignored of ignoreErrors) {
    Sentry.captureException(new Error(ignored))
  }

  await Sentry.flush(5_000)
  // The transport resolves before the socket has necessarily been read.
  await new Promise((resolve) => setTimeout(resolve, 300))
}, 30_000)

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function transmittedMessages(): string[] {
  // Envelopes are newline-delimited JSON: header, item header, item.
  return received.flatMap((envelope) =>
    envelope.body
      .split('\n')
      .filter((line) => line.includes('"values"'))
      .flatMap((line) => {
        try {
          const item = JSON.parse(line) as { exception?: { values?: { value?: string }[] } }
          return (item.exception?.values ?? []).map((value) => value.value ?? '')
        } catch {
          return []
        }
      })
  )
}

describe('monitoring options', () => {
  it('transmits a genuine fault to the configured DSN', () => {
    expect(received.length).toBeGreaterThan(0)
    expect(transmittedMessages()).toContain('a genuine fault')
  })

  it('posts to the envelope endpoint for the project in the DSN', () => {
    expect(received.some((envelope) => envelope.url.includes('/api/1/envelope/'))).toBe(true)
  })

  it('reports none of the navigation interrupts or client disconnects', () => {
    // `forbidden()` and `notFound()` are how access control works here; a
    // visitor closing a tab mid-stream is a fact about the network. Reporting
    // either would bury real errors.
    const transmitted = transmittedMessages()
    for (const ignored of ignoreErrors) {
      expect(transmitted, ignored).not.toContain(ignored)
    }
  })

  it('never attaches personal data by default', () => {
    // sendDefaultPii would add IP addresses, cookies and headers to every event.
    expect(monitoringOptions('http://k@localhost/1', 'test', 0).sendDefaultPii).toBe(false)
  })

  it('leaves tracing off unless it is asked for', () => {
    expect(monitoringOptions('http://k@localhost/1', 'test', 0).tracesSampleRate).toBe(0)
    expect(monitoringOptions('http://k@localhost/1', 'test', 0.25).tracesSampleRate).toBe(0.25)
  })
})
