// Plain Leaflet driven through a ref (no react-leaflet): React owns the <div>, Leaflet owns
// everything inside it. The map is created once; later renders only move the markers.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ROLES, type LatLng, type Role } from '../domain/types'

const LETTER: Record<Role, string> = { lead: 'L', mid: 'M', tail: 'T' }

interface Props {
  route: LatLng[]
  cars: Record<Role, LatLng>
  /** The car this tab drives: ringed, drawn on top, and followed by the map. */
  you: Role
}

export function MapView({ route, cars, you }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<Partial<Record<Role, L.Marker>>>({})

  // Create the map once. Initial props are enough: the effect below keeps markers current.
  useEffect(() => {
    const m = L.map(container.current!, { zoomControl: false }).setView(cars[you], 15)
    // Standard OpenStreetMap tiles: free and keyless. They are light, so styles.css darkens
    // them with a CSS filter (CARTO's dark tiles now require an API key; see DECISIONS.md).
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: 'dark-tiles',
      maxZoom: 19,
    }).addTo(m)
    L.polyline(route, { className: 'route-line' }).addTo(m)

    for (const role of ROLES) {
      const icon = L.divIcon({
        className: `car car-${role}${role === you ? ' you' : ''}`,
        html: role === you ? 'YOU' : LETTER[role],
        iconSize: role === you ? [44, 44] : [32, 32],
      })
      markers.current[role] = L.marker(cars[role], { icon, zIndexOffset: role === you ? 1000 : 0 }).addTo(m)
    }
    map.current = m

    // React StrictMode mounts twice in dev; removing the map lets the second mount start clean.
    return () => {
      m.remove()
      map.current = null
      markers.current = {}
    }
  }, [])

  // Every render: move the markers and keep the local car centred.
  useEffect(() => {
    for (const role of ROLES) markers.current[role]?.setLatLng(cars[role])
    map.current?.panTo(cars[you], { animate: false })
  })

  return <div ref={container} className="map" />
}
