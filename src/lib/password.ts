import bcrypt from 'bcryptjs'

/**
 * Password hashing and the brute-force lockout policy.
 * Cost 12 is a deliberate balance for interactive logins on commodity hardware.
 */
const BCRYPT_COST = 12

export const MAX_FAILED_LOGINS = 5
export const LOCKOUT_MINUTES = 15

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Minimum password policy, shared by the Zod schemas and the seed script so
 * seeded accounts can never violate the rule they are validated against.
 */
export function isStrongPassword(value: string): boolean {
  return value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value)
}

export function lockoutExpiry(failedCount: number): Date | null {
  if (failedCount < MAX_FAILED_LOGINS) return null
  return new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
}

export const isLockedOut = (lockedUntil: Date | null | undefined): boolean =>
  Boolean(lockedUntil && lockedUntil.getTime() > Date.now())
