import { env, isExternalTrackingConfigured } from '@/lib/env'
import { internalProvider } from './internal-provider'
import { mockProvider } from './mock-provider'
import type { TrackingProvider } from './types'

/**
 * Resolves the active tracking provider from `TRACKING_PROVIDER`.
 *
 * An external adapter is only ever selected when it is BOTH named and supplied
 * with credentials. Anything else falls back to the internal provider, so a
 * half-configured integration can never silently present stale or fabricated
 * data as live carrier tracking.
 */

const registry = new Map<string, TrackingProvider>([
  [internalProvider.name, internalProvider],
  [mockProvider.name, mockProvider],
  // Register external adapters here, e.g.:
  //   [project44Provider.name, project44Provider]
  // See README → "Tracking provider setup".
])

export function getTrackingProvider(): TrackingProvider {
  const configured = env().TRACKING_PROVIDER

  if (configured === 'mock') {
    // The mock provider is a development aid only.
    return env().NODE_ENV === 'production' ? internalProvider : mockProvider
  }

  if (configured !== 'internal') {
    if (!isExternalTrackingConfigured()) {
      console.warn(
        `[tracking] Provider "${configured}" is named but has no TRACKING_API_KEY. ` +
          `Falling back to the internal provider.`
      )
      return internalProvider
    }
    const external = registry.get(configured)
    if (external) return external

    console.warn(`[tracking] Unknown provider "${configured}". Falling back to internal.`)
  }

  return internalProvider
}

/** True when the UI must display the "Demo Tracking Mode" notice. */
export function isDemoTracking(): boolean {
  return getTrackingProvider().name === 'mock'
}
