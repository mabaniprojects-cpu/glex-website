'use client'

import { UserRole } from '@prisma/client'
import { LockOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/navigation'
import { setUserActive, setUserRole, unlockUser } from '@/lib/actions/user-actions'

/**
 * Per-row controls for the user list.
 *
 * The server is the authority on every rule here — `assignableRoles` only
 * shapes what is offered, so the select can never present a role the actor is
 * not allowed to grant. The action re-checks regardless.
 */
export function UserControls({
  id,
  role,
  isActive,
  isLocked,
  isSelf,
  assignableRoles,
}: {
  id: string
  role: UserRole
  isActive: boolean
  isLocked: boolean
  isSelf: boolean
  assignableRoles: UserRole[]
}) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')

  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  type Result = { ok: boolean; error?: string }

  function run(action: () => Promise<Result>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        router.refresh()
        return
      }
      // Named reasons, because "something went wrong" gives an administrator
      // nothing to act on.
      setError(
        result.error === 'forbidden_role'
          ? admin('users.errorForbiddenRole')
          : result.error === 'last_admin'
            ? admin('users.errorLastAdmin')
            : result.error === 'self'
              ? admin('users.errorSelf')
              : common('errorBody')
      )
    })
  }

  // Your own row is read-only: no self-escalation, no locking yourself out.
  const locked = isSelf || pending

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="sr-only" htmlFor={`role-${id}`}>
          {admin('users.role')}
        </label>
        {/* A plain select, not `FieldSelect`: that one reads context from a
            surrounding <Field>, which a compact table control does not have. */}
        <select
          id={`role-${id}`}
          value={role}
          disabled={locked || !assignableRoles.includes(role)}
          onChange={(event) =>
            run(() => setUserRole({ id, role: event.target.value as UserRole }))
          }
          className="h-9 w-52 rounded-lg border border-border-subtle bg-white px-2 pe-7 text-sm disabled:opacity-60"
        >
          {/* The current role is always listed, even when it is above the
              actor's own — otherwise the select would silently misreport it. */}
          {(assignableRoles.includes(role) ? assignableRoles : [role, ...assignableRoles]).map(
            (option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, ' ').toLowerCase()}
              </option>
            )
          )}
        </select>

        <Button
          type="button"
          variant={isActive ? 'ghost' : 'primary'}
          size="sm"
          disabled={locked}
          onClick={() => run(() => setUserActive({ id, isActive: !isActive }))}
        >
          {isActive ? admin('users.deactivate') : admin('users.activate')}
        </Button>

        {isLocked ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => unlockUser({ id }))}
          >
            <LockOpen className="size-4" aria-hidden="true" />
            {admin('users.unlock')}
          </Button>
        ) : null}
      </div>

      {isSelf ? (
        <p className="text-xs text-glex-green-800/60">{admin('users.selfHint')}</p>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  )
}
