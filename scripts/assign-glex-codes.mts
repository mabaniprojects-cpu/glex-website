import 'dotenv/config'
import { nextCode } from '../src/lib/catalogue-code'
import { db } from '../src/lib/db'
import { guessType } from '../src/lib/import/product-type'

/**
 * Gives a GLEX catalogue number to every product that has none.
 *
 *   npx tsx scripts/assign-glex-codes.mts            # dry run
 *   npx tsx scripts/assign-glex-codes.mts --confirm  # apply
 *
 * A code is permanent once issued — it goes on quotations and buyers quote
 * it back — so this never touches a product that already has one, and the
 * dry run prints every proposal for reading before anything is written.
 *
 * The type is guessed from the product name and confirmed by eye here. A
 * product the guesser cannot place gets GEN, which is listed separately at
 * the end: GEN sorts into one undifferentiated heap, which is the thing
 * these codes exist to avoid, so those are worth naming properly.
 */

const confirmed = process.argv.includes('--confirm')

const [products, taken] = await Promise.all([
  db.product.findMany({
    where: { deletedAt: null, glexCode: null },
    select: {
      id: true,
      name: true,
      hsCode: true,
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  }),
  db.product.findMany({
    where: { glexCode: { not: null } },
    select: { glexCode: true },
  }),
])

const issued = new Set(taken.map((row) => row.glexCode!))

console.log(`products without a code : ${products.length}`)
console.log(`codes already issued    : ${issued.size}\n`)

if (products.length === 0) {
  console.log('Nothing to do.')
  await db.$disconnect()
  process.exit(0)
}

const planned: { id: string; name: string; code: string; type: string }[] = []

for (const product of products) {
  const type = guessType(product.name, product.category?.name)

  // The size lives in the name for this catalogue — "Steel Rebar 16mm" —
  // so the digits come from there. Where the name carries none, the code is
  // the type plus a variant letter, which is still unique and still sorts.
  const code = nextCode({ type, size: product.name }, issued)
  issued.add(code)

  planned.push({ id: product.id, name: product.name, code, type })
}

const unplaced = planned.filter((entry) => entry.type === 'GEN')

for (const entry of planned.filter((e) => e.type !== 'GEN')) {
  console.log(`  ${entry.code.padEnd(16)} ${entry.name}`)
}

if (unplaced.length > 0) {
  console.log(`\n  ${unplaced.length} product(s) the type guesser could not place:`)
  for (const entry of unplaced) console.log(`  ${entry.code.padEnd(16)} ${entry.name}`)
  console.log('\n  Add a rule to src/lib/import/product-type.ts rather than')
  console.log('  letting these keep a GEN code — a code is permanent.')
}

if (!confirmed) {
  console.log(`\nDry run — nothing written. Re-run with --confirm to assign ${planned.length}.`)
  await db.$disconnect()
  process.exit(0)
}

await db.$transaction(async (tx) => {
  for (const entry of planned) {
    await tx.product.update({ where: { id: entry.id }, data: { glexCode: entry.code } })
  }

  await tx.auditLog.create({
    data: {
      actorId: null,
      action: 'product.codes_assigned',
      entityType: 'Product',
      entityId: planned[0]!.id,
      changes: { after: { assigned: planned.length, unplaced: unplaced.length } },
    },
  })
})

console.log(`\nAssigned ${planned.length} catalogue numbers.`)
await db.$disconnect()
