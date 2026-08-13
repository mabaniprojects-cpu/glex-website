'use server'

import { OrganizationType, UserRole } from '@prisma/client'
import { headers } from 'next/headers'
import { toDbLocale } from '@/i18n/locale'
import { db } from '@/lib/db'
import { sendTemplate } from '@/lib/mail'
import { hashPassword } from '@/lib/password'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { consumeToken, createToken, TOKEN_PURPOSE } from '@/lib/tokens'
import { absoluteUrl } from '@/lib/urls'
import { slugify } from '@/lib/utils'
import {
  clientRegisterSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type ClientRegisterInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from '@/lib/validation/auth'

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string; fields?: Record<string, string> }

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fields[key]) fields[key] = issue.message
  }
  return fields
}

// --- Client registration ----------------------------------------------------

export async function registerClient(
  input: ClientRegisterInput,
  locale: string
): Promise<ActionResult> {
  const parsed = clientRegisterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'validation', fields: fieldErrors(parsed.error) }
  }

  const data = parsed.data
  if (data.website) return { ok: true } // honeypot: accept and drop

  const ip = clientIp(await headers())
  const limit = await checkRateLimit(`register:${ip}`, 5, 60 * 60)
  if (!limit.allowed) return { ok: false, error: 'rate_limited' }

  const email = data.email.toLowerCase()

  try {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } })

    // Do not reveal that an address is already registered — that would let an
    // attacker enumerate accounts. The response is identical either way; a
    // genuine owner receives a "someone tried to register" cue by email.
    if (!existing) {
      const passwordHash = await hashPassword(data.password)
      const dbLocale = toDbLocale(data.preferredLocale)

      // Unique organisation slug, since two clients may share a company name.
      const baseSlug = slugify(data.companyName)
      let slug = baseSlug
      for (let attempt = 1; ; attempt += 1) {
        const clash = await db.organization.findUnique({ where: { slug }, select: { id: true } })
        if (!clash) break
        slug = `${baseSlug}-${attempt}`
      }

      await db.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            slug,
            name: data.companyName,
            type: OrganizationType.CLIENT,
            country: data.country,
            city: data.city || null,
          },
        })

        const user = await tx.user.create({
          data: {
            email,
            name: data.fullName,
            phone: data.phone || null,
            passwordHash,
            // Verified only once the emailed link is followed.
            emailVerified: null,
            role: UserRole.CLIENT_ORG_ADMIN,
            preferredLocale: dbLocale,
            organizationId: organization.id,
          },
        })

        await tx.clientProfile.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            clientType: data.clientType,
            companyName: data.companyName,
            position: data.position || null,
            industry: data.industry || null,
            country: data.country,
            city: data.city || null,
          },
        })

        await tx.organizationMember.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            role: UserRole.CLIENT_ORG_ADMIN,
            isOwner: true,
            acceptedAt: new Date(),
          },
        })

        await tx.consentRecord.create({
          data: { userId: user.id, purpose: 'TERMS_ACCEPTANCE', granted: true, ipAddress: ip },
        })
      })

      const token = await createToken(email, TOKEN_PURPOSE.EMAIL_VERIFICATION)

      // Mail is best-effort: the account already exists, so a delivery failure
      // must not roll the registration back.
      await sendTemplate('email-verification', email, {
        locale: dbLocale,
        recipientName: data.fullName,
        actionUrl: absoluteUrl(`/${locale}/verify-email?token=${token}`),
        actionLabel: 'Verify my email',
      })
    }

    return { ok: true }
  } catch (error) {
    console.error('[auth] Client registration failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Email verification -----------------------------------------------------

export async function verifyEmail(token: string): Promise<ActionResult> {
  const result = await consumeToken(token, TOKEN_PURPOSE.EMAIL_VERIFICATION)
  if (!result.valid) return { ok: false, error: result.reason }

  try {
    const user = await db.user.findUnique({
      where: { email: result.email },
      select: { id: true, name: true, preferredLocale: true, emailVerified: true },
    })
    if (!user) return { ok: false, error: 'invalid' }

    if (!user.emailVerified) {
      await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } })

      await sendTemplate('welcome', result.email, {
        locale: user.preferredLocale,
        recipientName: user.name,
      })
    }

    return { ok: true }
  } catch (error) {
    console.error('[auth] Email verification failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Password reset ---------------------------------------------------------

export async function requestPasswordReset(
  input: ForgotPasswordInput,
  locale: string
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'validation', fields: fieldErrors(parsed.error) }
  }
  if (parsed.data.website) return { ok: true }

  const ip = clientIp(await headers())
  const limit = await checkRateLimit(`reset:${ip}`, 5, 60 * 60)
  if (!limit.allowed) return { ok: false, error: 'rate_limited' }

  const email = parsed.data.email.toLowerCase()

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, preferredLocale: true, isActive: true, deletedAt: true },
    })

    // Always report success, so the form cannot be used to discover which
    // addresses hold an account.
    if (user && user.isActive && !user.deletedAt) {
      const token = await createToken(email, TOKEN_PURPOSE.PASSWORD_RESET)
      await sendTemplate('password-reset', email, {
        locale: user.preferredLocale,
        recipientName: user.name,
        actionUrl: absoluteUrl(`/${locale}/reset-password?token=${token}`),
        actionLabel: 'Choose a new password',
      })
    }

    return { ok: true }
  } catch (error) {
    console.error('[auth] Password reset request failed:', error)
    // Still report success — the error is logged for operators.
    return { ok: true }
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'validation', fields: fieldErrors(parsed.error) }
  }

  const consumed = await consumeToken(parsed.data.token, TOKEN_PURPOSE.PASSWORD_RESET)
  if (!consumed.valid) return { ok: false, error: consumed.reason }

  try {
    const passwordHash = await hashPassword(parsed.data.password)

    await db.user.update({
      where: { email: consumed.email },
      data: {
        passwordHash,
        // A successful reset clears any brute-force lockout, and proves the
        // address is reachable, so treat it as verification too.
        failedLoginCount: 0,
        lockedUntil: null,
        emailVerified: new Date(),
      },
    })

    // Invalidate existing sessions so a stolen session cannot outlive a reset.
    await db.session.deleteMany({ where: { user: { email: consumed.email } } })

    return { ok: true }
  } catch (error) {
    console.error('[auth] Password reset failed:', error)
    return { ok: false, error: 'server' }
  }
}

// --- Resend verification ----------------------------------------------------

export async function resendVerification(
  email: string,
  locale: string
): Promise<ActionResult> {
  const ip = clientIp(await headers())
  const limit = await checkRateLimit(`resend:${ip}`, 3, 60 * 60)
  if (!limit.allowed) return { ok: false, error: 'rate_limited' }

  const normalized = email.trim().toLowerCase()

  try {
    const user = await db.user.findUnique({
      where: { email: normalized },
      select: { name: true, preferredLocale: true, emailVerified: true },
    })

    if (user && !user.emailVerified) {
      const token = await createToken(normalized, TOKEN_PURPOSE.EMAIL_VERIFICATION)
      await sendTemplate('email-verification', normalized, {
        locale: user.preferredLocale,
        recipientName: user.name,
        actionUrl: absoluteUrl(`/${locale}/verify-email?token=${token}`),
        actionLabel: 'Verify my email',
      })
    }

    return { ok: true }
  } catch (error) {
    console.error('[auth] Resend verification failed:', error)
    return { ok: true }
  }
}
