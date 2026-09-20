import 'dotenv/config'
import { Locale } from '@prisma/client'
import { db } from '../src/lib/db'
import { FAQ } from './faq-data'

/**
 * Loads the FAQ into a database, in English and Arabic.
 *
 *   npx tsx scripts/import-faq.mts            # dry run
 *   npx tsx scripts/import-faq.mts --confirm  # apply
 *
 * The FAQ is also what the GLEX Assistant answers from while no AI provider is
 * configured, so this is assistant content as much as page content.
 *
 * Matched on question text within a locale, because the table has no natural
 * key: an entry whose wording is unchanged is updated in place, and a reworded
 * question creates a new entry. Nothing is deleted — an entry that disappears
 * from this file stays in the database until someone removes it in the admin
 * portal, which is the safer direction for content a person may have edited.
 */

const confirmed = process.argv.includes('--confirm')

const existing = await db.faqEntry.findMany({
  select: { id: true, question: true, locale: true },
})
const idFor = new Map(existing.map((row) => [`${row.locale}::${row.question}`, row.id]))

type Planned = { locale: Locale; question: string; answer: string; category: string; order: number }

const planned: Planned[] = FAQ.flatMap((entry, index) => [
  {
    locale: Locale.en,
    question: entry.en.question,
    answer: entry.en.answer,
    category: entry.category,
    order: index,
  },
  {
    locale: Locale.ar,
    question: entry.ar.question,
    answer: entry.ar.answer,
    category: entry.category,
    order: index,
  },
])

const creating = planned.filter((row) => !idFor.has(`${row.locale}::${row.question}`))
const updating = planned.length - creating.length

console.log(`Entries in this file: ${FAQ.length} questions x 2 languages = ${planned.length}`)
console.log(`Already present:      ${updating} (updated in place)`)
console.log(`New:                  ${creating.length}`)
console.log(`Untouched in the database: ${existing.length - updating}\n`)

for (const row of creating) {
  console.log(`  create  [${row.locale}] ${row.question}`)
}

if (!confirmed) {
  console.log('\nDry run — nothing was written. Re-run with --confirm to apply.')
  await db.$disconnect()
  process.exit(0)
}

for (const row of planned) {
  const id = idFor.get(`${row.locale}::${row.question}`)

  if (id) {
    await db.faqEntry.update({
      where: { id },
      data: {
        answer: row.answer,
        category: row.category,
        sortOrder: row.order,
        isActive: true,
      },
    })
  } else {
    await db.faqEntry.create({
      data: {
        question: row.question,
        answer: row.answer,
        locale: row.locale,
        category: row.category,
        sortOrder: row.order,
        isActive: true,
      },
    })
  }
}

const total = await db.faqEntry.count({ where: { isActive: true } })
console.log(`\nDone. ${total} active FAQ entries, which is also what the assistant answers from.`)
await db.$disconnect()
