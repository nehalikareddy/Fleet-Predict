import { useRef } from 'react'
import { GoogleMap, Polyline, Marker, useJsApiLoader } from '@react-google-maps/api'
import { ROUTE_POLYLINES, SCENARIO_MAP_CONFIG } from '../utils/routePolylines'

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
]

const SCENARIO_META = {
  chicago: {
    label: 'Chicago → Milwaukee',
    highway: 'I-94 Corridor',
    endpoints: [
      { pos: { lat: 41.8781, lng: -87.6298 }, label: 'Chicago' },
      { pos: { lat: 43.0389, lng: -87.9065 }, label: 'Milwaukee' },
    ],
    routes: [
      { key: 'I-94', name: 'I-94 (Primary)', color: '#2563eb', distance: '92 mi', time: '75 min', capacity: '15 trucks' },
      { key: 'I-94-ALT-US41', name: 'US-41 (Alt)', color: '#d97706', distance: '96 mi', time: '85 min', capacity: '12 trucks' },
    ],
  },
  detroit: {
    label: 'Detroit → Cleveland',
    highway: 'I-75 / I-90 Corridor',
    endpoints: [
      { pos: { lat: 42.3314, lng: -83.0458 }, label: 'Detroit' },
      { pos: { lat: 41.4993, lng: -81.6944 }, label: 'Cleveland' },
    ],
    routes: [
      { key: 'I-90', name: 'I-90 Turnpike (Primary)', color: '#2563eb', distance: '168 mi', time: '150 min', capacity: '20 trucks' },
      { key: 'I-90-ALT-I-80', name: 'I-80 South (Alt)', color: '#16a34a', distance: '185 mi', time: '170 min', capacity: '15 trucks' },
    ],
  },
  indianapolis: {
    label: 'Indianapolis → Cincinnati',
    highway: 'I-74 Corridor',
    endpoints: [
      { pos: { lat: 39.7684, lng: -86.1581 }, label: 'Indianapolis' },
      { pos: { lat: 39.1031, lng: -84.5120 }, label: 'Cincinnati' },
    ],
    routes: [
      { key: 'I-74', name: 'I-74 (Primary)', color: '#2563eb', distance: '112 mi', time: '100 min', capacity: '10 trucks' },
      { key: 'I-74-HEAVY-DETOUR', name: 'I-70 Detour (Heavy)', color: '#f97316', distance: '130 mi', time: '120 min', capacity: '8 trucks' },
      { key: 'I-74-LIGHT-SHORTCUT', name: 'US-52 Shortcut (Light)', color: '#16a34a', distance: '108 mi', time: '95 min', capacity: '12 trucks' },
    ],
  },
}

export default function RoutesView({ activeScenario, mode }) {
  const mapRef = useRef(null)
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  })

  const meta = SCENARIO_META[activeScenario] || SCENARIO_META['chicago']
  const mapConfig = SCENARIO_MAP_CONFIG[activeScenario] || SCENARIO_MAP_CONFIG['chicago']

  const onMapLoad = (map) => {
    mapRef.current = map
    map.setCenter(mapConfig.center)
    map.setZoom(mapConfig.zoom)
  }

  if (!isLoaded) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #e8e8e8', borderTopColor: '#111', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#999', fontSize: '12px', fontWeight: 500 }}>Loading map...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '12px', height: '100%', width: '100%' }}>
      {/* Map */}
      <div style={{ flex: 1, borderRadius: '20px', overflow: 'hidden', position: 'relative' }}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          options={{ disableDefaultUI: true, zoomControl: true, styles: lightMapStyle, minZoom: 6, maxZoom: 12, backgroundColor: '#f5f5f5' }}
          onLoad={onMapLoad}
        >
          {mode === 'reactive' ? (
            <Polyline path={ROUTE_POLYLINES[meta.routes[1]?.key || meta.routes[0].key]} options={{ strokeColor: '#dc2626', strokeOpacity: 0.9, strokeWeight: 8 }} />
          ) : (
            meta.routes.map(r => (
              <Polyline key={r.key} path={ROUTE_POLYLINES[r.key]} options={{ strokeColor: r.color, strokeOpacity: 0.85, strokeWeight: 5 }} />
            ))
          )}

          {meta.endpoints.map(ep => (
            <Marker
              key={ep.label}
              position={ep.pos}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: '#111111',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
              label={{ text: ep.label, color: '#333333', fontSize: '10px', fontWeight: '600', fontFamily: 'Inter' }}
            />
          ))}
        </GoogleMap>

        {/* Route legend overlay */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16,
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
          border: '1px solid #e8e8e8', borderRadius: '12px',
          padding: '8px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', fontWeight: 500 }}>
            {mode === 'reactive' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 12, height: 3, borderRadius: 2, background: '#dc2626' }} />
                <span style={{ color: '#666666' }}>Reactive — Single Route</span>
              </div>
            ) : meta.routes.map(r => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 12, height: 3, borderRadius: 2, background: r.color }} />
                <span style={{ color: '#666666' }}>{r.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Route info cards sidebar */}
      <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        <div className="card" style={{ padding: '14px 16px' }}>
          <h2 style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '4px' }}>
            Active Corridor
          </h2>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#111111' }}>{meta.label}</p>
          <p style={{ fontSize: '11px', color: '#bbbbbb', fontWeight: 400, marginTop: '2px' }}>{meta.highway}</p>
        </div>

        {(mode === 'reactive' ? [meta.routes[1] || meta.routes[0]] : meta.routes).map(r => (
          <div key={r.key} className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: 4, height: 28, borderRadius: 2, background: mode === 'reactive' ? '#dc2626' : r.color }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#111111' }}>{r.name}</div>
                {mode === 'reactive' && <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>⚠ Congested — All traffic</div>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: '#f8f8f8', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Distance</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111111' }}>{r.distance}</div>
              </div>
              <div style={{ background: '#f8f8f8', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Base Time</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111111' }}>{r.time}</div>
              </div>
              <div style={{ background: '#f8f8f8', borderRadius: '8px', padding: '8px 10px', gridColumn: 'span 2' }}>
                <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Safe Capacity</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111111' }}>{r.capacity}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

