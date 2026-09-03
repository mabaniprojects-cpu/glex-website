import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/**
 * Prisma 7 requires a driver adapter — the datasource URL is no longer read
 * from `schema.prisma`. The adapter owns a `pg` connection pool, so the client
 * must be a singleton: Next.js hot-reload would otherwise open a new pool on
 * every edit and exhaust PostgreSQL's connection limit.
 */
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure it.')
  }

  /**
   * Pool size, tunable because it stops being a local concern the moment the
   * database is remote.
   *
   * `pg` defaults to 10 connections PER PROCESS, and Passenger runs several
   * application processes. Four processes therefore ask a managed database for
   * 40 connections, which is above the limit of most small plans — and the
   * symptom is "too many clients already" under load rather than at startup,
   * so it looks like a traffic problem rather than a configuration one.
   *
   * Set DATABASE_POOL_MAX to (the plan's connection limit ÷ number of app
   * processes), leaving headroom for migrations and any admin session.
   */
  const poolMax = Number(process.env.DATABASE_POOL_MAX)

  const adapter = new PrismaPg({
    connectionString,
    ...(Number.isFinite(poolMax) && poolMax > 0 ? { max: poolMax } : {}),
  })

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }]
        : [{ level: 'error', emit: 'stdout' }],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
