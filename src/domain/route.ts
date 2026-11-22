// The road as a lookup table with one point every SPACING metres.
// Cars only know their distance along the road (s); this file turns s into lat/lng for drawing.
//
// Because the points are evenly spaced, the point before s is simply index floor(s / SPACING):
// no search is needed, then we interpolate linearly to the next point.
import type { LatLng } from './types'

export const SPACING = 10 // metres

export interface Route {
  /** points[i] sits at i * SPACING metres from the start. The last gap may be shorter. */
  points: LatLng[]
  /** Total length in metres. */
  length: number
}

export interface Pose extends LatLng {
  /** Direction of travel in degrees clockwise from north. */
  bearing: number
}

const EARTH_RADIUS = 6_371_000
const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Great-circle (haversine) distance in metres. */
export function distance(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h))
}

/** Initial compass bearing from a to b, degrees in [0, 360). */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat))
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng))
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
}

/**
 * Drive the waypoints to the end and back to the start. The result starts and ends at the
 * same point, so looping s around the route never makes a car jump on the map.
 */
export function outAndBack(waypoints: LatLng[]): LatLng[] {
  return [...waypoints, ...waypoints.slice(0, -1).reverse()]
}

/** Resample waypoints into evenly spaced points (see file header). */
export function buildRoute(waypoints: LatLng[]): Route {
  const points: LatLng[] = [waypoints[0]]
  let travelled = 0 // distance at the start of the current waypoint segment
  let next = SPACING // distance of the next point to emit

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    const len = distance(a, b)
    while (next <= travelled + len) {
      points.push(lerp(a, b, (next - travelled) / len))
      next += SPACING
    }
    travelled += len
  }

  // Close the table with the final waypoint, unless the last emitted point is already on it.
  const remainder = travelled - (points.length - 1) * SPACING
  if (remainder > 0.01) points.push(waypoints[waypoints.length - 1])
  return { points, length: travelled }
}

/** s wrapped into [0, length): the convoy loops the route forever. */
export function wrap(route: Route, s: number): number {
  return ((s % route.length) + route.length) % route.length
}

/** Map position and heading for a distance along the route. Any s is accepted (it wraps). */
export function positionAt(route: Route, s: number): Pose {
  const d = wrap(route, s)
  const i = Math.min(Math.floor(d / SPACING), route.points.length - 2)
  const a = route.points[i]
  const b = route.points[i + 1]
  const segment = Math.min(SPACING, route.length - i * SPACING)
  return { ...lerp(a, b, (d - i * SPACING) / segment), bearing: bearing(a, b) }
}

/** How sharply the road turns over the next `ahead` metres: 0 = straight, 180 = hairpin. */
export function turnAhead(route: Route, s: number, ahead = 60): number {
  const diff = Math.abs(positionAt(route, s + ahead).bearing - positionAt(route, s).bearing) % 360
  return diff > 180 ? 360 - diff : diff
}
