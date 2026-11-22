// A button that fires only after being held for `holdMs` (default 600 ms), so a bump of the
// screen while driving can't trigger it. A bar fills while held; releasing early cancels.
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'

interface Props {
  label: string
  className?: string
  holdMs?: number
  onConfirm: () => void
}

export function HoldButton({ label, className = '', holdMs = 600, onConfirm }: Props) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number>()

  const start = (e: PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId) // keep receiving "up" even if the finger slides off
    } catch {
      // The pointer is already gone (released very fast); the hold still works without capture.
    }
    setHolding(true)
    timer.current = window.setTimeout(() => {
      setHolding(false)
      onConfirm()
    }, holdMs)
  }
  const cancel = () => {
    window.clearTimeout(timer.current)
    setHolding(false)
  }

  return (
    <button
      className={`hold ${holding ? 'holding' : ''} ${className}`}
      style={{ '--hold-ms': `${holdMs}ms` } as CSSProperties}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="hold-fill" />
      <span className="hold-label">{label}</span>
    </button>
  )
}
