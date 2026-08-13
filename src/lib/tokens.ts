import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'

/**
 * Single-use security tokens for email verification, password reset and team
 * invitations.
 *
 * Only a SHA-256 hash of the token is stored. A leaked database snapshot
 * therefore cannot be used to take over an account, exactly as with passwords.
 */

export const TOKEN_PURPOSE = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  TEAM_INVITE: 'TEAM_INVITE',
} as const

export type TokenPurpose = (typeof TOKEN_PURPOSE)[keyof typeof TOKEN_PURPOSE]

const TTL_MINUTES: Record<TokenPurpose, number> = {
  EMAIL_VERIFICATION: 60 * 24, // 24 hours
  PASSWORD_RESET: 60, // 1 hour — deliberately short
  TEAM_INVITE: 60 * 24 * 7, // 7 days
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Issues a token and returns the RAW value — the only time it exists in clear
 * text. Any previously unused token for the same email and purpose is consumed
 * first, so an old link cannot be replayed after a new one is requested.
 */
export async function createToken(
  email: string,
  purpose: TokenPurpose,
  payload?: Record<string, unknown>
): Promise<string> {
  const normalizedEmail = email.toLowerCase()
  const raw = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + TTL_MINUTES[purpose] * 60_000)

  await db.securityToken.updateMany({
    where: { email: normalizedEmail, purpose, usedAt: null },
    data: { usedAt: new Date() },
  })

  await db.securityToken.create({
    data: {
      token: hashToken(raw),
      purpose,
      email: normalizedEmail,
      payload: payload ? (payload as object) : undefined,
      expiresAt,
    },
  })

  return raw
}

export type TokenVerification =
  | { valid: true; email: string; payload: unknown }
  | { valid: false; reason: 'invalid' | 'expired' | 'used' }

/** Checks a token without consuming it — used to render a reset form. */
export async function peekToken(
  raw: string,
  purpose: TokenPurpose
): Promise<TokenVerification> {
  if (!raw) return { valid: false, reason: 'invalid' }

  const record = await db.securityToken.findUnique({ where: { token: hashToken(raw) } })

  if (!record || record.purpose !== purpose) return { valid: false, reason: 'invalid' }
  if (record.usedAt) return { valid: false, reason: 'used' }
  if (record.expiresAt <= new Date()) return { valid: false, reason: 'expired' }

  return { valid: true, email: record.email, payload: record.payload }
}

/**
 * Verifies and atomically consumes a token.
 *
 * `updateMany` with `usedAt: null` in the WHERE clause means the database
 * decides the winner: two concurrent submissions cannot both succeed.
 */
export async function consumeToken(
  raw: string,
  purpose: TokenPurpose
): Promise<TokenVerification> {
  const check = await peekToken(raw, purpose)
  if (!check.valid) return check

  const { count } = await db.securityToken.updateMany({
    where: { token: hashToken(raw), purpose, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  })

  if (count === 0) return { valid: false, reason: 'used' }
  return check
}

/** Constant-time comparison for any token-like string. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/** Removes expired and consumed tokens. Safe to run from a scheduled job. */
export async function pruneTokens(): Promise<number> {
  const { count } = await db.securityToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lte: new Date() } },
        { usedAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60_000) } },
      ],
    },
  })
  return count
}
