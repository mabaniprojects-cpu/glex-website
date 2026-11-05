import { Bell } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { StaffAlerts } from '@/lib/staff-alerts'

/**
 * What is waiting for a member of staff, in the header where they will see it.
 *
 * A link with a number, not a dropdown: there is one destination, and the
 * whole point is to be noticed rather than to be interacted with. It renders
 * nothing at all when the count is zero, so it never becomes furniture that
 * the eye stops registering.
 *
 * The number is derived from the suppliers themselves (`staffAlerts`), so it
 * cannot be dismissed into silence. It clears when the work is done.
 */
export async function ReviewBell({ alerts }: { alerts: StaffAlerts }) {
  if (alerts.total === 0) return null

  const t = await getTranslations('admin.alerts')

  const label =
    alerts.suppliersAwaitingReview === 1
      ? t('oneSupplier')
      : t('manySuppliers', { count: alerts.suppliersAwaitingReview })

  return (
    <Link
      href="/admin/suppliers"
      // Named for a screen reader, and titled for a mouse: the badge alone
      // says "2" and nothing about what two means.
      aria-label={label}
      title={label}
      className="relative inline-flex size-9 items-center justify-center rounded-lg text-glex-green-800 transition-colors hover:bg-glex-green-50"
    >
      <Bell className="size-5" aria-hidden="true" />
      <span
        aria-hidden="true"
        className="absolute -end-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-glex-gold-500 px-1 text-[10px] font-bold text-glex-green-950"
      >
        {alerts.total > 9 ? '9+' : alerts.total}
      </span>
    </Link>
  )
}
