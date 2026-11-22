// Phase 1: map plus a temporary readout of the three locally simulated cars.
// The driver HUD replaces the readout in Phase 3.
import { ROUTE } from './data/route'
import { positionAt } from './domain/route'
import { ROLES } from './domain/types'
import { useCars } from './hooks/useCars'
import { MapView } from './ui/MapView'

const kmh = (v: number) => Math.round(v * 3.6)
const km = (s: number) => (s / 1000).toFixed(2)

export function App() {
  const cars = useCars()
  const positions = {
    lead: positionAt(ROUTE, cars.lead.s),
    mid: positionAt(ROUTE, cars.mid.s),
    tail: positionAt(ROUTE, cars.tail.s),
  }

  return (
    <div className="app">
      <MapView route={ROUTE.points} cars={positions} you="mid" />
      <aside className="panel">
        <h1>Live Convoy HUD</h1>
        <p className="muted">Phase 1 — local simulation</p>
        <table className="readout">
          <thead>
            <tr>
              <th>Car</th>
              <th>km/h</th>
              <th>km</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role}>
                <td>{role}</td>
                <td>{kmh(cars[role].v)}</td>
                <td>{km(cars[role].s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>
    </div>
  )
}
