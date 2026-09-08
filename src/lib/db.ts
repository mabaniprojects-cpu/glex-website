import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { buildPgConfig } from '@/lib/pg-config'

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
   * TLS and pool size both stop being local concerns the moment the database is
   * remote — see `buildPgConfig` for why each is handled the way it is.
   *
   * DATABASE_POOL_MAX: `pg` opens 10 connections PER PROCESS by default, and a
   * host may run several application processes, so four of them ask a managed
   * database for 40 connections — above the limit of most small plans. The
   * symptom is "too many clients already" under load rather than at startup, so
   * it reads as a traffic problem rather than a configuration one. Set it to
   * (the plan's connection limit ÷ number of processes), leaving headroom for
   * migrations and an admin session.
   *
   * DATABASE_CA_CERT: the managed provider's CA, so TLS verifies properly
   * instead of being switched off.
   */
  const adapter = new PrismaPg(buildPgConfig(connectionString))

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
