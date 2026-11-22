// Dead reckoning: between telemetry updates (4 per second), guess where a remote car is now
// by assuming it kept its last speed. If no update arrives for STALE_AFTER seconds, stop
// guessing: the car freezes and the UI shows "lost contact".
//
// Ages are measured in server time (Date.now() + the offset Firebase reports), so tabs with
// different clocks agree on how old a sample is.

export const STALE_AFTER = 3 // seconds

export interface Sample {
  s: number
  v: number
  /** Server time of the sample, ms. */
  t: number
}

export function estimate(sample: Sample, serverNow: number): { s: number; stale: boolean } {
  const age = Math.max(0, (serverNow - sample.t) / 1000) // clamp: small clock errors can go negative
  return { s: sample.s + sample.v * Math.min(age, STALE_AFTER), stale: age > STALE_AFTER }
}
