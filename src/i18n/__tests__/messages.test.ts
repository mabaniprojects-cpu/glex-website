import { describe, expect, it } from 'vitest'
import ar from '../../../messages/ar.json'
import de from '../../../messages/de.json'
import en from '../../../messages/en.json'
import fr from '../../../messages/fr.json'
import zhCN from '../../../messages/zh-CN.json'
import { locales } from '../routing'

/**
 * The guard against silently broken translations.
 *
 * Every locale must expose the same key set as English with the same ICU
 * placeholders, or the UI will render blanks or crash at runtime in that
 * language only — a failure mode that is easy to ship and hard to notice.
 */

type Tree = { [key: string]: string | Tree }

const CATALOGUES: Record<string, Tree> = {
  en: en as Tree,
  ar: ar as Tree,
  de: de as Tree,
  fr: fr as Tree,
  'zh-CN': zhCN as Tree,
}

function flatten(tree: Tree, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out.set(path, value)
    else flatten(value, path, out)
  }
  return out
}

/**
 * Placeholder names only. The identifier must be followed by `}` or `,` so an
 * ICU plural body such as `=0 {No products}` is not read as a placeholder.
 */
function placeholders(value: string): Set<string> {
  const names = [...value.matchAll(/\{\s*([A-Za-z0-9_]+)\s*[},]/g)].map((m) => m[1]!)
  return new Set(names.filter((n) => !['plural', 'select', 'selectordinal'].includes(n)))
}

const english = flatten(CATALOGUES.en!)
const otherLocales = locales.filter((l) => l !== 'en')

describe('message catalogues', () => {
  it('ships a catalogue for every configured locale', () => {
    for (const locale of locales) {
      expect(CATALOGUES[locale], `missing catalogue for ${locale}`).toBeDefined()
    }
  })

  it('has a non-trivial English source catalogue', () => {
    expect(english.size).toBeGreaterThan(500)
  })

  describe.each(otherLocales)('%s', (locale) => {
    const target = flatten(CATALOGUES[locale]!)

    it('has no missing keys', () => {
      const missing = [...english.keys()].filter((key) => !target.has(key))
      expect(missing, `missing in ${locale}`).toEqual([])
    })

    it('has no extra keys', () => {
      const extra = [...target.keys()].filter((key) => !english.has(key))
      expect(extra, `unexpected in ${locale}`).toEqual([])
    })

    it('has no empty values', () => {
      const empty = [...target.entries()].filter(([, value]) => value.trim() === '').map(([k]) => k)
      expect(empty, `empty values in ${locale}`).toEqual([])
    })

    it('preserves every ICU placeholder', () => {
      const broken: string[] = []
      for (const [key, source] of english) {
        const translated = target.get(key)
        if (translated === undefined) continue
        for (const name of placeholders(source)) {
          if (!placeholders(translated).has(name)) broken.push(`${key} → {${name}}`)
        }
      }
      expect(broken, `lost placeholders in ${locale}`).toEqual([])
    })
  })
})
