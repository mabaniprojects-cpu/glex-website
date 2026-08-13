import { GLEX_COMPANY } from '@/lib/company'
import { arcPath, CONTINENT_PATHS, MAP_HEIGHT, MAP_WIDTH, project } from './world-map'

export type MapRoute = {
  id: string
  label: string
  destName: string
  destLat: number
  destLng: number
  originLat: number
  originLng: number
}

/**
 * Decorative animated trade-route map.
 *
 * Pure inline SVG — no map tiles, no JavaScript, no external requests, so it
 * costs nothing on mobile and cannot leak a request to a third party. The dash
 * animation is driven entirely by CSS and is disabled by the global
 * `prefers-reduced-motion` rule in globals.css.
 *
 * Routes are admin-editable (GlobalRoute); when none exist we still draw the
 * map and the Jeddah origin marker rather than rendering an empty box.
 */
export function RouteMap({
  routes,
  className,
}: {
  routes: readonly MapRoute[]
  className?: string
}) {
  const [originX, originY] = project(
    GLEX_COMPANY.office.latitude,
    GLEX_COMPANY.office.longitude
  )

  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      className={className ?? 'size-full object-cover'}
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Latitude/longitude graticule */}
      <g stroke="currentColor" className="text-glex-green-200/15" strokeWidth="0.5">
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`h${i}`} x1="0" x2={MAP_WIDTH} y1={i * 50} y2={i * 50} />
        ))}
        {Array.from({ length: 21 }, (_, i) => (
          <line key={`v${i}`} y1="0" y2={MAP_HEIGHT} x1={i * 50} x2={i * 50} />
        ))}
      </g>

      {/* Landmasses */}
      <g className="text-glex-green-200/25" fill="currentColor">
        {CONTINENT_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* Trade lanes */}
      <g fill="none" strokeLinecap="round">
        {routes.map((route, index) => {
          const from = project(route.originLat, route.originLng)
          const to = project(route.destLat, route.destLng)
          const d = arcPath(from, to)

          return (
            <g key={route.id}>
              {/* Static faint lane */}
              <path d={d} stroke="currentColor" className="text-glex-gold-400/25" strokeWidth="1.2" />
              {/* Travelling dash — staggered so lanes don't pulse in unison */}
              <path
                d={d}
                stroke="currentColor"
                className="animate-route-dash text-glex-gold-400"
                strokeWidth="1.8"
                strokeDasharray="14 986"
                style={{ animationDelay: `${index * 0.55}s` }}
              />
              <circle
                cx={to[0]}
                cy={to[1]}
                r="3"
                fill="currentColor"
                className="text-glex-gold-300"
              />
            </g>
          )
        })}
      </g>

      {/* Jeddah origin */}
      <g>
        <circle
          cx={originX}
          cy={originY}
          r="14"
          fill="currentColor"
          className="text-glex-gold-400/20"
        />
        <circle cx={originX} cy={originY} r="5.5" fill="currentColor" className="text-glex-gold-400" />
        <circle cx={originX} cy={originY} r="2.5" fill="currentColor" className="text-glex-green-900" />
      </g>
    </svg>
  )
}
