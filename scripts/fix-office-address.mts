import 'dotenv/config'
import { db } from '../src/lib/db'

/**
 * Corrects the office address stored in the database.
 *
 *   npx tsx scripts/fix-office-address.mts            # dry run
 *   npx tsx scripts/fix-office-address.mts --confirm  # apply
 *
 * The office is Floor 10, Office 03. The code was corrected on 2026-09-13, but
 * two copies of the old address are content rather than code — the Office row
 * behind the contact page and the FAQ answer to "Where is GLEX based?" — so a
 * deploy does not reach them.
 *
 * Only the exact old string is replaced, only in those two places, and each
 * change writes an AuditLog row with the before and after text. The actor is
 * recorded as null: this runs from a terminal, not as a signed-in user.
 */

const OLD = 'Floor 15, Offices 03 and 04'
const NEW = 'Floor 10, Office 03'

const confirmed = process.argv.includes('--confirm')

const offices = (
  await db.office.findMany({ select: { id: true, name: true, addressLines: true } })
).filter((o) => o.addressLines.some((line) => line.includes(OLD)))

const faqs = (
  await db.faqEntry.findMany({ select: { id: true, question: true, answer: true, locale: true } })
).filter((f) => f.answer.includes(OLD))

console.log(`Replacing "${OLD}" with "${NEW}"\n`)
console.log(`Office rows: ${offices.length}`)
for (const o of offices) console.log(`  ${o.name}: ${o.addressLines.join(' / ')}`)
console.log(`FAQ answers: ${faqs.length}`)
for (const f of faqs) console.log(`  [${f.locale}] ${f.question}`)

if (offices.length === 0 && faqs.length === 0) {
  console.log('\nNothing carries the old address. Nothing to do.')
  await db.$disconnect()
  process.exit(0)
}

if (!confirmed) {
  console.log('\nDry run — nothing was written. Re-run with --confirm to apply.')
  await db.$disconnect()
  process.exit(0)
}

await db.$transaction(async (tx) => {
  for (const o of offices) {
    const addressLines = o.addressLines.map((line) => line.replaceAll(OLD, NEW))
    await tx.office.update({ where: { id: o.id }, data: { addressLines } })
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'office.address_corrected',
        entityType: 'Office',
        entityId: o.id,
        changes: { before: { addressLines: o.addressLines }, after: { addressLines } },
      },
    })
  }

  for (const f of faqs) {
    const answer = f.answer.replaceAll(OLD, NEW)
    await tx.faqEntry.update({ where: { id: f.id }, data: { answer } })
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'faq.address_corrected',
        entityType: 'FaqEntry',
        entityId: f.id,
        changes: { before: { answer: f.answer }, after: { answer } },
      },
    })
  }
})

console.log(`\nCorrected ${offices.length} office row(s) and ${faqs.length} FAQ answer(s).`)
await db.$disconnect()
