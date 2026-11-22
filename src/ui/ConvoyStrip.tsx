// The gap bar: Lead — Mid — Tail on one line, drawn to scale by distance along the road.
// The scale is at least 1.5 km wide with a tick at the split threshold, so you can see how
// close the tail is to splitting off. Amber above 1.2 km, red while split.
import { SPLIT_THRESHOLD, WARN_GAP, type Gaps } from '../domain/convoy'
import { ROLES, type Role } from '../domain/types'
import type { CarView } from '../hooks/useConvoy'
import { LETTER, distance } from './format'

interface Props {
  cars: Partial<Record<Role, CarView>>
  gaps: Gaps
  split: boolean
  you: Role | null
}

export function ConvoyStrip({ cars, gaps, split, you }: Props) {
  const present = ROLES.filter((r) => cars[r])
  if (present.length < 2) return <section className="strip muted">Waiting for the convoy…</section>

  const front = Math.max(...present.map((r) => cars[r]!.s))
  const back = Math.min(...present.map((r) => cars[r]!.s))
  const span = Math.max(front - back, SPLIT_THRESHOLD)
  const x = (s: number) => `${((front - s) / span) * 100}%` // lead on the left
  const level = split ? 'split' : (gaps.leadTail ?? 0) > WARN_GAP ? 'warn' : 'ok'

  return (
    <section className={`strip ${level}`} aria-label="Convoy gaps">
      <div className="strip-track">
        <div className="strip-line" style={{ width: x(back) }} />
        <div className="strip-limit" style={{ left: x(front - SPLIT_THRESHOLD) }} />
        {present.map((r) => (
          <div
            key={r}
            className={`strip-car car-${r}${r === you ? ' you' : ''}${cars[r]!.stale ? ' stale' : ''}`}
            style={{ left: x(cars[r]!.s) }}
          >
            {LETTER[r]}
          </div>
        ))}
      </div>
      <div className="strip-gaps">
        <span>L→M {distance(gaps.leadMid)}</span>
        <span>M→T {distance(gaps.midTail)}</span>
        <strong>L→T {distance(gaps.leadTail)}</strong>
      </div>
    </section>
  )
}
