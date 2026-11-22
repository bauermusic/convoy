// Short synthesized radio tones: rising when a channel opens, falling when it closes ("over").
// Two sine beeps with a fast fade in and out, so they click less.
import { audioContext } from './context'

export function playTone(kind: 'open' | 'close') {
  const ctx = audioContext()
  if (!ctx || ctx.state !== 'running') return // not unlocked yet: stay silent rather than queue sound
  const notes = kind === 'open' ? [880, 1320] : [1320, 880]
  notes.forEach((freq, i) => {
    const start = ctx.currentTime + i * 0.09
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.09)
  })
}
