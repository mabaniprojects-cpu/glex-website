import type { Prisma } from '@prisma/client'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { clientIp } from '@/lib/rate-limit'
import { mask } from '@/lib/utils'

/**
 * Audit logging.
 *
 * Every privileged mutation records who did what, to which entity, and how the
 * record changed. Sensitive fields are masked at write time so the audit trail
 * itself can never become a source of leaked credentials or personal data.
 */

/** Field names whose values must never be stored in clear text. */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'secret',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'email',
  'phone',
  'guestemail',
  'guestphone',
  'ipaddress',
])

type Scalar = string | number | boolean | null

/** Masks sensitive values, and truncates long text so logs stay bounded. */
function sanitize(value: Record<string, unknown>): Record<string, Scalar> {
  const out: Record<string, Scalar> = {}

  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined) continue

    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = typeof raw === 'string' ? mask(raw) : '•••'
      continue
    }

    if (raw === null || typeof raw === 'boolean' || typeof raw === 'number') {
      out[key] = raw
      continue
    }
    if (raw instanceof Date) {
      out[key] = raw.toISOString()
      continue
    }
    if (typeof raw === 'string') {
      out[key] = raw.length > 300 ? `${raw.slice(0, 300)}…` : raw
      continue
    }

    // Anything else (objects, arrays) is summarised rather than dumped.
    out[key] = `[${Array.isArray(raw) ? 'array' : typeof raw}]`
  }

  return out
}

export type AuditInput = {
  actorId: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

/**
 * Writes an audit record.
 *
 * Accepts an optional transaction client so the log commits atomically with the
 * change it describes — an audited action must never succeed without its log.
 */
export async function recordAudit(
  input: AuditInput,
  tx: Prisma.TransactionClient | typeof db = db
): Promise<void> {
  const headerList = await headers()

  const changes: Record<string, unknown> = {}
  if (input.before) changes.before = sanitize(input.before)
  if (input.after) changes.after = sanitize(input.after)

  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      changes: Object.keys(changes).length > 0 ? (changes as Prisma.InputJsonValue) : undefined,
      ipAddress: clientIp(headerList),
      userAgent: headerList.get('user-agent')?.slice(0, 500) ?? null,
    },
  })
}

export async function listAuditLogs({ take = 50, skip = 0 } = {}) {
  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.auditLog.count(),
  ])

  return { items, total }
}
