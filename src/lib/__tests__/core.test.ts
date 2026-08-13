import { describe, expect, it } from 'vitest'
import {
  hashPassword,
  isLockedOut,
  isStrongPassword,
  lockoutExpiry,
  MAX_FAILED_LOGINS,
  verifyPassword,
} from '../password'
import { formatReference, isGlexReference } from '../references'
import { formatDate, formatNumber, mask, readingMinutes, slugify, truncate } from '../utils'

describe('password policy', () => {
  it('round-trips a hash', async () => {
    const hash = await hashPassword('CorrectHorse9')
    expect(hash).not.toBe('CorrectHorse9')
    await expect(verifyPassword('CorrectHorse9', hash)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password-1', hash)).resolves.toBe(false)
  })

  it('produces a different hash each time (salted)', async () => {
    const [a, b] = await Promise.all([hashPassword('CorrectHorse9'), hashPassword('CorrectHorse9')])
    expect(a).not.toBe(b)
  })

  it('enforces length, a letter and a digit', () => {
    expect(isStrongPassword('Passphrase!2026')).toBe(true)
    expect(isStrongPassword('abcdefghi1')).toBe(true)

    expect(isStrongPassword('short1')).toBe(false) // too short
    expect(isStrongPassword('alllettersonly')).toBe(false) // no digit
    expect(isStrongPassword('1234567890')).toBe(false) // no letter
    expect(isStrongPassword('')).toBe(false)
  })

  it('locks out only after the threshold', () => {
    expect(lockoutExpiry(MAX_FAILED_LOGINS - 1)).toBeNull()
    const expiry = lockoutExpiry(MAX_FAILED_LOGINS)
    expect(expiry).toBeInstanceOf(Date)
    expect(expiry!.getTime()).toBeGreaterThan(Date.now())
  })

  it('reports lockout state', () => {
    expect(isLockedOut(null)).toBe(false)
    expect(isLockedOut(undefined)).toBe(false)
    expect(isLockedOut(new Date(Date.now() - 1000))).toBe(false)
    expect(isLockedOut(new Date(Date.now() + 60_000))).toBe(true)
  })
})

describe('reference numbers', () => {
  it('zero-pads to six digits', () => {
    expect(formatReference('RFQ', 2026, 1)).toBe('GLEX-RFQ-2026-000001')
    expect(formatReference('SHP', 2026, 42)).toBe('GLEX-SHP-2026-000042')
    expect(formatReference('INQ', 2026, 999999)).toBe('GLEX-INQ-2026-999999')
  })

  it('recognises its own format', () => {
    expect(isGlexReference('GLEX-RFQ-2026-000001')).toBe(true)
    expect(isGlexReference('glex-shp-2026-000001')).toBe(true)
    expect(isGlexReference('  GLEX-INQ-2026-000001  ')).toBe(true)

    expect(isGlexReference('GLEX-RFQ-2026-1')).toBe(false)
    expect(isGlexReference('DEMU1234567')).toBe(false)
    expect(isGlexReference('')).toBe(false)
  })
})

describe('utils', () => {
  it('slugifies Latin text', () => {
    expect(slugify('Ordinary Portland Cement Type I')).toBe('ordinary-portland-cement-type-i')
    expect(slugify('  Steel &  Reinforcement  ')).toBe('steel-reinforcement')
  })

  it('still returns a usable slug for non-Latin text', () => {
    const slug = slugify('مواد البناء')
    expect(slug).not.toBe('')
    expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('truncates on a word boundary', () => {
    expect(truncate('short', 20)).toBe('short')
    const result = truncate('the quick brown fox jumps over the lazy dog', 20)
    expect(result.length).toBeLessThanOrEqual(21)
    expect(result.endsWith('…')).toBe(true)
  })

  it('masks sensitive values without revealing the middle', () => {
    expect(mask('')).toBe('')
    expect(mask(null)).toBe('')
    expect(mask('abcd')).toBe('••••')

    const masked = mask('sk-secret-token-value')
    expect(masked.startsWith('sk')).toBe(true)
    expect(masked.endsWith('ue')).toBe(true)
    expect(masked).not.toContain('secret')
  })

  it('estimates reading time, never below one minute', () => {
    expect(readingMinutes('one two three')).toBe(1)
    expect(readingMinutes('')).toBe(1)
    expect(readingMinutes(Array.from({ length: 400 }, () => 'word').join(' '))).toBe(2)
  })

  it('formats dates and numbers per locale', () => {
    const date = new Date('2026-03-15T12:00:00Z')
    expect(formatDate(date, 'en')).toContain('2026')
    expect(formatDate(date, 'de')).toContain('2026')

    // Locale-specific grouping separators.
    expect(formatNumber(1234567, 'en')).toBe('1,234,567')
    expect(formatNumber(1234567, 'de')).toBe('1.234.567')
  })
})
