import { describe, expect, it } from 'vitest'
import { MAX_TALK_MS, claimFloor, floorState, type Floor } from './pttFloor'

const lead = { role: 'lead' as const, uid: 'uid-lead' }
const tail = { role: 'tail' as const, uid: 'uid-tail' }
const now = 100_000

describe('pttFloor', () => {
  it('gives a free floor to the first claimer', () => {
    // Given
    const current = null

    // When
    const result = claimFloor(current, lead, now)

    // Then
    expect(result).toEqual({ ...lead, startedAt: now })
  })

  it('rejects a second claimer while someone is talking', () => {
    // Given
    const current: Floor = { ...lead, startedAt: now - 1000 }

    // When
    const result = claimFloor(current, tail, now)

    // Then
    expect(result).toBeNull()
  })

  it('keeps the original start time when the holder claims again', () => {
    // Given
    const current: Floor = { ...lead, startedAt: now - 1000 }

    // When
    const result = claimFloor(current, lead, now)

    // Then
    expect(result).toBe(current)
  })

  it('lets anyone take a floor held longer than the talk limit', () => {
    // Given
    const current: Floor = { ...lead, startedAt: now - MAX_TALK_MS - 1 }

    // When
    const result = claimFloor(current, tail, now)

    // Then
    expect(result).toEqual({ ...tail, startedAt: now })
  })

  it('shows held to the talker, busy to others, and free once expired', () => {
    // Given
    const floor: Floor = { ...lead, startedAt: now - 1000 }

    // When
    const forTalker = floorState(floor, lead.uid, now)
    const forOthers = floorState(floor, tail.uid, now)
    const afterLimit = floorState(floor, tail.uid, now + MAX_TALK_MS)

    // Then
    expect(forTalker).toEqual({ kind: 'held' })
    expect(forOthers).toEqual({ kind: 'busy', by: 'lead' })
    expect(afterLimit).toEqual({ kind: 'free' })
  })
})
