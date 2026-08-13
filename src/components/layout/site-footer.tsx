import { Mail, MapPin, Phone } from 'lucide-react'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { GLEX_COMPANY } from '@/lib/company'
import { Link } from '@/i18n/navigation'
import { db } from '@/lib/db'

const QUICK_LINKS = [
  ['/about', 'about'],
  ['/services', 'services'],
  ['/network', 'network'],
  ['/news', 'news'],
  ['/faq', 'faq'],
] as const

const SERVICE_LINKS = [
  ['/marketplace', 'marketplace'],
  ['/rfq', 'rfq'],
  ['/freight', 'freight'],
  ['/tracking', 'tracking'],
  ['/resources', 'resources'],
] as const

const REGISTER_LINKS = [
  ['/register/supplier', 'supplierRegistration'],
  ['/register/client', 'clientRegistration'],
  ['/login', 'login'],
] as const

const LEGAL_LINKS = [
  ['/privacy', 'privacy'],
  ['/terms', 'terms'],
  ['/cookies', 'cookies'],
  ['/accessibility', 'accessibility'],
] as const

export async function SiteFooter() {
  const t = await getTranslations('footer')
  const nav = await getTranslations('nav')
  const common = await getTranslations('common')

  const socialLinks = await db.socialLink
    .findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
    .catch(() => [])

  return (
    <footer className="mt-auto bg-glex-green-900 text-glex-ivory">
      <div className="container-glex py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand + summary */}
          <div className="lg:col-span-4">
            <Image
              src="/brand/glex-logo-on-dark.png"
              alt={common('logoAlt')}
              width={640}
              height={306}
              quality={90}
              className="h-20 w-auto"
            />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-glex-ivory/80">
              {t('summary')}
            </p>
          </div>

          <FooterColumn
            title={t('quickLinks')}
            items={QUICK_LINKS.map(([href, key]) => ({ href, label: nav(key) }))}
          />
          <FooterColumn
            title={t('servicesLinks')}
            items={SERVICE_LINKS.map(([href, key]) => ({ href, label: nav(key) }))}
          />
          <FooterColumn
            title={t('registerLinks')}
            items={REGISTER_LINKS.map(([href, key]) => ({ href, label: nav(key) }))}
          />

          {/* Contact */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
              {t('contact')}
            </h2>
            <address className="mt-4 space-y-3 text-sm not-italic text-glex-ivory/80">
              <div className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {GLEX_COMPANY.office.addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex gap-2.5">
                <Phone className="size-4 shrink-0 rtl-flip" aria-hidden="true" />
                <a
                  href={`tel:${GLEX_COMPANY.phoneE164}`}
                  className="underline-offset-4 hover:underline"
                  dir="ltr"
                >
                  {GLEX_COMPANY.phoneDisplay}
                </a>
              </div>
              <div className="flex gap-2.5">
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                <Link href="/contact" className="underline-offset-4 hover:underline">
                  {nav('contact')}
                </Link>
              </div>
            </address>
          </div>
        </div>

        {/* Registration details */}
        <div className="mt-12 grid gap-3 border-t border-white/10 pt-8 text-sm text-glex-ivory/70 sm:grid-cols-2">
          <p>
            {t('crNumber')}: <span dir="ltr">{GLEX_COMPANY.crNumber}</span>
          </p>
          <p className="sm:text-end">
            {t('paidCapital')}: {t('capitalValue')}
          </p>
        </div>

        {socialLinks.length > 0 ? (
          <div className="mt-6">
            <h2 className="sr-only">{t('followUs')}</h2>
            <ul className="flex flex-wrap gap-4">
              {socialLinks.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="text-sm text-glex-ivory/80 underline-offset-4 hover:underline"
                  >
                    {link.platform}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-8 text-sm text-glex-ivory/70 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {common('brandFull')}. {t('rights')}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map(([href, key]) => (
              <li key={href}>
                <Link href={href} className="underline-offset-4 hover:underline">
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

type FooterItem = { href: (typeof QUICK_LINKS)[number][0] | string; label: string }

function FooterColumn({ title, items }: { title: string; items: FooterItem[] }) {
  return (
    <div className="lg:col-span-2">
      <h2 className="text-sm font-semibold tracking-wide text-white uppercase">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm text-glex-ivory/80">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href as Parameters<typeof Link>[0]['href']}
              className="underline-offset-4 hover:underline"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
