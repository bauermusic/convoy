// The driver HUD. Landscape: map on the left, instruments on the right. Portrait: map on top.
import { ROUTE } from './data/route'
import { positionAt } from './domain/route'
import { ROLES, type Role } from './domain/types'
import { useAlerts } from './hooks/useAlerts'
import { useConvoy } from './hooks/useConvoy'
import { usePtt } from './hooks/usePtt'
import { useSession } from './hooks/useSession'
import { AlertBanner } from './ui/AlertBanner'
import { ConvoyStrip } from './ui/ConvoyStrip'
import { DebugOverlay } from './ui/DebugOverlay'
import { DemoControls } from './ui/DemoControls'
import { HoldButton } from './ui/HoldButton'
import { Hud } from './ui/Hud'
import { MapView, type MapCar } from './ui/MapView'
import { PttButton } from './ui/PttButton'

// URL parameters: ?sid=demo&role=lead|mid|tail&debug=1. No role = mid ("My Car" in the brief).
const params = new URLSearchParams(location.search)
const sid = params.get('sid') || 'demo'
const wantedRole: Role = ROLES.find((r) => r === params.get('role')) ?? 'mid'
const debug = params.get('debug') === '1'

export function App() {
  const session = useSession(sid, wantedRole)
  const convoy = useConvoy(sid, session)
  const alerts = useAlerts(sid, session.uid !== null)
  const ptt = usePtt(sid, session)
  const { cars } = convoy
  const role = session.role
  const you = role ? cars[role] : undefined

  const mapCars: Partial<Record<Role, MapCar>> = {}
  for (const r of ROLES) {
    const car = cars[r]
    if (car) mapCars[r] = { ...positionAt(ROUTE, car.s), stale: car.stale }
  }

  return (
    <div className="app">
      <AlertBanner split={convoy.split} alerts={alerts} />
      <div className="map-area">
        <MapView route={ROUTE.points} cars={mapCars} you={role} talking={ptt.talking} />
        <DemoControls sid={sid} tailLag={convoy.tailLag} role={role} debug={debug} />
        {debug && <DebugOverlay session={session} />}
      </div>
      <aside className="panel">
        <Hud session={session} sid={sid} you={you} lost={ROLES.filter((r) => cars[r]?.stale)} />
        <ConvoyStrip cars={cars} gaps={convoy.gaps} split={convoy.split} you={role} />
        <div className="controls">
          {role &&
            (you?.status === 'stopped' ? (
              <button className="action resume" onClick={() => convoy.setStatus('driving')}>
                RESUME
              </button>
            ) : (
              <HoldButton
                className="action pullover"
                label="PULL OVER / BREAKDOWN"
                onConfirm={() => convoy.setStatus('stopped')}
              />
            ))}
          <PttButton ptt={ptt} canTalk={role !== null} />
        </div>
      </aside>
    </div>
  )
}
