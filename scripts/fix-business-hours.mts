import 'dotenv/config'
import { GLEX_COMPANY } from '../src/lib/company'
import { db } from '../src/lib/db'

/**
 * Sets the office opening hours to what the company actually works.
 *
 *   npx tsx scripts/fix-business-hours.mts            # dry run
 *   npx tsx scripts/fix-business-hours.mts --confirm  # apply
 *
 * The hours are content, not code: they live on the Office record, and the
 * contact page reads them from there. The seeded value said 09:00 to 18:00,
 * and the page had a third answer typed into it. This makes all of them say
 * 08:00 to 17:00, Sunday to Thursday.
 *
 * Every change writes an AuditLog row with the before and after. The actor is
 * null: this runs from a terminal, not as a signed-in user.
 */

const HOURS = [...GLEX_COMPANY.office.businessHours]
const confirmed = process.argv.includes('--confirm')

const offices = await db.office.findMany({
  select: { id: true, name: true, city: true, businessHours: true },
})

const summarise = (value: unknown) => {
  if (!Array.isArray(value)) return '(none recorded)'
  const open = value.filter(
    (entry): entry is { day: string; open: string; close: string } =>
      typeof entry === 'object' && entry !== null && 'open' in entry && Boolean(entry.open)
  )
  if (open.length === 0) return '(closed every day)'
  return `${open.length} open day(s), ${open[0]!.open}–${open[0]!.close}`
}

console.log(`Setting hours to ${HOURS[0]!.open}–${HOURS[0]!.close}, Sunday to Thursday\n`)

for (const office of offices) {
  console.log(`  ${office.name}, ${office.city}`)
  console.log(`    now:  ${summarise(office.businessHours)}`)
  console.log(`    next: 5 open day(s), ${HOURS[0]!.open}–${HOURS[0]!.close}`)
}

if (offices.length === 0) {
  console.log('No office records found; nothing to change.')
  await db.$disconnect()
  process.exit(0)
}

if (!confirmed) {
  console.log('\nDry run — nothing was written. Re-run with --confirm to apply.')
  await db.$disconnect()
  process.exit(0)
}

await db.$transaction(async (tx) => {
  for (const office of offices) {
    await tx.office.update({ where: { id: office.id }, data: { businessHours: HOURS } })

    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'office.hours_updated',
        entityType: 'Office',
        entityId: office.id,
        changes: {
          before: { businessHours: office.businessHours },
          after: { businessHours: HOURS },
        },
      },
    })
  }
})

console.log(`\nUpdated ${offices.length} office record(s).`)
await db.$disconnect()
