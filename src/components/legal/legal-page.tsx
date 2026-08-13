import { Info } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { Section } from '@/components/home/sections'
import { PageHero, Prose } from '@/components/layout/page-hero'
import { GLEX_COMPANY } from '@/lib/company'
import { formatDate } from '@/lib/utils'

export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] }

/**
 * Shared shell for the four legal documents.
 *
 * These are genuine starting templates, not legal advice — every page renders
 * the `legal.placeholderNotice` banner telling the reader that qualified
 * counsel must review the text before publication.
 */
export async function LegalPage({
  locale,
  title,
  navKey,
  intro,
  sections,
  lastUpdated,
  children,
}: {
  locale: string
  title: string
  navKey: string
  intro: string
  sections: LegalSection[]
  lastUpdated: Date
  /** Rendered after the sections — used by the cookie policy for its controls. */
  children?: ReactNode
}) {
  const t = await getTranslations('legal')
  const nav = await getTranslations('nav')

  return (
    <>
      <PageHero
        title={title}
        breadcrumbs={[
          { href: `/${locale}`, label: nav('home') },
          { href: `/${locale}/${navKey}`, label: title },
        ]}
      >
        <p className="mt-4 text-sm text-glex-green-800/60">
          {t('lastUpdated', { date: formatDate(lastUpdated, locale) })}
        </p>
      </PageHero>

      <Section>
        <div
          role="note"
          className="mb-10 flex max-w-3xl gap-3 rounded-xl border border-glex-gold-300 bg-glex-gold-50 p-5"
        >
          <Info className="mt-0.5 size-5 shrink-0 text-glex-gold-700" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-glex-green-900">{t('placeholderNotice')}</p>
        </div>

        <Prose>
          <p className="text-lg">{intro}</p>

          {sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          {children}

          <section>
            <h2>{nav('contact')}</h2>
            <p>
              {GLEX_COMPANY.legalName}
              <br />
              {GLEX_COMPANY.office.addressLines.join(', ')}
              <br />
              <span dir="ltr">{GLEX_COMPANY.phoneDisplay}</span>
              <br />
              Commercial Registration <span dir="ltr">{GLEX_COMPANY.crNumber}</span>
            </p>
          </section>
        </Prose>
      </Section>
    </>
  )
}
