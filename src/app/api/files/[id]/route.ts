import { getSessionUser } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { can } from '@/lib/rbac'
import { getStorageProvider } from '@/lib/storage'

/**
 * Authorized download.
 *
 * A `StoredFile` id alone MUST NOT grant access. Every request re-checks that
 * the caller may read the owning organization's data, and an unauthorized
 * request receives 404 rather than 403 so the endpoint cannot be used to probe
 * which ids exist.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // A malformed id is indistinguishable from a missing one.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response('Not found', { status: 404 })
  }

  const user = await getSessionUser()
  if (!user) return new Response('Not found', { status: 404 })

  const file = await db.storedFile.findFirst({
    where: { id, deletedAt: null },
    select: {
      key: true,
      originalName: true,
      mimeType: true,
      organizationId: true,
      uploadedById: true,
    },
  })
  if (!file) return new Response('Not found', { status: 404 })

  // Staff with a global read permission may fetch any file; everyone else is
  // confined to their own organization, or to files they uploaded themselves.
  const isStaffReader = can(user.role, 'shipment:read:all') || can(user.role, 'rfq:read:all')
  const ownsIt =
    file.uploadedById === user.id ||
    (file.organizationId !== null && file.organizationId === user.organizationId)

  if (!isStaffReader && !ownsIt) {
    return new Response('Not found', { status: 404 })
  }

  const storage = getStorageProvider()

  // S3 issues a short-lived signed URL; local storage streams through here.
  const signed = await storage.getSignedUrl(file.key, 60)
  if (signed) {
    return Response.redirect(signed, 302)
  }

  const body = await storage.get(file.key)
  if (!body) return new Response('Not found', { status: 404 })

  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': file.mimeType,
      // `attachment` prevents a stored HTML/SVG payload rendering in-origin.
      'Content-Disposition': `attachment; filename="${file.originalName.replace(/"/g, '')}"`,
      'Content-Length': String(body.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export const runtime = 'nodejs'
