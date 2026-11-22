import type { Role } from '../domain/types'

export const LETTER: Record<Role, string> = { lead: 'L', mid: 'M', tail: 'T' }
export const kmh = (v: number) => Math.round(v * 3.6)
/** 340 → "340 m", 1520 → "1.52 km", null → "—". */
export const distance = (m: number | null) =>
  m === null ? '—' : Math.abs(m) < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`
