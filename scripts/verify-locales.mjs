/**
 * Verifies that every locale catalogue matches the English source exactly:
 * identical recursive key set, no empty values, and matching ICU placeholders.
 *
 * Run: node scripts/verify-locales.mjs
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const LOCALES = ['en', 'ar', 'de', 'fr', 'zh-CN']
const DIR = path.resolve(process.cwd(), 'messages')

/** Flattens to `a.b.c` → value. */
function flatten(obj, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, full, out)
    } else {
      out.set(full, value)
    }
  }
  return out
}

/**
 * Extracts `{placeholder}` names.
 *
 * The identifier must be followed by `}` or `,` so that ICU plural *bodies*
 * such as `=0 {No products}` are not mistaken for a placeholder named `No`.
 */
function placeholders(value) {
  if (typeof value !== 'string') return new Set()
  return new Set([...value.matchAll(/\{\s*([A-Za-z0-9_]+)\s*[},]/g)].map((m) => m[1]))
}

const catalogues = new Map()
for (const locale of LOCALES) {
  const raw = await readFile(path.join(DIR, `${locale}.json`), 'utf8')
  if (raw.charCodeAt(0) === 0xfeff) throw new Error(`${locale}.json has a BOM`)
  catalogues.set(locale, flatten(JSON.parse(raw)))
}

const base = catalogues.get('en')
let failures = 0

console.log(`en.json: ${base.size} keys\n`)

for (const locale of LOCALES.filter((l) => l !== 'en')) {
  const target = catalogues.get(locale)
  const problems = []

  for (const key of base.keys()) {
    if (!target.has(key)) problems.push(`missing key: ${key}`)
  }
  for (const key of target.keys()) {
    if (!base.has(key)) problems.push(`extra key: ${key}`)
  }
  for (const [key, value] of target) {
    if (typeof value === 'string' && value.trim() === '') {
      problems.push(`empty value: ${key}`)
    }
    if (!base.has(key)) continue
    const expected = placeholders(base.get(key))
    const actual = placeholders(value)
    for (const name of expected) {
      // ICU plural category names are not placeholders.
      if (['plural', 'select', 'selectordinal'].includes(name)) continue
      if (!actual.has(name)) problems.push(`placeholder {${name}} lost in: ${key}`)
    }
  }

  const status = problems.length === 0 ? 'OK' : `${problems.length} PROBLEM(S)`
  console.log(`${locale.padEnd(6)} ${String(target.size).padStart(4)} keys  ${status}`)
  for (const problem of problems.slice(0, 10)) console.log(`         · ${problem}`)
  if (problems.length > 10) console.log(`         · …and ${problems.length - 10} more`)
  failures += problems.length
}

console.log(failures === 0 ? '\nAll locales verified.' : `\n${failures} problem(s) found.`)
process.exit(failures === 0 ? 0 : 1)
