import { describe, expect, it } from 'vitest'
import { gaps, splitState } from './convoy'

describe('gaps', () => {
  it('measures along-route distance from the front car to the one behind', () => {
    // Given
    const cars = { lead: { s: 2000, stale: false }, mid: { s: 1700, stale: false }, tail: { s: 1000, stale: false } }

    // When
    const result = gaps(cars)

    // Then
    expect(result).toEqual({ leadMid: 300, midTail: 700, leadTail: 1000 })
  })

  it('leaves out cars that lost contact', () => {
    // Given
    const cars = { lead: { s: 2000, stale: false }, mid: { s: 1700, stale: false }, tail: { s: 1000, stale: true } }

    // When
    const result = gaps(cars)

    // Then
    expect(result).toEqual({ leadMid: 300, midTail: null, leadTail: null })
  })
})

describe('splitState', () => {
  it('turns on just above the threshold', () => {
    // Given
    const prev = false

    // When
    const result = splitState(prev, 1501)

    // Then
    expect(result).toBe(true)
  })

  it('stays off at the threshold itself', () => {
    // Given
    const prev = false

    // When
    const result = splitState(prev, 1500)

    // Then
    expect(result).toBe(false)
  })

  it('stays on between the release level and the threshold', () => {
    // Given
    const prev = true

    // When
    const result = splitState(prev, 1300)

    // Then
    expect(result).toBe(true)
  })

  it('turns off below the release level', () => {
    // Given
    const prev = true

    // When
    const result = splitState(prev, 1199)

    // Then
    expect(result).toBe(false)
  })

  it('keeps the previous state when the gap is unknown', () => {
    // Given
    const prev = true

    // When
    const result = splitState(prev, null)

    // Then
    expect(result).toBe(true)
  })
})
