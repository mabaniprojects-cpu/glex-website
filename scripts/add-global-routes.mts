import 'dotenv/config'
import { GLEX_COMPANY } from '../src/lib/company'
import { db } from '../src/lib/db'
import { ROUTES, routeSeedId } from './routes-data'

/**
 * Loads the trade lanes into a database that is ALREADY seeded.
 *
 *   npx tsx scripts/add-global-routes.mts            # dry run
 *   npx tsx scripts/add-global-routes.mts --confirm  # apply
 *
 * `prisma/seed.ts` carries the same list from the same module, but the seed
 * only ever runs against a fresh database. Production was seeded by the
 * catalogue import alone, so it went live with a single lane to Nairobi on a
 * page titled "Connecting Saudi Arabia to Global Markets". This is how the
 * rest get there.
 *
 * The routes drive the map and the written list on /network, and the animated
 * map that stands in for the home-page photograph. They are content, not code:
 * the same records can be edited at Admin -> Routes afterwards.
 *
 * Safe to run repeatedly. A route is matched by the id the seed would give it
 * AND by its label, so it is never duplicated — not by a second run, and not
 * because someone typed the same lane into the admin portal first. Existing
 * rows are left exactly as they are: someone may have corrected a label or
 * switched a lane off, and this must not undo that.
 *
 * Every row written logs an AuditLog entry. The actor is null: this runs from
 * a terminal, not as a signed-in user.
 */

const office = GLEX_COMPANY.office
const confirmed = process.argv.includes('--confirm')

const planned = await Promise.all(
  ROUTES.map(async (route, index) => {
    const existing = await db.globalRoute.findFirst({
      where: { OR: [{ id: routeSeedId(index) }, { label: route.label }] },
      select: { id: true, isActive: true },
    })
    return { route, index, existing }
  })
)

console.log(`${ROUTES.length} trade lanes from ${office.city}\n`)

for (const { route, existing } of planned) {
  const state = existing
    ? existing.isActive
      ? 'already present'
      : 'already present (switched off — left alone)'
    : 'MISSING — will be added'
  console.log(`  ${route.label.padEnd(24)} ${state}`)
}

const missing = planned.filter((entry) => !entry.existing)

console.log(`\n${planned.length - missing.length} present, ${missing.length} missing.`)

if (missing.length === 0) {
  console.log('Nothing to do.')
  await db.$disconnect()
  process.exit(0)
}

if (!confirmed) {
  console.log(`Dry run — nothing was written. Re-run with --confirm to add ${missing.length}.`)
  await db.$disconnect()
  process.exit(0)
}

await db.$transaction(async (tx) => {
  for (const { route, index } of missing) {
    const created = await tx.globalRoute.create({
      data: {
        id: routeSeedId(index),
        label: route.label,
        originName: office.city,
        originLat: office.latitude,
        originLng: office.longitude,
        destName: route.destName,
        destLat: route.destLat,
        destLng: route.destLng,
        mode: route.mode,
        sortOrder: index,
        isActive: true,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'route.created',
        entityType: 'GlobalRoute',
        entityId: created.id,
        changes: { before: null, after: { label: created.label, destName: created.destName } },
      },
    })
  }
})

console.log(`\nAdded ${missing.length} route(s). Live on /network.`)
await db.$disconnect()
