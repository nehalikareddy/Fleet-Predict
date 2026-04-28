import { useState, useEffect, useCallback, useRef } from 'react'
import { GoogleMap, Polyline, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { ROUTE_PATHS } from '../constants/routes'
import { ROUTE_POLYLINES, SCENARIO_MAP_CONFIG, getPolylineForTruck } from '../utils/routePolylines'
import { interpolatePosition, findClosestProgress } from '../utils/interpolate'

const lightMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#999999" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#e8e8e8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#cccccc" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbeafe" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#f0f0f0" }] }
]

function lerp(a, b, t) { return a + (b - a) * t }

const TRIANGLE_PATH = 'M 0,-10 L 8.66,5 L -8.66,5 Z'
const X_PATH = 'M -6,-6 L 6,6 M 6,-6 L -6,6'

// ─── Build marker icon per telematics state ────────────────────────────────────
function buildTelematicsIcon(truck, pulse) {
  const flag = truck.telematicsFlag

  if (flag === 'engine_fault') {
    return {
      path: X_PATH,
      scale: 1.4,
      fillColor: '#ef4444',
      fillOpacity: 1,
      strokeColor: '#ef4444',
      strokeWeight: 3,
      anchor: new window.google.maps.Point(0, 0),
    }
  }
  if (flag === 'hos_critical') {
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: '#f97316',
      fillOpacity: pulse ? 1 : 0.4,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    }
  }
  if (flag === 'weight_restricted') {
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: '#f97316',
      fillOpacity: 0.9,
      strokeColor: '#ffffff',
      strokeWeight: 1.5,
    }
  }
  return null // Use default severity-based icon
}

// ─── Legacy severity color helpers ────────────────────────────────────────────
function getTruckSeverity(truck, currentMode) {
  if (truck.telematicsFlag === 'engine_fault') return 'critical'
  if (truck.telematicsFlag === 'hos_critical') return 'minor'
  if (currentMode === 'reactive') {
    if (truck.reactive_status === 'late') return 'critical'
    if (truck.reactive_status === 'on_time') return 'healthy'
    return 'minor'
  }
  if (truck.status === 'late' || truck.hos_valid === false) return 'critical'
  if (truck.status === 'holding') return 'minor'
  if (truck.status === 'on_time') return 'healthy'
  return 'minor'
}

