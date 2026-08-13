import { LogIn, Ship } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getSessionUser } from '@/lib/auth-guards'
import { homeRouteFor } from '@/lib/rbac'
import { Link } from '@/i18n/navigation'
import { GlexLogo } from '@/components/brand/glex-logo'
import { Button } from '@/components/ui/button'
import { AnnouncementBar } from './announcement-bar'
import { LanguageSwitcher } from './language-switcher'
import { MobileNav } from './mobile-nav'

/** Public navigation. Kept in one place so desktop and mobile never diverge. */
export const NAV_LINKS = [
  { href: '/about', key: 'about' },
  { href: '/services', key: 'services' },
  { href: '/network', key: 'network' },
  { href: '/marketplace', key: 'marketplace' },
  { href: '/news', key: 'news' },
  { href: '/resources', key: 'resources' },
  { href: '/contact', key: 'contact' },
] as const

export async function SiteHeader() {
  const t = await getTranslations('nav')
  const user = await getSessionUser()

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-50 border-b border-border-subtle bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="container-glex flex h-18 items-center gap-4">
          <Link href="/" className="shrink-0" aria-label="GLEX">
            <GlexLogo variant="nav" className="h-10 w-auto lg:h-11" eager />
          </Link>

          <nav aria-label={t('mainNavigation')} className="hidden flex-1 lg:block">
            <ul className="flex items-center justify-center gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-glex-green-800 transition-colors hover:bg-glex-green-50 hover:text-glex-green-600"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <LanguageSwitcher className="hidden md:block" />

            <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex">
              <Link href="/tracking">
                <Ship className="size-4 rtl-flip" aria-hidden="true" />
                {t('tracking')}
              </Link>
            </Button>

            {user ? (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href={homeRouteFor(user.role)}>{t('dashboard')}</Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">
                  <LogIn className="size-4 rtl-flip" aria-hidden="true" />
                  {t('login')}
                </Link>
              </Button>
            )}

            <Button asChild variant="gold" size="sm" className="hidden sm:inline-flex">
              <Link href="/rfq">{t('rfq')}</Link>
            </Button>

            <MobileNav signedIn={Boolean(user)} dashboardHref={user ? homeRouteFor(user.role) : null} />
          </div>
        </div>
      </header>
    </>
  )
}
