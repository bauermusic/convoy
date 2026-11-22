// Phase 2: the map plus a temporary readout of the synced convoy.
// The driver HUD replaces the readout in Phase 3.
import { ROUTE } from './data/route'
import { positionAt } from './domain/route'
import { ROLES, type Role } from './domain/types'
import { useCars } from './hooks/useCars'
import { useSession } from './hooks/useSession'
import { DebugOverlay } from './ui/DebugOverlay'
import { MapView, type MapCar } from './ui/MapView'

// URL parameters: ?sid=demo&role=lead|mid|tail&debug=1. No role = mid ("My Car" in the brief).
const params = new URLSearchParams(location.search)
const sid = params.get('sid') || 'demo'
const wantedRole: Role = ROLES.find((r) => r === params.get('role')) ?? 'mid'
const debug = params.get('debug') === '1'

const kmh = (v: number) => Math.round(v * 3.6)
const km = (s: number) => (s / 1000).toFixed(2)

export function App() {
  const session = useSession(sid, wantedRole)
  const cars = useCars(sid, session)

  const mapCars: Partial<Record<Role, MapCar>> = {}
  for (const role of ROLES) {
    const car = cars[role]
    if (car) mapCars[role] = { ...positionAt(ROUTE, car.s), stale: car.stale }
  }

  return (
    <div className="app">
      <MapView route={ROUTE.points} cars={mapCars} you={session.role} />
      <aside className="panel">
        <h1>Live Convoy HUD</h1>
        <p className="muted">{statusLine(session)}</p>
        <table className="readout">
          <thead>
            <tr>
              <th>Car</th>
              <th>km/h</th>
              <th>km</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => {
              const car = cars[role]
              return (
                <tr key={role} className={car?.stale ? 'stale' : undefined}>
                  <td>{role === session.role ? 'YOU' : role}</td>
                  <td>{car ? kmh(car.v) : '—'}</td>
                  <td>{car ? km(car.s) : '—'}</td>
                  <td className="tag">{car?.stale ? 'lost contact' : car?.npc ? 'NPC' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </aside>
      {debug && <DebugOverlay session={session} />}
    </div>
  )
}

function statusLine(s: ReturnType<typeof useSession>): string {
  if (s.error) return `Error: ${s.error}`
  if (!s.uid) return 'Signing in…'
  if (!s.connected) return 'Offline: reconnecting…'
  if (!s.role) return 'Convoy full: watching only'
  return `Driving ${s.role}${s.isHost ? ' · host' : ''} · session "${sid}"`
}
