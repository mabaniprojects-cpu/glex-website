import { useTranslations } from 'next-intl'

/** Keyboard users must be able to bypass the header (WCAG 2.2 — Bypass Blocks). */
export function SkipToContent() {
  const t = useTranslations('common')

  return (
    <a
      href="#main-content"
      className="sr-only-focusable start-4 top-4 z-100 rounded-lg bg-glex-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
    >
      {t('skipToContent')}
    </a>
  )
}
