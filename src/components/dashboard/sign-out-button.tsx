'use client'

import { LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'

/**
 * Signs the user out.
 *
 * A plain `<form action="/api/auth/signout">` would be rejected: Auth.js
 * requires a CSRF token on that endpoint. The client helper obtains one.
 */
export function SignOutButton({ redirectTo }: { redirectTo: string }) {
  const nav = useTranslations('nav')
  const common = useTranslations('common')
  const [pending, setPending] = React.useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        setPending(true)
        void signOut({ redirectTo })
      }}
    >
      <LogOut className="size-4 rtl-flip" aria-hidden="true" />
      {pending ? common('loading') : nav('logout')}
    </Button>
  )
}
