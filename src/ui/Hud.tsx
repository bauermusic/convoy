// Own speed, very large, plus who you are and the connection state.
import type { Role } from '../domain/types'
import type { CarView } from '../hooks/useConvoy'
import type { Session } from '../hooks/useSession'
import { kmh } from './format'

interface Props {
  session: Session
  sid: string
  /** The role asked for in the URL; may differ from the one we got. */
  wanted: Role
  you: CarView | undefined
  lost: Role[]
}

export function Hud({ session, sid, wanted, you, lost }: Props) {
  return (
    <section className="hud">
      <div className="speed">
        <span className="speed-value">{you ? kmh(you.v) : '—'}</span>
        <span className="speed-unit">km/h</span>
      </div>
      <div className="hud-line">
        {session.role ? <strong className={`role-tag car-${session.role}`}>YOU · {session.role.toUpperCase()}</strong> : null}
        {you?.status === 'stopped' && <span className="badge warn">STOPPED</span>}
        <span className="muted">{statusText(session, sid, wanted)}</span>
      </div>
      {lost.length > 0 && <div className="hud-line warn-text">Lost contact: {lost.join(', ').toUpperCase()}</div>}
    </section>
  )
}

function statusText(s: Session, sid: string, wanted: Role): string {
  if (s.error) return `Error: ${s.error}`
  if (!s.uid) return 'Signing in…'
  if (!s.connected) return 'Offline, reconnecting…'
  if (!s.role) return 'Convoy full: watching only, retrying…'
  if (s.role !== wanted) return `${wanted.toUpperCase()} is taken: you're driving ${s.role.toUpperCase()}`
  return `Session "${sid}"${s.isHost ? ' · host' : ''}`
}
