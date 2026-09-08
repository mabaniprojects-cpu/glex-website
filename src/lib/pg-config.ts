/**
 * Builds the `pg` pool configuration.
 *
 * Separated from `src/lib/db.ts` so it can be unit-tested without opening a
 * connection — the precedence rule below is invisible at runtime and produces
 * a connection that merely fails, rather than one that complains.
 */

export type PgPoolConfig = {
  connectionString: string
  ssl?: { ca: string; rejectUnauthorized: true }
  max?: number
  connectionTimeoutMillis: number
}

/**
 * How long to wait for a connection before giving up.
 *
 * `pg` defaults to 0, meaning wait forever. That is the wrong default the
 * moment the database is remote and behind a firewall: a rule that DROPS
 * packets rather than rejecting them produces no error at all, just silence.
 * Every request then hangs until something further up the stack times out —
 * during a build that was Next's 60-second per-page limit, and in production it
 * would be the visitor's patience.
 *
 * Ten seconds is long enough to survive a slow moment and short enough that a
 * partition surfaces as an error the application can fall back from.
 */
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000

/**
 * Managed PostgreSQL providers (DigitalOcean among them) present certificates
 * signed by a per-project CA that is in no public trust store. Meanwhile
 * `pg-connection-string` currently treats `sslmode=require` as `verify-full`,
 * so it DOES verify the chain — and the connection dies with
 * "self-signed certificate in certificate chain".
 *
 * Supplying the provider's CA in DATABASE_CA_CERT fixes it properly, rather
 * than turning verification off.
 *
 * The `sslmode` strip is not cosmetic. `pg` builds its parameters as:
 *
 *     config = Object.assign({}, config, parse(config.connectionString))
 *
 * — the parsed URL WINS over explicit keys. Leaving `sslmode` in the string
 * would silently overwrite the `ssl` object below and the CA would be ignored,
 * with no error to explain it.
 */
export function buildPgConfig(
  connectionString: string,
  // Indexed rather than a named shape, so `process.env` (NodeJS.ProcessEnv)
  // satisfies it directly.
  env: Record<string, string | undefined> = process.env
): PgPoolConfig {
  const poolMax = Number(env.DATABASE_POOL_MAX)
  const max = Number.isFinite(poolMax) && poolMax > 0 ? { max: poolMax } : {}

  const configured = Number(env.DATABASE_CONNECT_TIMEOUT_MS)
  const connectionTimeoutMillis =
    Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CONNECT_TIMEOUT_MS

  // Platforms that pass multi-line values through a single-line field turn the
  // newlines into a literal backslash-n; a PEM is worthless without real ones.
  const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim()

  if (!ca) {
    // No CA supplied: whatever the connection string asks for stands, including
    // `sslmode=no-verify` or `uselibpqcompat=true&sslmode=require`.
    return { connectionString, connectionTimeoutMillis, ...max }
  }

  const url = new URL(connectionString)
  url.searchParams.delete('sslmode')
  url.searchParams.delete('uselibpqcompat')

  return {
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true },
    connectionTimeoutMillis,
    ...max,
  }
}
