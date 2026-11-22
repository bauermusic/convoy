// The push-to-talk button: big, bottom of the panel, made for a blind thumb press.
// Pointer down = talk, up/cancel = stop. On desktop, holding Space does the same.
// touch-action: none (CSS) stops the browser from treating a long press as scroll or zoom.
import { useEffect } from 'react'
import type { Ptt } from '../hooks/usePtt'
import { Waveform } from './Waveform'

export function PttButton({ ptt, canTalk }: { ptt: Ptt; canTalk: boolean }) {
  const { state, press, release } = ptt

  // Space as a desktop shortcut, unless the user is typing in or operating another control.
  useEffect(() => {
    const isControl = (e: KeyboardEvent) => e.target instanceof HTMLElement && e.target.closest('input, button, a, select, textarea')
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isControl(e)) return
      e.preventDefault()
      press()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isControl(e)) return
      release()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [press, release])

  const label =
    state.kind === 'held' ? 'TRANSMITTING' : state.kind === 'busy' ? `${state.by.toUpperCase()} TALKING` : 'HOLD TO TALK'
  const hint = !canTalk
    ? 'Watching only'
    : state.kind === 'held' && ptt.micProblem
      ? `No microphone (${ptt.micProblem}): others see you talking, no audio`
      : state.kind === 'held' && ptt.recording
        ? 'Recording message · max 8 s'
        : ptt.playing
          ? `▶ ${ptt.playing.role.toUpperCase()}'s message`
          : state.kind === 'free'
            ? 'or hold Space'
            : ''
  // Real levels when we have audio (our mic, or a message playing); synthetic while someone
  // talks live (their audio only arrives when they let go).
  const analyser = state.kind === 'held' ? (ptt.mic?.analyser ?? null) : (ptt.playing?.analyser ?? null)

  return (
    <button
      className={`ptt ${state.kind}${ptt.playing ? ' playing' : ''}`}
      disabled={!canTalk || state.kind === 'busy'}
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // pointer already gone; release still arrives via pointerup/cancel
        }
        press()
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Waveform analyser={analyser} active={state.kind !== 'free' || ptt.playing !== null} />
      <span className="ptt-label">{label}</span>
      {hint && <span className={`ptt-hint${hint === 'or hold Space' ? ' keyboard' : ''}`}>{hint}</span>}
    </button>
  )
}
