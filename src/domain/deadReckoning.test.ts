import { describe, expect, it } from 'vitest'
import { STALE_AFTER, estimate } from './deadReckoning'

const sample = { s: 1000, v: 20, t: 50_000 }

describe('deadReckoning', () => {
  it('extrapolates a fresh sample at its last speed', () => {
    // Given
    const now = sample.t + 500

    // When
    const result = estimate(sample, now)

    // Then
    expect(result).toEqual({ s: 1010, stale: false })
  })

  it('freezes the position and marks the car stale after the cutoff', () => {
    // Given
    const now = sample.t + (STALE_AFTER + 2) * 1000

    // When
    const result = estimate(sample, now)

    // Then
    expect(result).toEqual({ s: 1000 + 20 * STALE_AFTER, stale: true })
  })

  it('is still fresh exactly at the cutoff', () => {
    // Given
    const now = sample.t + STALE_AFTER * 1000

    // When
    const result = estimate(sample, now)

    // Then
    expect(result.stale).toBe(false)
  })

  it('never moves a car backwards when the clock is slightly behind', () => {
    // Given
    const now = sample.t - 200

    // When
    const result = estimate(sample, now)

    // Then
    expect(result.s).toBe(1000)
  })
})
