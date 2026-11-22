// Debug overlay (?debug=1): connection state, host/NPC flags and message rates.
// The offline toggle cuts this tab's Firebase connection, to demo "lost contact" without DevTools.
import { useEffect, useState } from 'react'
import { goOffline, goOnline } from 'firebase/database'
import { ROLES } from '../domain/types'
import { db, getServerTimeOffset } from '../firebase/client'
import { stats } from '../firebase/telemetry'
import type { Session } from '../hooks/useSession'

export function DebugOverlay({ session }: { session: Session }) {
  const [rates, setRates] = useState({ in: 0, out: 0 })
  const [offline, setOffline] = useState(false)

  // Turn the running counters into per-second rates.
  useEffect(() => {
    let prev = { ...stats }
    const id = setInterval(() => {
      setRates({ in: stats.received - prev.received, out: stats.sent - prev.sent })
      prev = { ...stats }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const toggleOffline = () => {
    if (offline) goOnline(db)
    else goOffline(db)
    setOffline(!offline)
  }

  const npcs = session.isHost ? ROLES.filter((r) => !session.humans[r]) : []

  return (
    <div className="debug">
      <div>connection: {session.connected ? 'online' : 'OFFLINE'}</div>
      <div>uid: {session.uid?.slice(0, 8) ?? '—'}</div>
      <div>role: {session.role ?? 'watching'}</div>
      <div>host: {session.isHost ? 'yes' : 'no'}</div>
      <div>NPCs driven here: {npcs.length ? npcs.join(', ') : 'none'}</div>
      <div>
        msgs/s in {rates.in} · out {rates.out}
      </div>
      <div>last write RTT: {stats.rttMs} ms</div>
      <div>server clock offset: {getServerTimeOffset()} ms</div>
      <button onClick={toggleOffline}>{offline ? 'Go online' : 'Simulate network drop'}</button>
    </div>
  )
}
