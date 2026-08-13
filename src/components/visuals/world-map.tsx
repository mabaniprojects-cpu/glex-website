/**
 * Lightweight world map in equirectangular projection.
 *
 * The viewBox is 1000×500 (a 2:1 ratio), which makes the projection a plain
 * linear mapping — see `project()` — so route endpoints can be given as real
 * latitude/longitude and land up in the right place.
 *
 * Continent outlines are deliberately simplified: this is a stylised brand
 * illustration, not a cartographic reference, and keeping it as inline paths
 * avoids shipping a geodata dependency or relying on copyrighted imagery.
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

/** Simplified continental landmasses. */
export const CONTINENT_PATHS: readonly string[] = [
  // North America
  'M 155 95 L 205 88 L 268 92 L 290 108 L 282 128 L 258 138 L 248 158 L 262 172 L 250 190 L 228 196 L 212 182 L 196 160 L 178 150 L 160 132 Z',
  // Central America
  'M 228 196 L 245 208 L 262 226 L 258 236 L 240 226 L 226 210 Z',
  // South America
  'M 268 240 L 296 236 L 314 252 L 320 282 L 312 316 L 298 352 L 284 378 L 272 372 L 268 340 L 258 310 L 256 278 L 260 256 Z',
  // Greenland
  'M 318 62 L 352 58 L 366 74 L 356 92 L 330 90 L 316 76 Z',
  // Europe
  'M 468 96 L 508 90 L 536 96 L 548 112 L 534 126 L 512 132 L 490 140 L 472 132 L 462 116 Z',
  // Africa
  'M 476 168 L 516 160 L 552 166 L 568 186 L 562 216 L 550 248 L 534 282 L 516 308 L 500 300 L 492 272 L 480 240 L 470 208 L 468 184 Z',
  // Middle East / Arabian Peninsula
  'M 556 168 L 586 164 L 600 178 L 596 200 L 578 212 L 562 202 L 554 184 Z',
  // Russia / Northern Asia
  'M 548 82 L 620 74 L 700 76 L 780 84 L 812 96 L 800 116 L 748 122 L 690 118 L 630 112 L 578 106 L 552 98 Z',
  // South & East Asia
  'M 620 130 L 672 126 L 716 134 L 748 148 L 762 168 L 744 186 L 712 190 L 682 178 L 650 166 L 626 150 Z',
  // India
  'M 636 172 L 664 170 L 676 190 L 668 214 L 652 226 L 640 208 L 632 188 Z',
  // South-East Asia archipelago
  'M 724 200 L 758 196 L 780 208 L 792 224 L 772 234 L 744 228 L 726 216 Z',
  // Australia
  'M 776 296 L 822 290 L 852 302 L 862 324 L 846 346 L 812 352 L 786 340 L 772 318 Z',
  // New Zealand
  'M 884 352 L 898 348 L 904 364 L 892 376 L 882 366 Z',
] as const
