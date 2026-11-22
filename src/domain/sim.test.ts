import { describe, expect, it } from 'vitest'
import { ROUTE } from '../data/route'
import { turnAhead } from './route'
import { BASE_SPEED, MAX_ACCEL, WAVE, initialCar, stepCar, type SimParams } from './sim'
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
})
