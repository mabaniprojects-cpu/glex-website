import { ShipmentMode } from '@prisma/client'

/**
 * The trade lanes shown on /network and on the animated map.
 *
 * One list, imported by `prisma/seed.ts` and by
 * `scripts/add-global-routes.mts`, because the two must never disagree about
 * what the route set is. The seed only ever runs against a fresh database; the
 * import script is what reaches a database that is already live. Production
 * learned this the hard way — the full seed never ran there, so the site went
 * out with a single lane to Nairobi on a page titled "Connecting Saudi Arabia
 * to Global Markets".
 *
 * The origin is always the Jeddah office (`GLEX_COMPANY.office`), so only the
 * destination is recorded here.
 *
 * Ids are deterministic and derived from the position in this list, so running
 * the seed and running the import script produce the same rows rather than two
 * sets of them. Append to the end; never reorder, or the ids shift under the
 * existing records.
 */

export type RouteSeed = {
  label: string
  destName: string
  destLat: number
  destLng: number
  mode: ShipmentMode
}

export const ROUTES: ReadonlyArray<RouteSeed> = [
  {
    label: 'Jeddah → Rotterdam',
    destName: 'Rotterdam',
    destLat: 51.9244,
    destLng: 4.4777,
    mode: ShipmentMode.OCEAN,
  },
  {
    label: 'Jeddah → Shanghai',
    destName: 'Shanghai',
    destLat: 31.2304,
    destLng: 121.4737,
    mode: ShipmentMode.OCEAN,
  },
  {
    label: 'Jeddah → Mumbai',
    destName: 'Mumbai',
    destLat: 19.076,
    destLng: 72.8777,
    mode: ShipmentMode.OCEAN,
  },
  {
    label: 'Jeddah → Durban',
    destName: 'Durban',
    destLat: -29.8587,
    destLng: 31.0218,
    mode: ShipmentMode.OCEAN,
  },
  {
    label: 'Jeddah → Hamburg',
    destName: 'Hamburg',
    destLat: 53.5511,
    destLng: 9.9937,
    mode: ShipmentMode.OCEAN,
  },
  {
    label: 'Jeddah → Singapore',
    destName: 'Singapore',
    destLat: 1.3521,
    destLng: 103.8198,
    mode: ShipmentMode.OCEAN,
  },
  {
    label: 'Jeddah → New York',
    destName: 'New York',
    destLat: 40.7128,
    destLng: -74.006,
    mode: ShipmentMode.OCEAN,
  },
  {
    label: 'Jeddah → Casablanca',
    destName: 'Casablanca',
    destLat: 33.5731,
    destLng: -7.5898,
    mode: ShipmentMode.OCEAN,
  },
  {
    label: 'Jeddah → Istanbul',
    destName: 'Istanbul',
    destLat: 41.0082,
    destLng: 28.9784,
    mode: ShipmentMode.MULTIMODAL,
  },
  {
    label: 'Jeddah → Nairobi',
    destName: 'Nairobi',
    destLat: -1.2921,
    destLng: 36.8219,
    mode: ShipmentMode.AIR,
  },
  // The two Sudanese Red Sea ports, a day's sailing from Jeddah rather than the
  // weeks the other destinations take. Coordinates are the ports themselves.
  {
    label: 'Jeddah → Port Sudan',
    destName: 'Port Sudan',
    destLat: 19.6192,
    destLng: 37.2117,
    mode: ShipmentMode.OCEAN,
  },
  {
    label: 'Jeddah → Sawakin',
    destName: 'Sawakin',
    destLat: 19.1019,
    destLng: 37.3286,
    mode: ShipmentMode.OCEAN,
  },
]

/**
 * The id the seed gives the route at `index`.
 *
 * Shared so the import script writes the same row the seed would, rather than
 * a duplicate beside it.
 */
export function routeSeedId(index: number): string {
  return `00000000-0000-4000-8100-${String(index).padStart(12, '0')}`
}
