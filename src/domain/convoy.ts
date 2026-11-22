// Convoy logic: gaps between cars and the "convoy split" alert.
//
// Gaps are measured along the road (difference of s), never as straight-line distance:
// on hairpins two cars can be 100 m apart through the air but 1 km apart by road.
import type { Role } from './types'

export const SPLIT_THRESHOLD = 1500 // m, lead→tail gap that raises the alert
export const SPLIT_RELEASE = 1200 // m, the alert clears only below this (hysteresis)
export const WARN_GAP = 1200 // m, the strip turns amber above this

/** While the convoy is split, simulated cars ahead of the split slow to this share of their speed. */
export const WAIT_FACTOR = 0.5

export interface Gaps {
  leadMid: number | null
  midTail: number | null
  leadTail: number | null
}

/** Along-route gaps. A gap is null when either car is unknown or has lost contact. */
export function gaps(cars: Partial<Record<Role, { s: number; stale: boolean }>>): Gaps {
  const at = (r: Role) => (cars[r] && !cars[r]!.stale ? cars[r]!.s : null)
  const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b)
  const lead = at('lead')
  const mid = at('mid')
  const tail = at('tail')
  return { leadMid: diff(lead, mid), midTail: diff(mid, tail), leadTail: diff(lead, tail) }
}

/**
 * Hysteresis: the alert turns on above `threshold` and only turns off below `release`.
 * With a single threshold, a gap hovering around 1.5 km would flash the alert on and off.
 * An unknown gap (a car lost contact) keeps the previous state: no news is not good news.
 */
export function splitState(
  prev: boolean,
  leadTailGap: number | null,
  threshold = SPLIT_THRESHOLD,
  release = SPLIT_RELEASE,
): boolean {
  if (leadTailGap === null) return prev
  return prev ? leadTailGap > release : leadTailGap > threshold
}
