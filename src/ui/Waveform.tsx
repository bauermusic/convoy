// Waveform bars on a canvas. Three modes:
//   - real audio (our mic while talking, or a received message playing): levels from an AnalyserNode
//   - someone is talking live but we have no audio yet (or no mic): a synthetic animation
//   - idle: a flat line
// Drawn with requestAnimationFrame, which only matters while visible.
import { useEffect, useRef } from 'react'

const BARS = 24

export function Waveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current!
    const g = el.getContext('2d')!
    const samples = new Uint8Array(analyser?.fftSize ?? 0)
    let frame = 0

    const draw = (t: number) => {
      const { width, height } = el
      g.clearRect(0, 0, width, height)
      g.fillStyle = getComputedStyle(el).color
      if (analyser) analyser.getByteTimeDomainData(samples) // 128 = silence
      const perBar = samples.length / BARS
      for (let i = 0; i < BARS; i++) {
        let level = 0.06
        if (active && analyser) {
          let peak = 0
          for (let j = 0; j < perBar; j++) peak = Math.max(peak, Math.abs(samples[Math.floor(i * perBar + j)] - 128))
          level = Math.min(1, 0.06 + peak / 48)
        } else if (active) {
          level = 0.2 + 0.7 * Math.abs(Math.sin(t / 170 + i * 0.7) * Math.sin(t / 410 + i * 0.3))
        }
        const h = level * height
        g.fillRect(i * (width / BARS) + 1, (height - h) / 2, width / BARS - 2, h)
      }
      if (active) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [analyser, active])

  return <canvas ref={canvas} className="waveform" width={240} height={44} aria-hidden="true" />
}
