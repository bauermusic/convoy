// The convoy loop. Every 100 ms:
//   1. Decide which cars this tab drives: its own role, plus (if host) every role no human holds.
//   2. Step those cars with the simulation and publish them (throttled in telemetry.ts).
//   3. For every other car, estimate its position from the last sample (dead reckoning), and
//      ease the drawn position toward the estimate so corrections don't make markers jump.
//   4. Compute gaps and the split alert from what is drawn, the same way in every tab.
//
// The loop runs on a Web Worker timer (backgroundInterval), not requestAnimationFrame or a plain
// setInterval: both stop or slow to a crawl in background tabs, and a background tab must keep
// driving its car, or the other tabs would see it as lost.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ROUTE } from '../data/route'
import { WAIT_FACTOR, gaps, splitState, type Gaps } from '../domain/convoy'
import { estimate } from '../domain/deadReckoning'
import { turnAhead } from '../domain/route'
import { PHASE, START_S, initialCar, stepCar } from '../domain/sim'
import { ROLES, type CarSample, type CarState, type CarStatus, type Role } from '../domain/types'
import { pushAlert } from '../firebase/alerts'
import { serverNow } from '../firebase/client'
import { subscribeMeta, type Meta } from '../firebase/meta'
import { maybePublish, subscribeCars } from '../firebase/telemetry'
import { backgroundInterval } from './backgroundInterval'
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

export interface Convoy {
  cars: Partial<Record<Role, CarView>>
  gaps: Gaps
  split: boolean
  tailLag: number
  /** Pull over (stopped) or resume (driving) this tab's own car, and tell everyone. */
  setStatus: (status: CarStatus) => void
}

const noGaps: Gaps = { leadMid: null, midTail: null, leadTail: null }

export function useConvoy(sid: string, session: Session): Convoy {
  const [view, setView] = useState<Omit<Convoy, 'setStatus'>>({ cars: {}, gaps: noGaps, split: false, tailLag: 1 })
  // The loop reads the latest session and own status through refs, so it never restarts.
  const sessionRef = useRef(session)
  sessionRef.current = session
  const ownStatus = useRef<CarStatus>('driving')
  const signedIn = session.uid !== null

  useEffect(() => {
    if (!signedIn) return // the rules only allow reads once signed in
    let remote: Partial<Record<Role, CarSample>> | null = null // null until the first snapshot
    let meta: Meta | null = null
    let seenReset: number | null | undefined // undefined until the first meta snapshot
    let pendingReset = false
    const driven = new Map<Role, CarState>()
    let drawn: Partial<Record<Role, number>> = {}
    let split = false
    let last = performance.now()

    const unsubscribeCars = subscribeCars(sid, (samples) => (remote = samples))
    const unsubscribeMeta = subscribeMeta(sid, (m) => {
      meta = m
      // Someone pressed "reset session" (a new resetAt): restart on the next tick.
      if (seenReset !== undefined && m.resetAt !== seenReset) pendingReset = true
      seenReset = m.resetAt
    })

    const stopLoop = backgroundInterval(() => {
      const nowLocal = performance.now()
      const dt = Math.min((nowLocal - last) / 1000, MAX_DT)
      last = nowLocal
      if (!remote || !meta) return // wait for existing cars, so we continue them instead of restarting
      const now = serverNow()
      const { role, isHost, humans } = sessionRef.current

      // After a reset, every tab puts the cars it drives back on the starting grid. Old samples
      // are ignored on purpose: they keep arriving for a moment, until every tab has restarted.
      if (pendingReset) {
        pendingReset = false
        driven.clear()
        drawn = {}
        split = false
        ownStatus.current = 'driving'
        for (const r of ROLES) driven.set(r, initialCar(r)) // trimmed to our own cars just below
      }

      // 1. Which cars do we drive?
      const mine = ROLES.filter((r) => r === role || (isHost && !humans[r]))
      for (const r of driven.keys()) if (!mine.includes(r)) driven.delete(r)
      for (const r of mine) if (!driven.has(r)) driven.set(r, startCar(r, remote, now))

      // 2. Step and publish them. The tail obeys the lag slider; while the convoy is split,
      //    the simulated drivers ahead of the tail slow down to wait, as the alert tells them to.
      for (const [r, car] of driven) {
        const lagFactor = r === 'tail' ? meta.tailLag : split ? WAIT_FACTOR : 1
        const status = r === role ? ownStatus.current : 'driving'
        const next = stepCar({ ...car, status }, dt, { t: now / 1000, turn: turnAhead(ROUTE, car.s), lagFactor, phase: PHASE[r] })
        driven.set(r, next)
        maybePublish(sid, r, next, r !== role, nowLocal)
      }

      // 3. Build the view.
      const cars: Convoy['cars'] = {}
      for (const r of ROLES) {
        const own = driven.get(r)
        const sample = remote[r]
        if (own) {
          cars[r] = { ...own, npc: r !== role, stale: false }
          drawn[r] = own.s
        } else if (sample) {
          const est = estimate(sample, now)
          const prev = drawn[r]
          drawn[r] = prev === undefined || Math.abs(est.s - prev) > SNAP ? est.s : prev + (est.s - prev) * EASE
          cars[r] = { s: drawn[r]!, v: est.stale ? 0 : sample.v, status: sample.status, npc: sample.npc, stale: est.stale }
        }
      }

      // 4. Gaps and the split alert (hysteresis needs the previous state).
      const g = gaps(cars)
      split = splitState(split, g.leadTail)
      setView({ cars, gaps: g, split, tailLag: meta.tailLag })
    }, TICK_MS)

    return () => {
      stopLoop()
      unsubscribeCars()
      unsubscribeMeta()
    }
  }, [sid, signedIn])

  const setStatus = useCallback(
    (status: CarStatus) => {
      const role = sessionRef.current.role
      if (!role || ownStatus.current === status) return
      ownStatus.current = status
      pushAlert(sid, status === 'stopped' ? 'pullover' : 'resume', role)
    },
    [sid],
  )

  return { ...view, setStatus }
}

/**
 * Where a car starts when this tab begins driving it. If it has a sample (e.g. the host taking
 * over a closed tab's car), continue from there, driving: an NPC never stays parked. A brand-new
 * car joins at its usual spacing from a car already on the road, so the order lead, mid, tail
 * holds even in a running session.
 */
function startCar(role: Role, remote: Partial<Record<Role, CarSample>>, now: number): CarState {
  const own = remote[role]
  if (own) {
    const est = estimate(own, now)
    return { s: est.s, v: est.stale ? 0 : own.v, status: 'driving' }
  }
  const other = ROLES.find((r) => remote[r])
  if (!other) return initialCar(role)
  const s = estimate(remote[other]!, now).s + START_S[role] - START_S[other]
  return { ...initialCar(role), s: Math.max(0, s) }
}
