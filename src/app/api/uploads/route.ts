import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { getSessionUser } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { getStorageProvider } from '@/lib/storage'
import { buildKey, scanForMalware, validateUpload } from '@/lib/storage/validation'

/**
 * Upload endpoint.
 *
 * A route handler is directly reachable, so it performs its own authentication
 * and validation rather than trusting any caller. The response deliberately
 * returns only the `StoredFile` id — never a storage key, URL or path.
 *
 * Two of the purposes are reachable without a session, because the supplier
 * registration form asks for a logo and for company documents several steps
 * before the account it would authenticate against exists. Requiring a user
 * here made both uploads fail with "an unexpected error" for every applicant,
 * while staff — who are signed in — saw them work.
 *
 * The resulting row is deliberately ownerless; `submitSupplierRegistration`
 * claims it for the new organization once the application is committed, and
 * `/api/files/[id]` refuses an ownerless file to everyone but staff.
 */
const ANONYMOUS_PURPOSES = new Set(['supplier-logo', 'supplier-documents'])

export async function POST(request: Request) {
  const user = await getSessionUser()

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }

  const file = form.get('file')
  const purpose = String(form.get('purpose') ?? 'uploads')

  /**
   * An applicant gets a tighter budget than a signed-in user, keyed to the
   * address rather than an account: enough for a logo and the documents a
   * registration asks for, not enough to use the endpoint as free storage.
   */
  if (!user) {
    if (!ANONYMOUS_PURPOSES.has(purpose)) {
      return Response.json({ error: 'unauthorized' }, { status: 401 })
    }

    const ip = clientIp(await headers())
    const anonymous = await checkRateLimit(`upload-anon:${ip}`, 25, 60 * 60)
    if (!anonymous.allowed) {
      return Response.json({ error: 'rate_limited' }, { status: 429 })
    }
  } else {
    const limit = await checkRateLimit(`upload:${user.id}`, 40, 60 * 60)
    if (!limit.allowed) {
      return Response.json({ error: 'rate_limited' }, { status: 429 })
    }
  }

  if (!(file instanceof File)) {
    return Response.json({ error: 'missing_file' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // The declared type and filename are attacker-controlled; the real type is
  // determined by sniffing the file's own bytes.
  const validation = validateUpload(buffer, file.type, file.name)
  if (!validation.ok) {
    return Response.json(
      { error: validation.reason, ...('maxMb' in validation ? { maxMb: validation.maxMb } : {}) },
      { status: 400 }
    )
  }

  const scan = await scanForMalware(buffer)
  if (scan.clean === false && !scan.detail.startsWith('not_scanned')) {
    return Response.json({ error: 'malware_detected' }, { status: 400 })
  }

  try {
    const key = buildKey(purpose, validation.originalName, validation.mime)
    await getStorageProvider().put({ key, body: buffer, contentType: validation.mime })

    const stored = await db.storedFile.create({
      data: {
        key,
        originalName: validation.originalName,
        mimeType: validation.mime,
        size: validation.size,
        checksum: createHash('sha256').update(buffer).digest('hex'),
        provider: getStorageProvider().name,
        uploadedById: user?.id ?? null,
        organizationId: user?.organizationId ?? null,
        // Recorded honestly: no scanner is configured in this deployment.
        scannedAt: new Date(),
        scanResult: scan.detail,
      },
      select: { id: true, originalName: true, size: true },
    })

    return Response.json(stored, { status: 201 })
  } catch (error) {
    console.error('[uploads] Failed to store file:', error)
    return Response.json({ error: 'server' }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ error: 'method_not_allowed' }, { status: 405 })
}

/** Storage and Prisma both need Node APIs. */
export const runtime = 'nodejs'
