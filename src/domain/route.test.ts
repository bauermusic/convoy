import { describe, expect, it } from 'vitest'
import { ROUTE } from '../data/route'
import { SPACING, buildRoute, distance, outAndBack, positionAt, turnAhead } from './route'

// About 1.11 km due north.
const straight = [
  { lat: 44, lng: 7 },
  { lat: 44.01, lng: 7 },
]

describe('route', () => {
  it('resamples waypoints into points SPACING metres apart', () => {
    // Given
    const waypoints = straight

    // When
    const route = buildRoute(waypoints)

    // Then
    for (let i = 1; i < route.points.length - 1; i++) {
      expect(distance(route.points[i - 1], route.points[i])).toBeCloseTo(SPACING, 1)
    }
    expect(route.length).toBeCloseTo(distance(straight[0], straight[1]), 3)
  })

  it('wraps positions at both ends of the route', () => {
    // Given
    const route = ROUTE

    // When
    const atStart = positionAt(route, 0)
    const pastEnd = positionAt(route, route.length + 5)
    const beforeStart = positionAt(route, -5)

    // Then
    expect(atStart.lat).toBeCloseTo(route.points[0].lat, 6)
    expect(distance(pastEnd, positionAt(route, 5))).toBeLessThan(0.01)
    expect(distance(beforeStart, positionAt(route, route.length - 5))).toBeLessThan(0.01)
  })

  it('moves forward by the requested distance', () => {
    // Given
    const route = ROUTE

    // When
    const steps = [0, 1000, 5000, 20000].map((s) => distance(positionAt(route, s), positionAt(route, s + 5)))

    // Then
    steps.forEach((d) => expect(d).toBeCloseTo(5, 1))
  })

  it('is a real road of at least 15 km each way', () => {
    // Given
    const route = ROUTE

    // When
    const oneWay = route.length / 2

    // Then
    expect(oneWay).toBeGreaterThan(15_000)
  })

  it('reports no turn on a straight and a hairpin at a U-turn', () => {
    // Given
    const route = buildRoute(outAndBack(straight))
    const top = route.length / 2

    // When
    const onStraight = turnAhead(route, 100)
    const atUTurn = turnAhead(route, top - 30)

    // Then
    expect(onStraight).toBeLessThan(1)
    expect(atUTurn).toBeGreaterThan(170)
  })
})
