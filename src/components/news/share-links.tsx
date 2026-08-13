'use client'

// NOTE: lucide-react removed brand marks (Linkedin, Twitter, …) for trademark
// reasons, so a generic share glyph is used and the network is named in the
// accessible label instead.
import { Check, Link2, Mail, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Social sharing.
 *
 * Plain links to each network's share endpoint — no third-party widget, so
 * nothing is loaded from another origin and no visitor is tracked before they
 * choose to share.
 */
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const t = useTranslations('news')
  const common = useTranslations('common')
  const [copied, setCopied] = React.useState(false)

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const targets = [
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: Share2,
    },
    {
      label: 'Email',
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
      icon: Mail,
    },
  ]

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard permission can be denied; the share links still work.
    }
  }

  const buttonClass = cn(
    'inline-flex size-11 items-center justify-center rounded-lg border border-border-subtle',
    'text-glex-green-800 transition-colors hover:bg-glex-green-50'
  )

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-glex-green-800/70">{t('share')}</span>

      {targets.map((target) => (
        <a
          key={target.label}
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t('share')} — ${target.label}`}
          className={buttonClass}
        >
          <target.icon className="size-4" aria-hidden="true" />
        </a>
      ))}

      <button type="button" onClick={copy} aria-live="polite" className={buttonClass}>
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Link2 className="size-4" aria-hidden="true" />
        )}
        <span className="sr-only">{copied ? common('yes') : t('share')}</span>
      </button>
    </div>
  )
}
