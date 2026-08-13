import { internalProvider } from './internal-provider'
import type { NormalizedTrackingResult, TrackingInput, TrackingProvider } from './types'

/**
 * Development-only provider.
 *
 * It reads the same seeded records as the internal provider but forces
 * `isDemo: true`, so every consumer is obliged to label the result as
 * demonstration data. It never invents a shipment that does not exist.
 */
export const mockProvider: TrackingProvider = {
  name: 'mock',

  async track(input: TrackingInput): Promise<NormalizedTrackingResult> {
    const result = await internalProvider.track(input)
    if (!result.found) return result

    return { ...result, isDemo: true, provider: 'mock' }
  },

  async validateWebhook(): Promise<boolean> {
    // No webhook source exists in mock mode; reject everything.
    return false
  },

  async processWebhook(): Promise<void> {
    return
  },
}
