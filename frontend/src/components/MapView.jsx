import { useState, useEffect, useCallback, useRef } from 'react'
import { GoogleMap, Polyline, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { ROUTE_PATHS } from '../constants/routes'

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

function lerp(a, b, t) {
  return a + (b - a) * t
}

// SVG paths for marker shapes
const TRIANGLE_PATH = 'M 0,-10 L 8.66,5 L -8.66,5 Z'

export default function MapView({ fleetData, mode, disruption, onSelectTruck }) {
  const [hoveredTruck, setHoveredTruck] = useState(null)
  const [pulse, setPulse] = useState(false)
  const mapRef = useRef(null)
  const clustererRef = useRef(null)
  const markersRef = useRef([])

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  })

  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 600)
    return () => clearInterval(interval)
  }, [])

  // Clean up clusterer on unmount
  useEffect(() => {
    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers()
      }
    }
  }, [])

  // Determine truck severity tier
  const getTruckSeverity = useCallback((truck, currentMode) => {
    if (currentMode === "reactive") {
      if (truck.reactive_status === "late") return "critical"
      if (truck.reactive_status === "on_time") return "healthy"
      return "minor"
    } else {
      if (truck.status === "late" || truck.hos_valid === false) return "critical"
      if (truck.status === "holding") return "minor"
      if (truck.status === "on_time") return "healthy"
      return "minor"
    }
  }, [])

  // Status-based color
  const getSeverityColor = useCallback((severity) => {
    if (severity === "critical") return "#dc2626"
    if (severity === "minor") return "#d97706"
    return "#16a34a"
  }, [])

  // Status-based icon: circle for healthy/minor, triangle for critical
  const getTruckIcon = useCallback((truck, currentMode) => {
    const severity = getTruckSeverity(truck, currentMode)
    const color = getSeverityColor(severity)

    if (severity === "critical") {
      return {
        path: TRIANGLE_PATH,
        scale: 1.2,
        fillColor: color,
        fillOpacity: pulse ? 1 : 0.5,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        anchor: { x: 0, y: 0 },
      }
    }

    if (severity === "minor") {
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: color,
        fillOpacity: 0.85,
        strokeColor: '#ffffff',
        strokeWeight: 1.5,
      }
    }

    // healthy — small, recedes
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 4,
      fillColor: color,
      fillOpacity: 0.6,
      strokeColor: '#ffffff',
      strokeWeight: 1,
    }
  }, [getTruckSeverity, getSeverityColor, pulse])

  const getTruckPosition = useCallback((truck, allTrucks, currentMode) => {
    if (currentMode === "reactive") {
      const routePath = ROUTE_PATHS["Highway-50"].path
      const index = allTrucks.findIndex(t => t.truck_id === truck.truck_id)
      const t = Math.max(0, Math.min(1, index / Math.max(1, allTrucks.length - 1)))
      return {
        lat: lerp(routePath[1].lat, routePath[2].lat, t),
        lng: lerp(routePath[1].lng, routePath[2].lng, t)
      }
    } else {
      const assignedRouteName = truck.assigned_route
      if (!assignedRouteName || !ROUTE_PATHS[assignedRouteName]) {
        const index = allTrucks.findIndex(t => t.truck_id === truck.truck_id)
        return {
          lat: 41.8781 + (index % 5) * 0.01,
          lng: -87.6298 + Math.floor(index / 5) * 0.01
        }
      }
      const routePath = ROUTE_PATHS[assignedRouteName].path
      const routeTrucks = allTrucks.filter(t => t.assigned_route === assignedRouteName)
      const index = routeTrucks.findIndex(t => t.truck_id === truck.truck_id)
      const t = Math.max(0, Math.min(1, index / Math.max(1, routeTrucks.length - 1)))
      return {
        lat: lerp(routePath[1].lat, routePath[2].lat, t),
        lng: lerp(routePath[1].lng, routePath[2].lng, t)
      }
    }
  }, [])

  // Build cluster renderer that turns red if any child marker is critical
  const buildClusterer = useCallback((map) => {
    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
    }

    clustererRef.current = new MarkerClusterer({
      map,
      markers: [],
      renderer: {
        render({ count, position, markers }) {
          // Check if any marker in cluster is critical
          let hasLate = false
          if (markers) {
            for (const m of markers) {
              if (m._severity === 'critical') {
                hasLate = true
                break
              }
            }
          }

          const bg = hasLate ? '#dc2626' : '#16a34a'
          const size = count > 15 ? 52 : count > 5 ? 44 : 36

          const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
              <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${bg}" fill-opacity="0.85" stroke="white" stroke-width="2"/>
              <text x="${size/2}" y="${size/2 + 1}" text-anchor="middle" dominant-baseline="central"
                fill="white" font-family="Inter, sans-serif" font-size="${size > 44 ? 14 : 12}" font-weight="700">
                ${count}
              </text>
            </svg>
          `
          const icon = {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
            scaledSize: new window.google.maps.Size(size, size),
          }

          return new window.google.maps.Marker({
            position,
            icon,
            zIndex: hasLate ? 9999 : 100 + count,
          })
        }
      }
    })
  }, [])

  // Sync markers with clusterer whenever fleet data or mode changes
  useEffect(() => {
    if (!mapRef.current || !clustererRef.current || !isLoaded) return

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    clustererRef.current.clearMarkers()

    if (fleetData.length === 0) return

    const newMarkers = fleetData.map((truck) => {
      const pos = getTruckPosition(truck, fleetData, mode)
      const severity = getTruckSeverity(truck, mode)
      const color = getSeverityColor(severity)

      let icon
      if (severity === "critical") {
        icon = {
          path: TRIANGLE_PATH,
          scale: 1.2,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          anchor: new window.google.maps.Point(0, 0),
        }
      } else if (severity === "minor") {
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

      const marker = new window.google.maps.Marker({
        position: pos,
        icon,
        zIndex: severity === "critical" ? 1000 : severity === "minor" ? 500 : 100,
      })

      // Attach severity for cluster renderer
      marker._severity = severity
      marker._truckData = truck

      // Hover: minimal info
      marker.addListener('mouseover', () => {
        setHoveredTruck({ truck, position: pos })
      })
      marker.addListener('mouseout', () => {
        setHoveredTruck(null)
      })

      // Click: select truck for diagnostic panel
      marker.addListener('click', () => {
        setHoveredTruck(null)
        if (onSelectTruck) onSelectTruck(truck)
      })

      return marker
    })

    markersRef.current = newMarkers
    clustererRef.current.addMarkers(newMarkers)

  }, [fleetData, mode, isLoaded, getTruckPosition, getTruckSeverity, getSeverityColor, onSelectTruck])

  // Re-center map when disruption occurs
  useEffect(() => {
    if (mapRef.current) {
      if (disruption?.active) {
        // Zoom and pan towards the I-94 / Highway 50 area
        mapRef.current.panTo({ lat: 42.5833, lng: -87.95 })
        mapRef.current.setZoom(10)
      } else {
        // Reset to original view
        mapRef.current.panTo({ lat: 42.3, lng: -87.85 })
        mapRef.current.setZoom(8)
      }
    }
  }, [disruption])

  const onMapLoad = useCallback((map) => {
    mapRef.current = map
    buildClusterer(map)
  }, [buildClusterer])

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

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%', borderRadius: '20px' }}
      center={{ lat: 42.3, lng: -87.85 }}
      zoom={8}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        styles: lightMapStyle,
        minZoom: 6,
        maxZoom: 12,
        backgroundColor: '#f5f5f5'
      }}
      onLoad={onMapLoad}
      onClick={() => setHoveredTruck(null)}
    >
      {/* Routes — only after simulation has run */}
      {fleetData.length > 0 && (
        mode === "reactive" ? (
          <Polyline
            path={ROUTE_PATHS["Highway-50"].path}
            options={{
              strokeColor: "#dc2626",
              strokeOpacity: disruption?.active ? (pulse ? 1 : 0.3) : 0.8,
              strokeWeight: disruption?.active ? 7 : 5,
            }}
          />
        ) : (
          Object.entries(ROUTE_PATHS).map(([key, route]) => (
            <Polyline
              key={key}
              path={route.path}
              options={{
                strokeColor: key === "I-94" ? "#2563eb" : key === "I-43" ? "#16a34a" : "#d97706",
                strokeOpacity: 0.8,
                strokeWeight: route.strokeWeight,
              }}
            />
          ))
        )
      )}

      {/* City endpoint markers — only after simulation has run */}
      {fleetData.length > 0 && (
        <>
          <Marker
            position={{ lat: 41.8781, lng: -87.6298 }}
            icon={{
              path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: 9,
              fillColor: "#111111",
              fillOpacity: 0.85,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            label={{ text: "Chicago", color: "#333333", fontSize: "10px", fontWeight: "600", fontFamily: "Inter" }}
          />
          <Marker
            position={{ lat: 43.0389, lng: -87.9065 }}
            icon={{
              path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: 9,
              fillColor: "#111111",
              fillOpacity: 0.85,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            label={{ text: "Milwaukee", color: "#333333", fontSize: "10px", fontWeight: "600", fontFamily: "Inter" }}
          />
        </>
      )}

      {/* Hover InfoWindow — minimal: truck_id + status only */}
      {hoveredTruck && (
        <InfoWindow
          position={hoveredTruck.position}
          options={{ disableAutoPan: true, pixelOffset: new window.google.maps.Size(0, -16) }}
          onCloseClick={() => setHoveredTruck(null)}
        >
          <div style={{
            padding: '8px 12px',
            fontFamily: 'Inter, sans-serif',
            background: '#ffffff',
            minWidth: '120px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#111111', marginBottom: '2px' }}>
              {hoveredTruck.truck.truck_id}
            </div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'capitalize',
              color: (() => {
                const s = mode === "reactive" ? hoveredTruck.truck.reactive_status : hoveredTruck.truck.status
                if (s === "late") return "#dc2626"
                if (s === "on_time") return "#16a34a"
                return "#d97706"
              })()
            }}>
              {mode === "reactive" ? hoveredTruck.truck.reactive_status : hoveredTruck.truck.status}
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