function getSeverityColor(severity) {
  if (severity === 'critical') return '#ef4444'
  if (severity === 'minor') return '#d97706'
  return '#16a34a'
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function MapView({ fleetData, mode, disruption, onSelectTruck, activeScenario }) {
  const [hoveredTruck, setHoveredTruck] = useState(null)
  const [pulse, setPulse] = useState(false)
  const [truckPositions, setTruckPositions] = useState({}) // { truck_id: {lat, lng} }
  const mapRef = useRef(null)
  const clustererRef = useRef(null)
  const markersRef = useRef([])
  const progressRef = useRef({})   // { truck_id: float 0-1 }
  const prevModeRef = useRef(mode)
  const prevFleetRef = useRef([])

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  })

  // ─── Pulse heartbeat ──────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 600)
    return () => clearInterval(interval)
  }, [])

  // ─── Initialize / reset progress when fleet changes ───────────────────────
  useEffect(() => {
    if (fleetData.length === 0) {
      progressRef.current = {}
      setTruckPositions({})
      return
    }

    const fleetChanged = fleetData.length !== prevFleetRef.current.length ||
      fleetData.some((t, i) => t.truck_id !== (prevFleetRef.current[i]?.truck_id))

    if (fleetChanged) {
      // Initialize progress for each truck from its startLat/startLng
      const newProgress = {}
      fleetData.forEach(truck => {
        if (truck.telematicsFlag === 'engine_fault') {
          newProgress[truck.truck_id] = null // immobilized
          return
        }
        const polyline = getPolylineForTruck(truck, mode)
        if (!polyline) { newProgress[truck.truck_id] = null; return }

        // Anchor to startLat/startLng if available, else start at 0.1
        if (truck.startLat && truck.startLng) {
          newProgress[truck.truck_id] = findClosestProgress(polyline, truck.startLat, truck.startLng)
        } else {
          newProgress[truck.truck_id] = 0.05 + Math.random() * 0.3
        }
      })
      progressRef.current = newProgress
      prevFleetRef.current = fleetData
    }

    // When mode switches, remap progress to new polyline
    if (prevModeRef.current !== mode) {
      const updated = { ...progressRef.current }
      fleetData.forEach(truck => {
        if (truck.telematicsFlag === 'engine_fault') return
        const newPoly = getPolylineForTruck(truck, mode)
        if (!newPoly) return
        const oldProg = updated[truck.truck_id] ?? 0.1
        // Find nearest point on new polyline at same proportional distance
        const currentPos = interpolatePosition(
          getPolylineForTruck(truck, prevModeRef.current) || newPoly,
          oldProg
        )
        updated[truck.truck_id] = findClosestProgress(newPoly, currentPos.lat, currentPos.lng)
      })
      progressRef.current = updated
      prevModeRef.current = mode
    }
  }, [fleetData, mode])

  // ─── Truck movement: 2s interval (slow creep, real trucks) ───────────────
  useEffect(() => {
    if (fleetData.length === 0) return

    const tick = setInterval(() => {
      const updated = {}
      fleetData.forEach(truck => {
        const current = progressRef.current[truck.truck_id]
        if (current === null || current === undefined) {
          // Immobilized or uninitialized — use startLat/startLng
          if (truck.startLat && truck.startLng) {
            updated[truck.truck_id] = { lat: truck.startLat, lng: truck.startLng }
          }
          return
        }

        if (truck.status === 'holding') {
          // Holding trucks don't advance
          const polyline = getPolylineForTruck(truck, mode)
          if (polyline) updated[truck.truck_id] = interpolatePosition(polyline, current)
          return
        }

        // Advance progress
        let step = 0.002 + Math.random() * 0.003 // 0.002–0.005
        if (truck.telematicsFlag === 'hos_critical') {
          step = 0.001 + Math.random() * 0.0015  // half speed
        }
        if (truck.telematicsFlag === 'weight_restricted') {
          step = 0.0015 + Math.random() * 0.002   // slightly slower
        }

        const newProgress = Math.min(1, current + step)
        progressRef.current[truck.truck_id] = newProgress

        const polyline = getPolylineForTruck(truck, mode)
        if (polyline) {
          updated[truck.truck_id] = interpolatePosition(polyline, newProgress)
        }
      })
      setTruckPositions(prev => ({ ...prev, ...updated }))
    }, 2000)

    return () => clearInterval(tick)
  }, [fleetData, mode])

  // ─── Camera: pan ONCE per scenario/disruption transition, then hands-off ──
  const lastCameraPanRef = useRef(null)
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return

    if (activeScenario) {
      if (lastCameraPanRef.current === `scenario:${activeScenario}`) return
      lastCameraPanRef.current = `scenario:${activeScenario}`
      const config = SCENARIO_MAP_CONFIG[activeScenario]
      if (config) {
        mapRef.current.panTo(config.center)
        mapRef.current.setZoom(config.zoom)
      }
      return
    }

    if (disruption?.active) {
      if (lastCameraPanRef.current === 'disruption') return
      lastCameraPanRef.current = 'disruption'
      mapRef.current.panTo({ lat: 42.5833, lng: -87.95 })
      mapRef.current.setZoom(10)
      return
    }

    // Everything cleared — reset tracker so next trigger pans again
    lastCameraPanRef.current = null
  }, [activeScenario, disruption, isLoaded])

  // ─── Clusterer setup ──────────────────────────────────────────────────────
  const buildClusterer = useCallback((map) => {
    if (clustererRef.current) clustererRef.current.clearMarkers()
    clustererRef.current = new MarkerClusterer({
      map,
      markers: [],
      renderer: {
        render({ count, position, markers }) {
          let hasLate = false
          if (markers) {
            for (const m of markers) {
              if (m._severity === 'critical') { hasLate = true; break }
            }
          }
          const bg = hasLate ? '#ef4444' : '#16a34a'
          const size = count > 15 ? 52 : count > 5 ? 44 : 36
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${bg}" fill-opacity="0.85" stroke="white" stroke-width="2"/><text x="${size / 2}" y="${size / 2 + 1}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Inter, sans-serif" font-size="${size > 44 ? 14 : 12}" font-weight="700">${count}</text></svg>`
          const icon = {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
            scaledSize: new window.google.maps.Size(size, size),
          }
          return new window.google.maps.Marker({ position, icon, zIndex: hasLate ? 9999 : 100 + count })
        }
      }
    })
  }, [])

  // ─── Sync markers with clusterer ──────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !clustererRef.current || !isLoaded) return
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    clustererRef.current.clearMarkers()
    if (fleetData.length === 0) return

    const newMarkers = fleetData.map((truck) => {
      const severity = getTruckSeverity(truck, mode)
      const color = getSeverityColor(severity)

      // Position: use animated position if available, else fallback
      const animPos = truckPositions[truck.truck_id]
      let pos
      if (animPos) {
        pos = animPos
      } else if (truck.startLat && truck.startLng) {
        pos = { lat: truck.startLat, lng: truck.startLng }
      } else {
        // Legacy position logic for base fleet
        pos = getLegacyPosition(truck, fleetData, mode)
      }

      // Icon: telematics-aware first, then severity-based
      let icon = buildTelematicsIcon(truck, pulse)
      if (!icon) {
        if (severity === 'critical') {
          icon = {
            path: TRIANGLE_PATH,
            scale: 1.2,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            anchor: new window.google.maps.Point(0, 0),
          }
        } else if (severity === 'minor') {
          icon = {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: color,
            fillOpacity: 0.85,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
          }
        } else {
          icon = {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 4,
            fillColor: color,
            fillOpacity: 0.6,
            strokeColor: '#ffffff',
            strokeWeight: 1,
          }
        }
      }

      const marker = new window.google.maps.Marker({
        position: pos,
        icon,
        zIndex: severity === 'critical' ? 1000 : severity === 'minor' ? 500 : 100,
        label: truck.telematicsFlag === 'engine_fault'
          ? { text: 'IMMOBILIZED', color: '#ef4444', fontSize: '9px', fontWeight: '700', fontFamily: 'Inter', className: 'truck-fault-label' }
          : undefined,
      })

      marker._severity = severity
      marker._truckData = truck

      marker.addListener('mouseover', () => setHoveredTruck({ truck, position: pos }))
      marker.addListener('mouseout', () => setHoveredTruck(null))
      marker.addListener('click', () => {
        setHoveredTruck(null)
        if (onSelectTruck) onSelectTruck(truck)
      })

      return marker
    })

    markersRef.current = newMarkers
    clustererRef.current.addMarkers(newMarkers)
  }, [fleetData, mode, isLoaded, truckPositions, pulse, onSelectTruck])

  // ─── Unmount cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (clustererRef.current) clustererRef.current.clearMarkers() }
  }, [])

  const onMapLoad = useCallback((map) => {
    mapRef.current = map
    buildClusterer(map)
    // Apply initial camera if a scenario is already active from Firebase
    if (activeScenario) {
      const config = SCENARIO_MAP_CONFIG[activeScenario]
      if (config) {
        map.setCenter(config.center)
        map.setZoom(config.zoom)
      }
    } else {
      map.setCenter({ lat: 42.3, lng: -87.85 })
      map.setZoom(8)
    }
  }, [buildClusterer, activeScenario])

  // ─── Loading state ────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center"
        style={{ background: '#f5f5f5', borderRadius: '20px' }}>
        <div className="flex flex-col items-center gap-3">
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #e8e8e8', borderTopColor: '#111111', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#999999', fontSize: '12px', fontWeight: 500 }}>Loading map...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Which route polylines to render on the map (only when fleet is active)
  const renderRoutePolylines = () => {
    if (fleetData.length === 0) return null

    // Scenario trucks — draw their corridors
    if (activeScenario) {
      if (activeScenario === 'chicago') {
        if (mode === 'reactive') return (
          <Polyline path={ROUTE_POLYLINES['I-94']} options={{ strokeColor: '#dc2626', strokeOpacity: 0.9, strokeWeight: 8 }} />
        )
        return (
          <>
            <Polyline path={ROUTE_POLYLINES['I-94']} options={{ strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 5 }} />
            <Polyline path={ROUTE_POLYLINES['I-94-ALT-US41']} options={{ strokeColor: '#d97706', strokeOpacity: 0.8, strokeWeight: 4 }} />
          </>
        )
      }
      if (activeScenario === 'detroit') {
        if (mode === 'reactive') return (
          <Polyline path={ROUTE_POLYLINES['I-90']} options={{ strokeColor: '#dc2626', strokeOpacity: 0.9, strokeWeight: 8 }} />
        )
        return (
          <>
            <Polyline path={ROUTE_POLYLINES['I-90']} options={{ strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 5 }} />
            <Polyline path={ROUTE_POLYLINES['I-90-ALT-I-80']} options={{ strokeColor: '#16a34a', strokeOpacity: 0.8, strokeWeight: 4 }} />
          </>
        )
      }
      if (activeScenario === 'indianapolis') {
        if (mode === 'reactive') return (
          <Polyline path={ROUTE_POLYLINES['I-74-HEAVY-DETOUR']} options={{ strokeColor: '#dc2626', strokeOpacity: 0.9, strokeWeight: 8 }} />
        )
        return (
          <>
            <Polyline path={ROUTE_POLYLINES['I-74']} options={{ strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 5 }} />
            <Polyline path={ROUTE_POLYLINES['I-74-HEAVY-DETOUR']} options={{ strokeColor: '#f97316', strokeOpacity: 0.8, strokeWeight: 4 }} />
            <Polyline path={ROUTE_POLYLINES['I-74-LIGHT-SHORTCUT']} options={{ strokeColor: '#16a34a', strokeOpacity: 0.8, strokeWeight: 4 }} />
          </>
        )
      }
    }

    // Base fleet — original logic
    if (mode === 'reactive') {
      return (
        <Polyline
          path={ROUTE_PATHS['Highway-50'].path}
          options={{ strokeColor: '#dc2626', strokeOpacity: disruption?.active ? (pulse ? 1 : 0.3) : 0.8, strokeWeight: disruption?.active ? 7 : 5 }}
        />
      )
    }
    return Object.entries(ROUTE_PATHS).map(([key, route]) => (
      <Polyline
        key={key}
        path={route.path}
        options={{
          strokeColor: key === 'I-94' ? '#2563eb' : key === 'I-43' ? '#16a34a' : '#d97706',
          strokeOpacity: 0.8,
          strokeWeight: route.strokeWeight,
        }}
      />
    ))
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%', borderRadius: '20px' }}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        styles: lightMapStyle,
        minZoom: 5,
        maxZoom: 14,
        backgroundColor: '#f5f5f5',
      }}
      onLoad={onMapLoad}
      onClick={() => setHoveredTruck(null)}
    >
      {renderRoutePolylines()}

      {/* City endpoint markers — base fleet only */}
      {fleetData.length > 0 && !activeScenario && (
        <>
          <Marker
            position={{ lat: 41.8781, lng: -87.6298 }}
            icon={{ path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 9, fillColor: '#111111', fillOpacity: 0.85, strokeColor: '#ffffff', strokeWeight: 2 }}
            label={{ text: 'Chicago', color: '#333333', fontSize: '10px', fontWeight: '600', fontFamily: 'Inter' }}
          />
          <Marker
            position={{ lat: 43.0389, lng: -87.9065 }}
            icon={{ path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 9, fillColor: '#111111', fillOpacity: 0.85, strokeColor: '#ffffff', strokeWeight: 2 }}
            label={{ text: 'Milwaukee', color: '#333333', fontSize: '10px', fontWeight: '600', fontFamily: 'Inter' }}
          />
        </>
      )}

      {/* Hover InfoWindow */}
      {hoveredTruck && (
        <InfoWindow
          position={hoveredTruck.position}
          options={{ disableAutoPan: true, pixelOffset: new window.google.maps.Size(0, -16) }}
          onCloseClick={() => setHoveredTruck(null)}
        >
          <div style={{ padding: '8px 12px', fontFamily: 'Inter, sans-serif', minWidth: '140px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#111111', marginBottom: '2px' }}>
              {hoveredTruck.truck.truck_id}
            </div>
            {hoveredTruck.truck.driver && (
              <div style={{ fontSize: '10px', color: '#666666', marginBottom: '2px' }}>{hoveredTruck.truck.driver}</div>
            )}
            {hoveredTruck.truck.telematicsFlag && hoveredTruck.truck.telematicsFlag !== 'clear' && (
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ⚠ {hoveredTruck.truck.telematicsFlag.replace(/_/g, ' ')}
              </div>
            )}
            <div style={{
              fontSize: '10px', fontWeight: 600, textTransform: 'capitalize',
              color: (() => {
                const s = mode === 'reactive' ? hoveredTruck.truck.reactive_status : hoveredTruck.truck.status
                if (s === 'late') return '#dc2626'
                if (s === 'on_time') return '#16a34a'
                return '#d97706'
              })()
            }}>
              {mode === 'reactive' ? hoveredTruck.truck.reactive_status : hoveredTruck.truck.status}
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}

// ─── Legacy position for base fleet (no startLat) ─────────────────────────────
function getLegacyPosition(truck, allTrucks, mode) {
  if (mode === 'reactive') {
    const routePath = ROUTE_PATHS['Highway-50'].path
    const index = allTrucks.findIndex(t => t.truck_id === truck.truck_id)
    const t = Math.max(0, Math.min(1, index / Math.max(1, allTrucks.length - 1)))
    return { lat: lerp(routePath[1].lat, routePath[2].lat, t), lng: lerp(routePath[1].lng, routePath[2].lng, t) }
  }
  const assignedRouteName = truck.assigned_route
  if (!assignedRouteName || !ROUTE_PATHS[assignedRouteName]) {
    const index = allTrucks.findIndex(t => t.truck_id === truck.truck_id)
    return { lat: 41.8781 + (index % 5) * 0.01, lng: -87.6298 + Math.floor(index / 5) * 0.01 }
  }
  const routePath = ROUTE_PATHS[assignedRouteName].path
  const routeTrucks = allTrucks.filter(t => t.assigned_route === assignedRouteName)
  const index = routeTrucks.findIndex(t => t.truck_id === truck.truck_id)
  const t = Math.max(0, Math.min(1, index / Math.max(1, routeTrucks.length - 1)))
  return { lat: lerp(routePath[1].lat, routePath[2].lat, t), lng: lerp(routePath[1].lng, routePath[2].lng, t) }
}
