import { PrismaAdapter } from '@auth/prisma-adapter'
import { UserRole } from '@prisma/client'
import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { db } from './db'
import { isLockedOut, lockoutExpiry, MAX_FAILED_LOGINS, verifyPassword } from './password'

/**
 * Auth.js v5 configuration.
 *
 * Session strategy is JWT because the Credentials provider cannot use database
 * sessions. Role and organization are copied into the token at sign-in and
 * re-read from the database on a bounded interval, so a role change, an account
 * deactivation or a disabled organisation takes effect without waiting for the
 * token to expire. See `REVALIDATE_AFTER_MS`.
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      organizationId: string | null
      emailVerified: Date | null
    } & DefaultSession['user']
  }

  interface User {
    role?: UserRole
    organizationId?: string | null
  }
}

// NOTE: this MUST augment '@auth/core/jwt', not 'next-auth/jwt'.
// `next-auth/jwt` is a bare re-export, so augmenting it creates a brand-new
// interface instead of merging with the real one, and every custom field
// silently degrades to `unknown` via the JWT index signature.
declare module '@auth/core/jwt' {
  interface JWT {
    id: string
    role: UserRole
    organizationId: string | null
    /** Epoch ms of the last database revalidation. See `REVALIDATE_AFTER_MS`. */
    checkedAt?: number
  }
}

/**
 * How long a token may be trusted before the account is re-read.
 *
 * Without this the token is only checked at sign-in, so deactivating an account
 * or demoting a role would have no effect for the token's full 30-day life —
 * the admin portal would show a "deactivate" button that revoked nothing. One
 * indexed primary-key lookup per user per minute is a cheap price for bounding
 * that window to a minute.
 */
const REVALIDATE_AFTER_MS = 60_000

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  trustHost: true,
  pages: {
    signIn: '/en/login',
    error: '/en/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const { email, password } = parsed.data
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { organization: { select: { isActive: true, deletedAt: true } } },
        })

        // Uniform failure for unknown user, no password set, deleted, or
        // deactivated — never reveal which condition applied.
        if (!user?.passwordHash || user.deletedAt || !user.isActive) return null

        // A disabled organisation disables everyone in it. Without this the
        // organisation switch would be decorative, and ending a client
        // relationship would mean hunting down each account by hand.
        if (user.organization && (!user.organization.isActive || user.organization.deletedAt)) {
          return null
        }

        if (isLockedOut(user.lockedUntil)) return null

        const ok = await verifyPassword(password, user.passwordHash)

        if (!ok) {
          const failed = user.failedLoginCount + 1
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
              lockedUntil: lockoutExpiry(failed),
            },
          })
          return null
        }

        // Unverified accounts must not receive a session.
        if (!user.emailVerified) return null

        await db.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          organizationId: user.organizationId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.id = user.id
        token.role = user.role ?? UserRole.CLIENT_TEAM_MEMBER
        token.organizationId = user.organizationId ?? null
        token.checkedAt = Date.now()
        return token
      }

      // Re-read so revoked access takes effect promptly. The elapsed-time check
      // is what makes this real: without it the token carries its role for the
      // full 30 days and nothing an administrator does can revoke it sooner.
      const stale = Date.now() - (token.checkedAt ?? 0) > REVALIDATE_AFTER_MS

      if (trigger === 'update' || !token.role || stale) {
        const fresh = await db.user.findUnique({
          where: { id: token.id },
          select: {
            role: true,
            organizationId: true,
            isActive: true,
            deletedAt: true,
            organization: { select: { isActive: true, deletedAt: true } },
          },
        })
        // A user with no organisation is unaffected; one whose organisation is
        // switched off loses access with them.
        const org = fresh?.organization
        const orgDisabled = Boolean(org) && (!org?.isActive || Boolean(org.deletedAt))

        if (!fresh || !fresh.isActive || fresh.deletedAt || orgDisabled) {
          // Returning a token without an id invalidates the session downstream.
          return { ...token, id: '', role: undefined as unknown as UserRole }
        }
        token.role = fresh.role
        token.organizationId = fresh.organizationId
        token.checkedAt = Date.now()
      }

      return token
    },

    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.organizationId = token.organizationId
      }
      return session
    },
  },
})
