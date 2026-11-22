// Pure car "physics" for the demo. One call advances one car by dt seconds.
// The target speed is a base speed with a slow wave (so cars drift apart and back), reduced
// in corners, scaled by the lag factor. The actual speed chases the target with bounded
// acceleration and braking, so speeds never jump.
import type { CarState, CarStatus, Role } from './types'

export interface SimParams {
  /** Seconds since the sim started; drives the slow speed wave. */
  t: number
  /** How sharply the road turns ahead, degrees (see turnAhead): 0 straight, 180 hairpin. */
  turn: number
  /** 0.2–1.0, scales the target speed. The demo slider uses it to make a car fall behind. */
  lagFactor: number
  /** Offsets the speed wave per car so the cars don't speed up in lockstep. */
  phase: number
}

export const BASE_SPEED = 19 // m/s, about 68 km/h
export const WAVE = 3 // ± m/s around the base speed
const WAVE_PERIOD = 60 // s
const MIN_CORNER_FACTOR = 0.3 // hairpins at 30% of the straight speed, about 20 km/h
export const MAX_ACCEL = 2.5 // m/s²
export const MAX_BRAKE = 5 // m/s²

/** Starting positions: the convoy begins 300 m apart. */
export const START_S: Record<Role, number> = { lead: 600, mid: 300, tail: 0 }
export const PHASE: Record<Role, number> = { lead: 0, mid: 2, tail: 4 }

export function initialCar(role: Role): CarState {
  return { s: START_S[role], v: 0, status: 'driving' }
}

export function targetSpeed(status: CarStatus, p: SimParams): number {
  if (status === 'stopped') return 0
  const wave = BASE_SPEED + WAVE * Math.sin((2 * Math.PI * p.t) / WAVE_PERIOD + p.phase)
  const corner = Math.max(MIN_CORNER_FACTOR, 1 - p.turn / 180)
  return wave * corner * p.lagFactor
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function stepCar(car: CarState, dt: number, p: SimParams): CarState {
  const target = targetSpeed(car.status, p)
  const v = Math.max(0, car.v + clamp(target - car.v, -MAX_BRAKE * dt, MAX_ACCEL * dt))
  // Use the average of the old and new speed, so the distance matches the speeds shown.
  return { ...car, v, s: car.s + ((car.v + v) / 2) * dt }
}

export const MIN_FOLLOW_GAP = 50 // m; a car never gets closer than this to the car ahead

/**
 * Car-following: after a step, keep a car behind the car ahead (convoys don't overtake).
 * If the step would bring it closer than MIN_FOLLOW_GAP, it stops at that distance and matches
 * the speed of the car ahead, so a pull-over makes the cars behind queue and wait.
 * It never moves a car backwards: if it is already too close, it holds its position.
 * `ahead` is null when there is no car ahead in contact (lead, or the car ahead was lost).
 */
export function keepBehind(prev: CarState, next: CarState, ahead: { s: number; v: number } | null): CarState {
  if (!ahead || next.s <= ahead.s - MIN_FOLLOW_GAP) return next
  return { ...next, s: Math.max(prev.s, ahead.s - MIN_FOLLOW_GAP), v: Math.min(next.v, ahead.v) }
}
