// Plain Leaflet driven through a ref (no react-leaflet): React owns the <div>, Leaflet owns
// everything inside it. The map is created once; later renders only update the markers.
//
// Follow mode, like a car navigation app: the map keeps your car centred until you drag it.
// Then a re-centre button appears, and following resumes by itself after 15 s without touching
// the map. Zooming always happens around the centre (your car) and pauses following until
// 1 s after the zoom ends, so the zoom animation and the re-centring don't fight.
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ROLES, type LatLng, type Role } from '../domain/types'

import { LETTER } from './format'

const RESUME_AFTER_MS = 15_000
const ZOOM_SETTLE_MS = 1_000
const CATCH_UP_PX = 12 // offsets above this glide back instead of jumping

export interface MapCar extends LatLng {
  stale: boolean
}

interface Props {
  route: LatLng[]
  /** Cars to draw. A missing role has no marker yet. */
  cars: Partial<Record<Role, MapCar>>
  /** The car this tab drives: ringed, drawn on top, and followed by the map. */
  you: Role | null
  /** The car whose driver is on the radio: gets a green ring. */
  talking: Role | null
}

function icon(role: Role, isYou: boolean) {
  return L.divIcon({
    className: `car car-${role}${isYou ? ' you' : ''}`,
    html: isYou ? 'YOU' : LETTER[role],
    iconSize: isYou ? [44, 44] : [32, 32],
  })
}

export function MapView({ route, cars, you, talking }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<Partial<Record<Role, L.Marker>>>({})
  const [following, setFollowing] = useState(true)
  const [lastTouch, setLastTouch] = useState(0) // restarts the auto-resume countdown
  const zoomBusyUntil = useRef(0) // no re-centring before this time (during and just after a zoom)

  // Create the map, the route line and one (hidden) marker per role, once.
  useEffect(() => {
    const m = L.map(container.current!, {
      zoomControl: false,
      // Zoom around the map centre (the followed car) instead of the cursor or pinch point.
      scrollWheelZoom: 'center',
      touchZoom: 'center',
      doubleClickZoom: 'center',
    }).setView(route[0], 15)
    // Standard OpenStreetMap tiles: free and keyless. They are light, so styles.css darkens
    // them with a CSS filter (CARTO's dark tiles now require an API key; see DECISIONS.md).
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: 'dark-tiles',
      maxZoom: 19,
    }).addTo(m)
    L.polyline(route, { className: 'route-line' }).addTo(m)
    for (const role of ROLES) markers.current[role] = L.marker(route[0], { icon: icon(role, false), opacity: 0 }).addTo(m)
    map.current = m

    // dragstart only fires for the user's own drags, never for our panBy() calls.
    m.on('dragstart', () => setFollowing(false))
    m.on('dragend', () => setLastTouch(Date.now()))
    m.on('zoomstart', () => (zoomBusyUntil.current = Infinity))
    m.on('zoomend', () => {
      zoomBusyUntil.current = performance.now() + ZOOM_SETTLE_MS
      setLastTouch(Date.now())
    })

    // Leaflet measures its container once. When a banner appears the map shrinks, so tell
    // Leaflet to re-measure, or tiles would be missing at the edge.
    const resize = new ResizeObserver(() => m.invalidateSize())
    resize.observe(container.current!)

    // React StrictMode mounts twice in dev; removing the map lets the second mount start clean.
    return () => {
      resize.disconnect()
      m.remove()
      map.current = null
      markers.current = {}
    }
  }, [route])

  // Not following: resume after 15 s without touching the map (each drag or zoom restarts it).
  useEffect(() => {
    if (following) return
    const id = window.setTimeout(() => setFollowing(true), RESUME_AFTER_MS)
    return () => window.clearTimeout(id)
  }, [following, lastTouch])

  // The local role is only known after joining, so restyle the markers when it changes.
  useEffect(() => {
    for (const role of ROLES) {
      markers.current[role]?.setIcon(icon(role, role === you)).setZIndexOffset(role === you ? 1000 : 0)
    }
  }, [you])

  // Every render: move the markers, dim lost cars, and keep the followed car centred.
  useEffect(() => {
    for (const role of ROLES) {
      const car = cars[role]
      const marker = markers.current[role]
      if (!marker) continue
      if (car) marker.setLatLng(car)
      marker.setOpacity(!car ? 0 : car.stale ? 0.35 : 1)
      marker.getElement()?.classList.toggle('talking', role === talking)
    }
    // Follow by whole pixels: panTo() would reset the view 10 times a second, and fractional
    // offsets leave hairline seams between tiles.
    const follow = cars[you ?? 'lead']
    const m = map.current
    if (following && follow && m && performance.now() > zoomBusyUntil.current) {
      const offset = m.latLngToContainerPoint(follow).subtract(m.getSize().divideBy(2))
      // Small offsets (normal driving) are corrected at once. Large ones (after a zoom pause or
      // a re-centre tap) glide back over about a second instead of jumping.
      const step = (offset.x ** 2 + offset.y ** 2 > CATCH_UP_PX ** 2 ? offset.multiplyBy(0.3) : offset).round()
      if (step.x || step.y) m.panBy(step, { animate: false })
    }
  })

  return (
    <>
      <div ref={container} className="map" />
      {!following && (
        <button className="recenter" aria-label="Re-centre on my car" onClick={() => setFollowing(true)}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      )}
    </>
  )
}
