/**
 * Lightweight world map in equirectangular projection.
 *
 * The viewBox is 1000×500 (a 2:1 ratio), which makes the projection a plain
 * linear mapping — see `project()` — so route endpoints can be given as real
 * latitude/longitude and land up in the right place.
 *
 * Coastlines come from Natural Earth 1:110m (public domain) via
 * `scripts/generate-world-map.mjs`, which projects them into this same viewBox
 * and commits the result — so there is no geodata dependency at runtime, and
 * land sits where `project()` says it does. Re-run that script to change them;
 * `world-map-paths.ts` is generated.
 */

export const MAP_WIDTH = 1000
export const MAP_HEIGHT = 500

/** Equirectangular projection: longitude → x, latitude → y. */
export function project(lat: number, lng: number): [number, number] {
  return [((lng + 180) / 360) * MAP_WIDTH, ((90 - lat) / 180) * MAP_HEIGHT]
}

/**
 * A quadratic arc between two points, bowed away from the equator so routes
 * read as flight/shipping paths rather than straight lines.
 */
export function arcPath(from: [number, number], to: [number, number]): string {
  const [x1, y1] = from
  const [x2, y2] = to
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const distance = Math.hypot(x2 - x1, y2 - y1)
  // Bow perpendicular to the chord, scaled by its length.
  const lift = Math.min(distance * 0.28, 90)
  return `M ${x1} ${y1} Q ${mx} ${my - lift} ${x2} ${y2}`
}

export { CONTINENT_PATHS } from './world-map-paths'
