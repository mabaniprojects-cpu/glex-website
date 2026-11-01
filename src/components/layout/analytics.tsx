import Script from 'next/script'
import { analyticsScript } from '@/lib/analytics'
import { isAnalyticsAllowed } from '@/lib/consent'

/**
 * The analytics tag, rendered only for a visitor who asked for it.
 *
 * Consent is read on the SERVER, so a visitor who has not accepted is never
 * sent the script tag at all — rather than being sent it and having it
 * suppressed in the browser. That is the same rule the error reporter follows
 * (see `src/instrumentation-client.ts`) and it is what the consent banner
 * promises: "No analytics or marketing scripts load until you accept."
 *
 * `next/script` rather than a plain `<script>`, and not for style. Accepting
 * does not reload the page — `saveCookieConsent` revalidates the layout and
 * React patches this component in — and a bare `<script>` element created
 * during a CLIENT render is inert: the browser adds the node and never fetches
 * or runs it. React says so in the console, and the result is a tag that looks
 * present in the DOM while recording nothing for the whole of that visit.
 * `next/script` injects it the way the browser will actually honour.
 *
 * The honest cost: these figures count only visitors who chose "Accept all".
 * They are a floor on real traffic, not a measurement of it, and trends matter
 * more than absolute numbers. Both supported providers are cookieless and
 * could arguably run without consent — but the banner makes a promise, and the
 * promise is kept until someone decides otherwise and rewrites it.
 */
export async function Analytics() {
  if (!(await isAnalyticsAllowed())) return null

  const script = analyticsScript()
  if (!script) return null

  return (
    <Script
      id="glex-analytics"
      src={script.src}
      strategy="afterInteractive"
      {...script.attributes}
    />
  )
}
