// Demo controls behind the gear icon: the tail lag slider, reset, role switcher and the
// debug overlay toggle. Not part of the driver HUD; they exist to show the features.
import { useState } from 'react'
import { ROLES, type Role } from '../domain/types'
import { resetSession, setTailLag } from '../firebase/meta'
import { releaseSilentSeats } from '../firebase/session'

interface Props {
  sid: string
  uid: string | null
  tailLag: number
  role: Role | null
  debug: boolean
}

/** Same page with one URL parameter changed (role switch, debug toggle). */
function linkWith(key: string, value: string | null) {
  const params = new URLSearchParams(location.search)
  if (value === null) params.delete(key)
  else params.set(key, value)
  return `?${params}`
}

export function DemoControls({ sid, uid, tailLag, role, debug }: Props) {
  const [open, setOpen] = useState(debug)

  return (
    <div className="demo">
      <button className="demo-toggle" aria-label="Demo controls" aria-expanded={open} onClick={() => setOpen(!open)}>
        ⚙
      </button>
      {open && (
        <div className="demo-panel">
          <label>
            Tail lag: {tailLag.toFixed(1)}
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.1}
              value={tailLag}
              onChange={(e) => setTailLag(sid, Number(e.target.value))}
            />
          </label>
          <div className="demo-row">
            Drive as:
            {ROLES.map((r) => (
              <a key={r} href={linkWith('role', r)} className={r === role ? 'current' : undefined}>
                {r}
              </a>
            ))}
          </div>
          <div className="demo-row">
            <a href={linkWith('debug', debug ? null : '1')}>{debug ? 'Hide' : 'Show'} debug overlay</a>
          </div>
          <button
            onClick={() => {
              resetSession(sid)
              if (uid) releaseSilentSeats(sid, uid) // also free seats held by frozen tabs
            }}
          >
            Reset session
          </button>
        </div>
      )}
    </div>
  )
}
