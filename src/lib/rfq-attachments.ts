import { db } from '@/lib/db'

/**
 * Narrows a list of submitted file ids to those the submitter actually owns.
 *
 * A Server Action payload is attacker-controlled, so an RFQ submission can name
 * any file id in the system. Attaching a stranger's document to your own RFQ
 * would then hand it to you via the confirmation page — so ownership is
 * re-read from the database rather than trusted.
 *
 * Guests have no session and therefore no uploads: `userId` is null for them
 * and nothing is ever attached.
 */
export async function resolveOwnedAttachments(
  userId: string | null,
  submittedIds: readonly string[] | undefined,
  limit = 5
): Promise<string[]> {
  if (!userId || !submittedIds?.length) return []

  const owned = await db.storedFile.findMany({
    where: {
      id: { in: [...submittedIds] },
      uploadedById: userId,
      deletedAt: null,
    },
    select: { id: true },
  })

  // Capped as well as scoped: the schema limit is a client-side promise, and
  // this is the server's own.
  return owned.slice(0, limit).map((file) => file.id)
}
