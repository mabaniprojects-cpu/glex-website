import 'dotenv/config'
import { UserRole } from '@prisma/client'
import { db } from '../src/lib/db'

/**
 * Promotes an existing, email-verified user to SUPER_ADMIN.
 *
 *   npx tsx scripts/promote-admin.mts you@example.com            # dry run
 *   npx tsx scripts/promote-admin.mts you@example.com --confirm  # apply
 *
 * This exists because the alternative — a hand-typed UPDATE against a live
 * database at go-live — is a single typo away from granting the wrong account
 * every permission in the system, with nothing recorded about who did it.
 *
 * There is deliberately no bootstrap that creates the account: register through
 * the application and verify the email first. An account this script could
 * conjure would be one nobody proved control of an inbox for.
 *
 * `src/lib/audit.ts` cannot be used here — `recordAudit()` reads request
 * headers via `next/headers`, which do not exist in a CLI process — so the
 * audit row is written directly.
 */

const [email, ...flags] = process.argv.slice(2)
const confirmed = flags.includes('--confirm')

if (!email) {
  console.error('Usage: npx tsx scripts/promote-admin.mts <email> [--confirm]')
  process.exit(1)
}

const user = await db.user.findUnique({
  where: { email: email.toLowerCase() },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    emailVerified: true,
    isActive: true,
    deletedAt: true,
  },
})

if (!user) {
  console.error(`No account exists for ${email}.`)
  console.error('Register through the application and verify the address first.')
  process.exit(1)
}

// Each of these is a way to end up with an administrator nobody can actually
// use, or one whose owner was never confirmed.
const refusals: string[] = []
if (user.deletedAt) refusals.push('the account is deleted')
if (!user.emailVerified) refusals.push('the email address is not verified')
if (!user.isActive) refusals.push('the account is deactivated')

if (refusals.length) {
  console.error(`Refusing to promote ${user.email}: ${refusals.join(', ')}.`)
  process.exit(1)
}

if (user.role === UserRole.SUPER_ADMIN) {
  console.log(`${user.email} is already SUPER_ADMIN. Nothing to do.`)
  await db.$disconnect()
  process.exit(0)
}

console.log(`  account:  ${user.email} (${user.name})`)
console.log(`  role:     ${user.role}  ->  ${UserRole.SUPER_ADMIN}`)

if (!confirmed) {
  console.log('\nDry run. Re-run with --confirm to apply.')
  await db.$disconnect()
  process.exit(0)
}

// The role change and its audit record commit together, so a promotion can
// never happen without a trace of it.
await db.$transaction(async (tx) => {
  await tx.user.update({
    where: { id: user.id },
    data: { role: UserRole.SUPER_ADMIN },
  })

  await tx.auditLog.create({
    data: {
      // No actor: this was a shell, not a signed-in user. Recording a user id
      // here would misattribute the change to whoever was promoted.
      actorId: null,
      action: 'user.promoted',
      entityType: 'User',
      entityId: user.id,
      changes: { before: { role: user.role }, after: { role: UserRole.SUPER_ADMIN } },
      userAgent: 'scripts/promote-admin.mts',
    },
  })
})

console.log(`\n${user.email} is now SUPER_ADMIN. An AuditLog entry records the change.`)

await db.$disconnect()
