/**
 * Detects mojibake (UTF-8 decoded as Latin-1 then re-encoded) and stray BOMs
 * across source, message catalogues and seed data.
 *
 * Run: node scripts/check-encoding.mjs
 */
import { readFile } from 'node:fs/promises'
import { glob } from 'node:fs/promises'

/** Sequences that only ever appear as a result of double-encoding. */
const MOJIBAKE = ['â€”', 'â€“', 'â€™', 'â€œ', 'â€¦', 'â†’', 'Â®', 'Â·', 'Ã©', 'Ã¨', 'Ø§Ù']

const PATTERNS = ['src/**/*.{ts,tsx}', 'messages/*.json', 'prisma/*.ts', 'e2e/*.ts']

let scanned = 0
let bad = 0

for (const pattern of PATTERNS) {
  for await (const file of glob(pattern)) {
    scanned += 1
    const text = await readFile(file, 'utf8')

    const problems = []
    if (text.charCodeAt(0) === 0xfeff) problems.push('BOM')
    for (const sequence of MOJIBAKE) {
      if (text.includes(sequence)) problems.push(`mojibake "${sequence}"`)
    }
    if (text.includes('�')) problems.push('replacement character')

    if (problems.length > 0) {
      bad += 1
      console.log(`BAD  ${file}\n     ${problems.join(', ')}`)
    }
  }
}

console.log(`\nscanned ${scanned} files — ${bad === 0 ? 'all clean' : `${bad} with problems`}`)
process.exit(bad === 0 ? 0 : 1)
