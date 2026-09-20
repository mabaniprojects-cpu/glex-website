'use client'

import { UserRole } from '@prisma/client'
import { UserPlus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/navigation'
import { inviteStaffMember } from '@/lib/actions/user-actions'

/**
 * Adding a colleague to the portal.
 *
 * No password field, by design: the invitation email is the only way to set
 * one, so an administrator never handles a colleague's credential.
 */
export function InviteStaffForm({ roles }: { roles: UserRole[] }) {
  const admin = useTranslations('admin')
  const common = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()

  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [sentTo, setSentTo] = React.useState<string | null>(null)

  const roleLabel = (role: UserRole) => admin(`roles.${role}` as 'roles.ADMIN')

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)

    setError(null)
    setSentTo(null)

    startTransition(async () => {
      const result = await inviteStaffMember({
        name: String(data.get('name') ?? ''),
        email: String(data.get('email') ?? ''),
        role: String(data.get('role') ?? ''),
        locale,
      })

      if (result.ok) {
        setSentTo(result.email)
        form.reset()
        router.refresh()
        return
      }

      setError(
        result.error === 'exists'
          ? admin('users.inviteErrorExists')
          : result.error === 'not_staff'
            ? admin('users.inviteErrorNotStaff')
            : result.error === 'forbidden_role'
              ? admin('users.errorForbiddenRole')
              : result.error === 'validation'
                ? admin('checkFields')
                : common('errorBody')
      )
    })
  }

  if (!open) {
    return (
      <div className="mt-6">
        <Button type="button" variant="primary" onClick={() => setOpen(true)}>
          <UserPlus className="size-4" aria-hidden="true" />
          {admin('users.invite')}
        </Button>
        {sentTo ? (
          <p role="status" className="text-glex-green-700 mt-3 text-sm font-medium">
            {admin('users.inviteSent', { email: sentTo })}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-border-subtle bg-surface-muted mt-6 rounded-xl border p-5"
    >
      <h2 className="text-lg font-semibold">{admin('users.invite')}</h2>
      <p className="text-glex-green-800/70 mt-1 text-sm">{admin('users.inviteHint')}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">{admin('users.inviteName')}</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="off"
            className="border-border-subtle h-11 w-full rounded-lg border bg-white px-3 text-sm"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">{admin('users.inviteEmail')}</span>
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            dir="ltr"
            autoComplete="off"
            className="border-border-subtle h-11 w-full rounded-lg border bg-white px-3 text-sm"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">{admin('users.inviteRole')}</span>
          <select
            name="role"
            required
            defaultValue=""
            className="border-border-subtle h-11 w-full rounded-lg border bg-white px-3 pe-8 text-sm"
          >
            <option value="" disabled>
              {common('select')}
            </option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          <UserPlus className="size-4" aria-hidden="true" />
          {pending ? common('loading') : admin('users.inviteSubmit')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          {common('cancel')}
        </Button>
      </div>
    </form>
  )
}
