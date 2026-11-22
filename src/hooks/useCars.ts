// Phase 1: this tab simulates all three cars locally. Phase 2 changes it to
// "own car simulated here, the other cars read from the Realtime Database".
//
// The loop uses setInterval, not requestAnimationFrame: rAF stops completely in a background
// tab, while intervals keep running (throttled to about once a second). That matters once
// each tab drives a car the other tabs are watching.
import { useEffect, useState } from 'react'
import { ROUTE } from '../data/route'
import { turnAhead } from '../domain/route'
import { PHASE, initialCar, stepCar } from '../domain/sim'
import type { CarState, Role } from '../domain/types'

const TICK_MS = 100
const MAX_DT = 1 // s; after a long pause, resume instead of jumping far ahead

export type Cars = Record<Role, CarState>

export function useCars(): Cars {
  const [cars, setCars] = useState<Cars>(() => ({
    lead: initialCar('lead'),
    mid: initialCar('mid'),
    tail: initialCar('tail'),
  }))

  useEffect(() => {
    const start = performance.now()
    let last = start
    const id = setInterval(() => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, MAX_DT)
      const t = (now - start) / 1000
      last = now
      setCars((prev) => {
        const step = (role: Role) =>
          stepCar(prev[role], dt, { t, turn: turnAhead(ROUTE, prev[role].s), lagFactor: 1, phase: PHASE[role] })
        return { lead: step('lead'), mid: step('mid'), tail: step('tail') }
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  return cars
}
