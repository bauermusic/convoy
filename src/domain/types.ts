// Shared domain types. No React or Firebase imports anywhere in src/domain/.

export type Role = 'lead' | 'mid' | 'tail'
export const ROLES: readonly Role[] = ['lead', 'mid', 'tail']

export type CarStatus = 'driving' | 'stopped'

/**
 * One car, described along the road rather than on the map.
 * `s` is an odometer: it keeps growing across laps, so gaps between cars stay correct.
 */
export interface CarState {
  /** Distance travelled along the route, metres. */
  s: number
  /** Speed, m/s. */
  v: number
  status: CarStatus
}

export interface LatLng {
  lat: number
  lng: number
}
