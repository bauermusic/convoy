// Broadcast alerts ("TAIL: PULLING OVER"). Alerts are append-only: push() creates a new
// child with a time-ordered key, so the last N children are the most recent alerts.
import { limitToLast, onChildAdded, push, query, serverTimestamp } from 'firebase/database'
import type { Role } from '../domain/types'
import { serverNow } from './client'
import { sessionRef } from './session'

export type AlertType = 'pullover' | 'resume'

export interface Alert {
  id: string
  type: AlertType
  role: Role
  /** Server time, ms. */
  t: number
}

const MAX_AGE = 10_000 // ms; on load, ignore alerts older than this

export function pushAlert(sid: string, type: AlertType, role: Role) {
  return push(sessionRef(sid, 'alerts'), { type, role, t: serverTimestamp() })
}

/** Calls back once per new alert, skipping old ones that are replayed when we subscribe. */
export function subscribeAlerts(sid: string, cb: (alert: Alert) => void) {
  return onChildAdded(query(sessionRef(sid, 'alerts'), limitToLast(10)), (snap) => {
    const alert = { id: snap.key!, ...snap.val() } as Alert
    if (serverNow() - alert.t < MAX_AGE) cb(alert)
  })
}
