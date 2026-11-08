import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ANONYMOUS_UPLOAD_PURPOSES,
  SUPPLIER_DOCUMENTS_PURPOSE,
  SUPPLIER_LOGO_PURPOSE,
} from '@/lib/storage/purposes'
import { ALLOWED_TYPES } from '@/lib/storage/validation'

/**
 * A purpose string is agreed between a component and a route handler that
 * never import each other, and the penalty for disagreeing is a 401 the
 * applicant sees as "an unexpected error". The form once posted
 * "supplier-logos" to an endpoint allowing "supplier-logo", which refused
 * every company logo for as long as it was live.
 */
const FORM = path.resolve(process.cwd(), 'src/components/supplier/registration-form.tsx')

describe('the registration form and the upload endpoint agree', () => {
  it('allows exactly the two purposes registration uses', () => {
    expect([...ANONYMOUS_UPLOAD_PURPOSES].sort()).toEqual(
      [SUPPLIER_LOGO_PURPOSE, SUPPLIER_DOCUMENTS_PURPOSE].sort()
    )
  })

  it('does not let the form name a purpose as a bare string', async () => {
    const source = await readFile(FORM, 'utf8')

    // Either uploader passing a literal is the drift this guards against.
    expect(source).not.toMatch(/purpose="/)
    expect(source).toContain('purpose={SUPPLIER_LOGO_PURPOSE}')
    expect(source).toContain('purpose={SUPPLIER_DOCUMENTS_PURPOSE}')
  })

  it('only offers logo formats the server will actually store', async () => {
    const source = await readFile(FORM, 'utf8')
    const accept = source.match(/accept="([^"]+)"/)?.[1]
    expect(accept).toBeDefined()

    const extensions = Object.values(ALLOWED_TYPES).flat() as string[]
    for (const offered of accept!.split(',')) {
      // An extension in the picker that the server refuses is a rejection
      // the applicant only discovers after choosing the file. SVG was one.
      expect(extensions).toContain(offered.replace('.', ''))
    }
  })
})
