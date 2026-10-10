import 'dotenv/config'
import { ShipmentMode } from '@prisma/client'
import { GLEX_COMPANY } from '../src/lib/company'
import { db } from '../src/lib/db'

/**
 * Adds the two Sudanese Red Sea ports to the trade-route list.
 *
 *   npx tsx scripts/add-global-routes.mts            # dry run
 *   npx tsx scripts/add-global-routes.mts --confirm  # apply
 *
 * The routes drive the map and the written list on /network, and the animated
 * map that stands in for the home-page photograph. They are content, not code:
 * the same records can be edited at Admin -> Routes.
 *
 * The ids are the ones `prisma/seed.ts` would give these two entries, so a
 * seed run against a fresh database upserts them rather than making a second
 * copy. Running this twice changes nothing the second time.
 *
 * Every change writes an AuditLog row. The actor is null: this runs from a
 * terminal, not as a signed-in user.
 */

const office = GLEX_COMPANY.office
const confirmed = process.argv.includes('--confirm')

/** `00000000-0000-4000-8100-<index>` — the seed's scheme, continued. */
const seedId = (index: number) => `00000000-0000-4000-8100-${String(index).padStart(12, '0')}`

const ROUTES = [
  {
    id: seedId(10),
    label: 'Jeddah → Port Sudan',
    destName: 'Port Sudan',
    destLat: 19.6192,
    destLng: 37.2117,
    sortOrder: 10,
  },
  {
    id: seedId(11),
    label: 'Jeddah → Sawakin',
    destName: 'Sawakin',
    destLat: 19.1019,
    destLng: 37.3286,
    sortOrder: 11,
  },
] as const

console.log(`Adding ${ROUTES.length} ocean route(s) from ${office.city}\n`)

const planned: { route: (typeof ROUTES)[number]; existing: boolean }[] = []

for (const route of ROUTES) {
  // By label as well as by id: a route someone already typed into the admin
  // portal must not be duplicated just because it carries a different id.
  const existing = await db.globalRoute.findFirst({
    where: { OR: [{ id: route.id }, { label: route.label }] },
    select: { id: true, label: true, isActive: true },
  })

  console.log(`  ${route.label}`)
  console.log(`    to:   ${route.destName} (${route.destLat}, ${route.destLng})`)
  console.log(`    now:  ${existing ? 'already present — will be left alone' : 'not present'}`)

  planned.push({ route, existing: Boolean(existing) })
}

const toAdd = planned.filter((entry) => !entry.existing)

if (toAdd.length === 0) {
  console.log('\nBoth routes are already in place; nothing to do.')
  await db.$disconnect()
  process.exit(0)
}

if (!confirmed) {
  console.log(`\nDry run — nothing was written. Re-run with --confirm to add ${toAdd.length}.`)
  await db.$disconnect()
  process.exit(0)
}

await db.$transaction(async (tx) => {
  for (const { route } of toAdd) {
    const created = await tx.globalRoute.create({
      data: {
        id: route.id,
        label: route.label,
        originName: office.city,
        originLat: office.latitude,
        originLng: office.longitude,
        destName: route.destName,
        destLat: route.destLat,
        destLng: route.destLng,
        mode: ShipmentMode.OCEAN,
        sortOrder: route.sortOrder,
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

console.log(`\nAdded ${toAdd.length} route(s). Live on /network.`)
await db.$disconnect()
