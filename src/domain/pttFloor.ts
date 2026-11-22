// Push-to-talk floor control: one talker at a time, like a real radio channel.
// The same claimFloor() runs inside a Firebase transaction (firebase/ptt.ts), so the rule
// "free, expired or already mine" is decided in one tested place.
import type { Role } from './types'

export const MAX_TALK_MS = 30_000 // the talker is cut off after 30 s, and the floor counts as free

export interface Floor {
  role: Role
  uid: string
  /** Server time when the floor was taken, ms. */
  startedAt: number
}

/** The floor as this tab sees it: free, held by me, or busy (someone else is talking). */
export type FloorState = { kind: 'free' } | { kind: 'held' } | { kind: 'busy'; by: Role }

export function isExpired(floor: Floor, now: number): boolean {
  return now - floor.startedAt > MAX_TALK_MS
}

/** The floor after `claimant` asks for it, or null if the request is rejected. */
export function claimFloor(current: Floor | null, claimant: { role: Role; uid: string }, now: number): Floor | null {
  if (current && current.uid === claimant.uid && !isExpired(current, now)) return current // already mine: keep the start time
  if (current && !isExpired(current, now)) return null // someone else is talking
  return { ...claimant, startedAt: now }
}

export function floorState(floor: Floor | null, uid: string | null, now: number): FloorState {
  if (!floor || isExpired(floor, now)) return { kind: 'free' }
  return floor.uid === uid ? { kind: 'held' } : { kind: 'busy', by: floor.role }
}
