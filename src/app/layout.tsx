import type { ReactNode } from 'react'

/**
 * Pass-through root layout.
 *
 * `<html>` and `<body>` are rendered by `src/app/[locale]/layout.tsx` instead,
 * because the `lang` and `dir` attributes depend on the active locale and must
 * be correct in the very first byte of the response.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
