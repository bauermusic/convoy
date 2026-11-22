import { describe, expect, it } from 'vitest'
import { ROUTE } from '../data/route'
import { turnAhead } from './route'
import { BASE_SPEED, MAX_ACCEL, MIN_FOLLOW_GAP, WAVE, initialCar, keepBehind, stepCar, type SimParams } from './sim'
import type { CarState } from './types'

const params: SimParams = { t: 0, turn: 0, lagFactor: 1, phase: 0 }

describe('sim', () => {
  it('limits acceleration from a standstill', () => {
    // Given
    const car = initialCar('mid')

    // When
    const next = stepCar(car, 1, params)

    // Then
    expect(next.v).toBeCloseTo(MAX_ACCEL, 5)
    expect(next.s).toBeCloseTo(car.s + MAX_ACCEL / 2, 5)
  })

  it('brings a stopped car to zero speed without rolling backwards', () => {
    // Given
    let car: CarState = { s: 1000, v: 20, status: 'stopped' }

    // When
    for (let i = 0; i < 100; i++) car = stepCar(car, 0.1, params)

    // Then
    expect(car.v).toBe(0)
    expect(car.s).toBeGreaterThan(1000)
  })

  it('drives slower with a lower lag factor', () => {
    // Given
    let fast = initialCar('mid')
    let slow = initialCar('mid')

    // When
    for (let i = 0; i < 300; i++) {
      fast = stepCar(fast, 0.1, params)
      slow = stepCar(slow, 0.1, { ...params, lagFactor: 0.5 })
    }

    // Then
    expect(slow.v).toBeCloseTo(fast.v / 2, 1)
  })

  it('keeps plausible speeds over ten minutes on the real route', () => {
    // Given
    let car = initialCar('lead')
    const speeds: number[] = []

    // When
    for (let t = 0; t < 600; t += 0.25) {
      car = stepCar(car, 0.25, { ...params, t, turn: turnAhead(ROUTE, car.s) })
      speeds.push(car.v)
    }

    // Then
    const average = car.s / 600
    expect(Math.max(...speeds)).toBeLessThanOrEqual(BASE_SPEED + WAVE)
    expect(average).toBeGreaterThan(8) // > ~29 km/h average on a mountain road
    expect(average).toBeLessThan(BASE_SPEED)
  })

  it('leaves a car alone when it is well behind the car ahead', () => {
    // Given
    const prev: CarState = { s: 500, v: 20, status: 'driving' }
    const next: CarState = { s: 502, v: 20, status: 'driving' }

    // When
    const result = keepBehind(prev, next, { s: 1000, v: 0 })

    // Then
    expect(result).toBe(next)
  })

  it('stops a car the minimum gap behind a stopped car', () => {
    // Given
    const prev: CarState = { s: 940, v: 20, status: 'driving' }
    const next: CarState = { s: 960, v: 20, status: 'driving' }

    // When
    const result = keepBehind(prev, next, { s: 1000, v: 0 })

    // Then
    expect(result.s).toBe(1000 - MIN_FOLLOW_GAP)
    expect(result.v).toBe(0)
  })

  it('never moves a car backwards when it is already too close', () => {
    // Given
    const prev: CarState = { s: 980, v: 5, status: 'driving' }
    const next: CarState = { s: 985, v: 5, status: 'driving' }

    // When
    const result = keepBehind(prev, next, { s: 1000, v: 0 })

    // Then
    expect(result.s).toBe(980)
  })

  it('queues behind a car that pulled over instead of passing it', () => {
    // Given
    let lead: CarState = { s: 1000, v: 0, status: 'stopped' }
    let mid: CarState = { s: 700, v: 19, status: 'driving' }

    // When
    for (let t = 0; t < 60; t += 0.1) {
      lead = stepCar(lead, 0.1, params)
      mid = keepBehind(mid, stepCar(mid, 0.1, { ...params, t }), lead)
    }

    // Then
    expect(mid.s).toBeCloseTo(lead.s - MIN_FOLLOW_GAP, 5)
    expect(mid.v).toBe(0)
  })
})
