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
    : state.kind === 'held' && ptt.noMic
      ? 'No microphone: others see you talking, no audio'
      : state.kind === 'free'
        ? 'or hold Space'
        : ''

  return (
    <button
      className={`ptt ${state.kind}`}
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
      <Waveform mic={state.kind === 'held' ? ptt.mic : null} active={state.kind !== 'free'} />
      <span className="ptt-label">{label}</span>
      {hint && <span className="ptt-hint">{hint}</span>}
    </button>
  )
}
