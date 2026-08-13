import 'dotenv/config'
import { UserRole } from '@prisma/client'
import { db } from '../src/lib/db'

/**
 * Removes the seeded demonstration accounts and the demo records that are
 * explicitly flagged as such.
 *
 *   npx tsx scripts/purge-demo-data.mts            # dry run
 *   npx tsx scripts/purge-demo-data.mts --confirm  # apply
 *
 * Two things about the scope are worth stating plainly, because the README used
 * to claim otherwise:
 *
 *   `isDemo` exists ONLY on Shipment and `isSample` ONLY on NewsArticle. Demo
 *   users, organizations, products and RFQs carry no flag at all, so there is no
 *   reliable handle on them beyond the `@glex.demo` email suffix. This script
 *   therefore does not guess: it removes the accounts and the flagged records,
 *   and reports what it is leaving behind rather than deleting by name or slug
 *   heuristics that would eventually match something real.
 *
 *   Organizations are never deleted. The application's own rule is that an
 *   organization holding users, RFQs or shipments cannot be removed, and a
 *   maintenance script should not do quietly what the product refuses to do
 *   openly.
 */

const confirmed = process.argv.includes('--confirm')
const DEMO_SUFFIX = '@glex.demo'

// --- Lockout guard ---------------------------------------------------------
// admin@glex.demo is a SUPER_ADMIN. Removing it without a real one in place
// would leave nobody able to administer the system, and no way back in through
// the application.

const realAdmins = await db.user.findMany({
  where: {
    role: UserRole.SUPER_ADMIN,
    email: { not: { endsWith: DEMO_SUFFIX } },
    isActive: true,
    deletedAt: null,
    emailVerified: { not: null },
  },
  select: { email: true },
})

if (realAdmins.length === 0) {
  console.error('Refusing to purge: there is no active, verified SUPER_ADMIN outside the')
  console.error('demo accounts, so this would leave the system with no administrator.')
  console.error('\nPromote a real account first:')
  console.error('  npx tsx scripts/promote-admin.mts you@example.com --confirm')
  process.exit(1)
}

console.log(`Real administrators that will remain: ${realAdmins.map((a) => a.email).join(', ')}`)

// --- What would go ---------------------------------------------------------

const demoUsers = await db.user.findMany({
  where: { email: { endsWith: DEMO_SUFFIX } },
  select: { id: true, email: true, role: true },
})

const demoUserIds = demoUsers.map((u) => u.id)

const [demoShipments, sampleArticles] = await Promise.all([
  db.shipment.findMany({ where: { isDemo: true }, select: { id: true, reference: true } }),
  db.newsArticle.findMany({ where: { isSample: true }, select: { id: true, title: true } }),
])

console.log(`\naccounts to delete (${demoUsers.length}):`)
for (const u of demoUsers) console.log('   ', u.email.padEnd(32), u.role)
console.log(`\nshipments flagged isDemo (${demoShipments.length}):`)
for (const s of demoShipments) console.log('   ', s.reference)
console.log(`\nnews articles flagged isSample (${sampleArticles.length}):`)
for (const a of sampleArticles) console.log('   ', a.title.slice(0, 70))

// --- What survives, with references nulled ---------------------------------
// Deleting a User cascades sessions, memberships, notifications and tickets,
// but RFQs, news articles and audit logs are SetNull — they survive, detached.
// Silently orphaning commercial records would be worse than saying so.

const [orphanedRfqs, orphanedAudits] = await Promise.all([
  db.rFQ.count({ where: { createdById: { in: demoUserIds } } }),
  db.auditLog.count({ where: { actorId: { in: demoUserIds } } }),
])

console.log('\nleft behind, with their reference to the deleted account set to null:')
console.log(`    ${orphanedRfqs} RFQ(s) created by a demo account`)
console.log(`    ${orphanedAudits} audit record(s) actioned by a demo account`)
console.log(
  '\nnot touched: organizations, products, and any seeded RFQ — none of these carry\n' +
    'a demo flag, so remove them from the admin portal where you can see what they are.'
)

if (!confirmed) {
  console.log('\nDry run. Re-run with --confirm to apply.')
  await db.$disconnect()
  process.exit(0)
}

if (demoUsers.length === 0 && demoShipments.length === 0 && sampleArticles.length === 0) {
  console.log('\nNothing to purge.')
  await db.$disconnect()
  process.exit(0)
}

// --- Apply -----------------------------------------------------------------
// One transaction: a half-purged database, with accounts gone but their demo
// content still on the public site, is worse than either outcome.

await db.$transaction(async (tx) => {
  for (const user of demoUsers) {
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'user.deleted',
        entityType: 'User',
        entityId: user.id,
        changes: { before: { email: user.email, role: user.role }, reason: 'demo data purge' },
        userAgent: 'scripts/purge-demo-data.mts',
      },
    })
  }

  await tx.newsArticle.deleteMany({ where: { isSample: true } })
  await tx.shipment.deleteMany({ where: { isDemo: true } })
  await tx.user.deleteMany({ where: { email: { endsWith: DEMO_SUFFIX } } })
})

console.log(
  `\nDeleted ${demoUsers.length} account(s), ${demoShipments.length} shipment(s) and ` +
    `${sampleArticles.length} article(s). Each deleted account has an AuditLog entry.`
)

await db.$disconnect()
