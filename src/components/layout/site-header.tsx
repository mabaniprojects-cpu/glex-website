import { LogIn, Ship } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { getSessionUser } from '@/lib/auth-guards'
import { homeRouteFor } from '@/lib/rbac'
import { Link } from '@/i18n/navigation'
import { GlexLogo } from '@/components/brand/glex-logo'
import { Button } from '@/components/ui/button'
import { AnnouncementBar } from './announcement-bar'
import { LanguageSwitcher } from './language-switcher'
import { MobileNav } from './mobile-nav'
import { UserMenu } from './user-menu'

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
  const locale = await getLocale()

  return (
    <>
      <AnnouncementBar />

      <header className="border-border-subtle sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="container-glex flex h-18 items-center gap-4">
          <Link href="/" className="shrink-0" aria-label="GLEX">
            <GlexLogo variant="nav" className="h-10 w-auto lg:h-11" eager />
          </Link>

          {/*
            The seven desktop links plus the action cluster need ~1330px. The
            container caps at 80rem (1232px of content), so showing them from
            lg pushed the buttons past the viewport edge and gave every page a
            horizontal scrollbar between 1024px and ~1490px. They appear from
            xl, and below that the existing mobile menu handles navigation.
          */}
          <nav aria-label={t('mainNavigation')} className="hidden min-w-0 flex-1 xl:block">
            {/*
              Tight padding and no gap at every desktop size. The container caps
              at 80rem, so the content box is 1232px however wide the viewport
              is — there is no width at which the roomier spacing fits the
              French labels, which are the longest of the five locales.

              `overflow-hidden` with `min-w-0` on the nav is a backstop: if a
              future label pushes the row over anyway, the links clip instead of
              forcing the whole page to scroll sideways.
            */}
            <ul className="flex items-center justify-center gap-0 overflow-hidden">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-glex-green-800 hover:bg-glex-green-50 hover:text-glex-green-600 rounded-lg px-2 py-2 text-sm font-medium whitespace-nowrap transition-colors"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2 xl:ms-0">
            <LanguageSwitcher className="hidden md:block" />

            {/*
              Icon-only. The label is 117px wider than the icon, which is the
              difference between the row fitting and not once the seven nav
              links are showing. The sr-only span keeps the accessible name.
            */}
            <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex">
              <Link href="/tracking">
                <Ship className="rtl-flip size-4" aria-hidden="true" />
                <span className="sr-only">{t('tracking')}</span>
              </Link>
            </Button>

            {user ? (
              <UserMenu
                className="hidden sm:block"
                name={user.name ?? user.email}
                email={user.email}
                dashboardHref={homeRouteFor(user.role)}
                redirectTo={`/${locale}`}
              />
            ) : (
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">
                  <LogIn className="rtl-flip size-4" aria-hidden="true" />
                  {/*
                    Label hidden once the desktop nav appears and the row is at
                    its tightest; visible below xl, where there is room.
                    sr-only keeps the accessible name intact either way.
                  */}
                  <span className="xl:sr-only">{t('login')}</span>
                </Link>
              </Button>
            )}

            <Button asChild variant="gold" size="sm" className="hidden sm:inline-flex">
              <Link href="/rfq">{t('rfq')}</Link>
            </Button>

            <MobileNav
              signedIn={Boolean(user)}
              dashboardHref={user ? homeRouteFor(user.role) : null}
            />
          </div>
        </div>
      </header>
    </>
  )
}
