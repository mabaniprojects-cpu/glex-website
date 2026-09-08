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
}

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

  // Platforms that pass multi-line values through a single-line field turn the
  // newlines into a literal backslash-n; a PEM is worthless without real ones.
  const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim()

  if (!ca) {
    // No CA supplied: whatever the connection string asks for stands, including
    // `sslmode=no-verify` or `uselibpqcompat=true&sslmode=require`.
    return { connectionString, ...max }
  }

  const url = new URL(connectionString)
  url.searchParams.delete('sslmode')
  url.searchParams.delete('uselibpqcompat')

  return {
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true },
    ...max,
  }
}
