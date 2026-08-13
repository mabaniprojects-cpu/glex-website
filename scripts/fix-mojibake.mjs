/**
 * Repairs two kinds of encoding damage:
 *   1. A UTF-8 BOM (U+FEFF) prepended to a source file.
 *   2. Mojibake — UTF-8 bytes that were decoded as Latin-1 and re-encoded.
 *
 * Replacements are explicit rather than a blanket Latin-1 round-trip, so files
 * containing legitimate non-Latin text (Arabic, Chinese) are never touched.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { glob } from 'node:fs/promises'

/** Ordered longest-first so shorter sequences cannot match a prefix. */
const MOJIBAKE = [
  ['â€”', '—'], // â€” -> em dash
  ['â€“', '–'], // â€“ -> en dash
  ['â€™', '’'], // â€™ -> right single quote
  ['â€œ', '“'], // â€œ -> left double quote
  ['â€¦', '…'], // â€¦ -> ellipsis
  ['â†’', '→'], // â†’ -> right arrow
  ['Â®', '®'], // Â®  -> registered
  ['Â ', ' '], // Â   -> nbsp
  ['Â·', '·'], // Â·  -> middle dot
]

let repaired = 0

for await (const file of glob('src/**/*.{ts,tsx}')) {
  const original = await readFile(file, 'utf8')
  let text = original

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  for (const [bad, good] of MOJIBAKE) text = text.split(bad).join(good)

  if (text === original) continue

  await writeFile(file, text, 'utf8')
  repaired += 1
  console.log(`fixed ${file}`)
}

console.log(`\nrepaired ${repaired} file(s)`)
