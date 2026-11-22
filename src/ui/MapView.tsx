// Plain Leaflet driven through a ref (no react-leaflet): React owns the <div>, Leaflet owns
// everything inside it. The map is created once; later renders only update the markers.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ROLES, type LatLng, type Role } from '../domain/types'

import { LETTER } from './format'

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

  // Create the map, the route line and one (hidden) marker per role, once.
  useEffect(() => {
    const m = L.map(container.current!, { zoomControl: false }).setView(route[0], 15)
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
    if (follow && m) {
      const offset = m.latLngToContainerPoint(follow).subtract(m.getSize().divideBy(2)).round()
      if (offset.x || offset.y) m.panBy(offset, { animate: false })
    }
  })

  return <div ref={container} className="map" />
}
