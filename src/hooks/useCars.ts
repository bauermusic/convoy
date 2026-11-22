// The convoy loop. Every 100 ms:
//   1. Decide which cars this tab drives: its own role, plus (if host) every role no human holds.
//   2. Step those cars with the simulation and publish them (throttled in telemetry.ts).
//   3. For every other car, estimate its position from the last sample (dead reckoning), and
//      ease the drawn position toward the estimate so corrections don't make markers jump.
//
// The loop uses setInterval, not requestAnimationFrame: rAF stops completely in a background
// tab, while intervals keep running (throttled to about once a second). A background tab must
// keep driving its car, or the other tabs would see it as lost.
import { useEffect, useRef, useState } from 'react'
import { ROUTE } from '../data/route'
import { estimate } from '../domain/deadReckoning'
import { turnAhead } from '../domain/route'
import { PHASE, START_S, initialCar, stepCar } from '../domain/sim'
import { ROLES, type CarSample, type CarState, type Role } from '../domain/types'
import { serverNow } from '../firebase/client'
import { maybePublish, subscribeCars } from '../firebase/telemetry'
import type { Session } from './useSession'

const TICK_MS = 100
const MAX_DT = 1 // s; after a long pause, resume instead of jumping far ahead
const EASE = 0.5 // share of the remaining gap closed per tick when drawing remote cars
const SNAP = 100 // m; bigger corrections are drawn immediately

export interface CarView extends CarState {
  /** Driven by the host because no human holds the role. */
  npc: boolean
  /** No update for 3 s: drawn frozen and dimmed, labelled "lost contact". */
  stale: boolean
}

export type Cars = Partial<Record<Role, CarView>>

export function useCars(sid: string, session: Session): Cars {
  const signedIn = session.uid !== null
  const [cars, setCars] = useState<Cars>({})
  // The loop reads the latest session through a ref, so it never restarts on session changes.
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    if (!signedIn) return // the rules only allow reads once signed in
    let remote: Partial<Record<Role, CarSample>> | null = null // null until the first snapshot
    const driven = new Map<Role, CarState>()
    const drawn: Partial<Record<Role, number>> = {}
    let last = performance.now()

    const unsubscribe = subscribeCars(sid, (samples) => (remote = samples))

    const id = setInterval(() => {
      const nowLocal = performance.now()
      const dt = Math.min((nowLocal - last) / 1000, MAX_DT)
      last = nowLocal
      if (!remote) return // wait for existing cars, so we continue them instead of restarting
      const now = serverNow()
      const { role, isHost, humans } = sessionRef.current

      // 1. Which cars do we drive?
      const mine = ROLES.filter((r) => r === role || (isHost && !humans[r]))
      for (const r of driven.keys()) if (!mine.includes(r)) driven.delete(r)
      for (const r of mine) if (!driven.has(r)) driven.set(r, startCar(r, remote, now))

      // 2. Step and publish them.
      for (const [r, car] of driven) {
        const next = stepCar(car, dt, { t: now / 1000, turn: turnAhead(ROUTE, car.s), lagFactor: 1, phase: PHASE[r] })
        driven.set(r, next)
        maybePublish(sid, r, next, r !== role, nowLocal)
      }

      // 3. Build the view.
      const view: Cars = {}
      for (const r of ROLES) {
        const own = driven.get(r)
        const sample = remote[r]
        if (own) {
          view[r] = { ...own, npc: r !== role, stale: false }
          drawn[r] = own.s
        } else if (sample) {
          const est = estimate(sample, now)
          const prev = drawn[r]
          drawn[r] = prev === undefined || Math.abs(est.s - prev) > SNAP ? est.s : prev + (est.s - prev) * EASE
          view[r] = { s: drawn[r]!, v: est.stale ? 0 : sample.v, status: sample.status, npc: sample.npc, stale: est.stale }
        }
      }
      setCars(view)
    }, TICK_MS)

    return () => {
      clearInterval(id)
      unsubscribe()
    }
  }, [sid, signedIn])

  return cars
}

/**
 * Where a car starts when this tab begins driving it. If it has a sample (e.g. the host taking
 * over a closed tab's car), continue from there. A brand-new car joins at its usual spacing
 * from a car already on the road, so the order lead, mid, tail holds even in a running session.
 */
function startCar(role: Role, remote: Partial<Record<Role, CarSample>>, now: number): CarState {
  const own = remote[role]
  if (own) {
    const est = estimate(own, now)
    return { s: est.s, v: est.stale ? 0 : own.v, status: own.status }
  }
  const other = ROLES.find((r) => remote[r])
  if (!other) return initialCar(role)
  const s = estimate(remote[other]!, now).s + START_S[role] - START_S[other]
  return { ...initialCar(role), s: Math.max(0, s) }
}
