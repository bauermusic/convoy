// Car telemetry: each tab writes the cars it drives and reads all of them.
// Writes go out at most 4 times per second, and at least every 500 ms as a heartbeat,
// so other tabs can tell a parked car (fresh samples, v = 0) from a lost one (no samples).
import { onValue, serverTimestamp, set } from 'firebase/database'
import type { CarSample, CarState, Role } from '../domain/types'
import { sessionRef } from './session'

const MIN_INTERVAL = 250 // ms
const HEARTBEAT = 500 // ms

/** Counters for the debug overlay. */
export const stats = { sent: 0, received: 0, rttMs: 0 }

const last: Partial<Record<Role, { at: number; car: CarState }>> = {}

/** Publish a car if it changed and 250 ms have passed, or if 500 ms have passed anyway. */
export function maybePublish(sid: string, role: Role, car: CarState, npc: boolean, now = performance.now()) {
  const prev = last[role]
  if (prev) {
    const elapsed = now - prev.at
    const changed = prev.car.s !== car.s || prev.car.v !== car.v || prev.car.status !== car.status
    if (elapsed < MIN_INTERVAL || (!changed && elapsed < HEARTBEAT)) return
  }
  last[role] = { at: now, car }
  stats.sent++
  // t is filled in by the server, so every sample carries one shared clock.
  const sample = { s: car.s, v: car.v, status: car.status, npc, t: serverTimestamp() }
  // set() resolves when the server acknowledges the write: that is our round-trip time.
  set(sessionRef(sid, `cars/${role}`), sample).then(() => (stats.rttMs = Math.round(performance.now() - now)))
}

export function subscribeCars(sid: string, cb: (cars: Partial<Record<Role, CarSample>>) => void) {
  return onValue(sessionRef(sid, 'cars'), (snap) => {
    stats.received++
    cb(snap.val() ?? {})
  }, (err) => console.error('[convoy] cars subscription failed', err))
}
