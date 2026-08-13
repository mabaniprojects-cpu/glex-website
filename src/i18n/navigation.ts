import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Locale-aware replacements for `next/link` and the `next/navigation` hooks.
 * Always import navigation primitives from here, never from `next/*`, or the
 * active locale will be dropped from the URL.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
