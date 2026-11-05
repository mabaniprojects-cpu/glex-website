import type { UserRole } from '@prisma/client'
import { db } from '@/lib/db'
import { can } from '@/lib/rbac'

/**
 * What is sitting unattended, counted from the records themselves.
 *
 * Derived rather than stored. A notification row can be dismissed, missed,
 * or never written — the `Notification` table in this schema is read by the
 * client dashboard and written by nothing, which is how a supplier sat
 * unreviewed from the 8th of October without anyone seeing a thing. A count
 * taken from the suppliers themselves cannot drift from the truth: while one
 * is waiting, the number is not zero, and clearing it means doing the work.
 *
 * The email notification still goes out. This is the second line: an email
 * can be deleted, filed, or lost in a shared mailbox, and a number in the
 * header cannot.
 */

export type StaffAlerts = {
  /** Suppliers who have applied and are waiting on GLEX. */
  suppliersAwaitingReview: number
  total: number
}

const NONE: StaffAlerts = { suppliersAwaitingReview: 0, total: 0 }

/**
 * Counts what this person can actually act on.
 *
 * Returns zero for anyone without the permission rather than hiding the
 * badge in the view — a count someone cannot act on is noise, and computing
 * it for every signed-out visitor would put a query on every public page.
 */
export async function staffAlerts(role: UserRole | null | undefined): Promise<StaffAlerts> {
  if (!role || !can(role, 'supplier:read:all')) return NONE

  // SUBMITTED and UNDER_REVIEW are the states waiting on GLEX.
  // CLARIFICATION_REQUIRED is waiting on the supplier, so it is not counted:
  // a number that includes work you cannot do is a number people learn to
  // ignore.
  const suppliersAwaitingReview = await db.supplierProfile.count({
    where: { deletedAt: null, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
  })

  return { suppliersAwaitingReview, total: suppliersAwaitingReview }
}
