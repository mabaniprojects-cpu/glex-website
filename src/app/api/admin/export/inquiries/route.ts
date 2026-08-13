import { requirePermission } from '@/lib/auth-guards'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { toCsv } from '@/lib/admin'

/**
 * CSV export of contact inquiries.
 *
 * A route handler is directly reachable, so it repeats the permission check
 * rather than trusting any surrounding layout. The export itself is audited,
 * because bulk extraction of contact data is exactly the sort of action an
 * operator may later need to account for.
 *
 * Note: message bodies, IP addresses and user agents are deliberately excluded.
 */
const COLUMNS = [
  'reference',
  'type',
  'status',
  'fullName',
  'company',
  'country',
  'subject',
  'createdAt',
]

export async function GET() {
  const user = await requirePermission('inquiry:read')

  const rows = await db.contactInquiry.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: {
      reference: true,
      type: true,
      status: true,
      fullName: true,
      company: true,
      country: true,
      subject: true,
      createdAt: true,
    },
  })

  await recordAudit({
    actorId: user.id,
    action: 'inquiry.exported',
    entityType: 'ContactInquiry',
    after: { rows: rows.length },
  })

  const csv = toCsv(rows, COLUMNS)
  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(`﻿${csv}`, {
    headers: {
      // The BOM makes Excel open UTF-8 correctly.
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="glex-inquiries-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
