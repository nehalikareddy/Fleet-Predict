import { useState, useEffect } from 'react'

export default function DemoControls({ simulationRunning }) {
  const [error, setError] = useState(null)
  const [dataSource, setDataSource] = useState("historical")

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleTrigger = () => {
    fetch('http://localhost:3000/trigger-simulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: dataSource }),
    })
      .catch(() => setError('Cannot connect to server on port 3000'))
  }

  const handleReset = () => {
    fetch('http://localhost:3000/reset', { method: 'POST' })
      .catch(() => setError('Cannot connect to server on port 3000'))
  }

  return (
    <div className="card flex flex-col gap-3 mt-auto" style={{ padding: '16px' }}>
      <h2 style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
        Demo Controls
      </h2>

      {/* Data Source Toggle */}
      <div style={{
        background: '#f5f5f5',
        borderRadius: '12px',
        padding: '4px',
        display: 'flex',
        gap: '4px',
      }}>
        <button
          onClick={() => setDataSource("historical")}
          style={{
            flex: 1,
            padding: '10px 8px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            background: dataSource === "historical" ? '#ffffff' : 'transparent',
            color: dataSource === "historical" ? '#111111' : '#999999',
            boxShadow: dataSource === "historical" ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke={dataSource === "historical" ? "#111111" : "#999999"}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <span>Historical</span>
            </div>
            <span style={{ fontSize: '9px', fontWeight: 400, opacity: 0.6 }}>Guaranteed Demo</span>
          </div>
        </button>

        <button
          onClick={() => setDataSource("live")}
          style={{
            flex: 1,
            padding: '10px 8px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            background: dataSource === "live" ? '#ffffff' : 'transparent',
            color: dataSource === "live" ? '#111111' : '#999999',
            boxShadow: dataSource === "live" ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke={dataSource === "live" ? "#111111" : "#999999"}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
              </svg>
              <span>Live API</span>
            </div>
            <span style={{ fontSize: '9px', fontWeight: 400, opacity: 0.6 }}>TomTom Integration</span>
          </div>
        </button>
      </div>

      {/* Trigger Button */}
      <button onClick={handleTrigger} disabled={simulationRunning} className="trigger-btn">
        {simulationRunning ? "Running simulation..." : "Trigger Heavy Rain Disruption"}
      </button>

      {/* Reset Button */}
      <button onClick={handleReset} className="reset-btn">
        Reset Demo
      </button>

      {/* Status */}
      <div className="flex items-center justify-center gap-2" style={{ paddingTop: '2px' }}>
        {error ? (
          <div className="flex items-center gap-2">
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#dc2626' }} />
            <p style={{ color: '#dc2626', fontSize: '10px', fontWeight: 500 }}>{error}</p>
          </div>
        ) : simulationRunning ? (
          <div className="flex items-center gap-2">
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#d97706', animation: 'pulse-dot 1.5s infinite' }} />
            <p style={{ color: '#d97706', fontSize: '10px', fontWeight: 500 }}>Calculating optimal routes...</p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a' }} />
            <p style={{ color: '#16a34a', fontSize: '10px', fontWeight: 500 }}>Ready — toggle mode to compare</p>
          </div>
        )}
      </div>
    </div>
  )
}
