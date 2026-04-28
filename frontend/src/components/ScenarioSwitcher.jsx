import { useState } from 'react'

const SCENARIOS = [
  {
    key: 'chicago',
    num: 1,
    title: 'HoS Compliance',
    route: 'Chicago → Milwaukee',
    highway: 'I-94',
    icon: '🕐',
    desc: 'Driver HoS limit detection & automated diversion',
  },
  {
    key: 'detroit',
    num: 2,
    title: 'Engine Fault',
    route: 'Detroit → Cleveland',
    highway: 'I-90',
    icon: '🔴',
    desc: 'Critical engine derate & upstream cascade reroute',
  },
  {
    key: 'indianapolis',
    num: 3,
    title: 'Weight Restriction',
    route: 'Indianapolis → Cincinnati',
    highway: 'I-74',
    icon: '⚖️',
    desc: 'Bridge weight limit enforcement & route splitting',
  },
]

export default function ScenarioSwitcher({ activeScenario, simulationRunning }) {
  const [loading, setLoading] = useState(null)

  const handleSelect = async (key) => {
    if (loading || simulationRunning || key === activeScenario) return
    setLoading(key)
    try {
      await fetch(`${import.meta.env.VITE_NODE_URL || 'http://localhost:3000'}/trigger-simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'historical', scenario: key }),
      })
    } catch (e) {
      console.error('Failed to trigger simulation:', e)
    } finally {
      setLoading(null)
    }
  }

  const handleReset = async () => {
    if (loading || simulationRunning) return
    setLoading('reset')
    try {
      await fetch(`${import.meta.env.VITE_NODE_URL || 'http://localhost:3000'}/reset`, { method: 'POST' })
    } catch (e) {
      console.error('Reset failed:', e)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="card" style={{ padding: '14px', marginTop: 'auto' }}>
      <div style={{
        fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase',
        letterSpacing: '0.1em', fontWeight: 600, marginBottom: '10px',
        paddingLeft: '2px',
      }}>
        Scenario Controls
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {SCENARIOS.map((s) => {
          const isActive = activeScenario === s.key
          const isLoading = loading === s.key

          return (
            <button
              key={s.key}
              onClick={() => handleSelect(s.key)}
              disabled={!!loading || simulationRunning}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: `1px solid ${isActive ? '#16a34a' : '#e0e0e0'}`,
                background: isActive ? 'rgba(22, 163, 74, 0.06)' : '#fafafa',
                cursor: loading || simulationRunning ? 'wait' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.borderColor = '#bbbbbb'
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.borderColor = '#e0e0e0'
              }}
            >
              {/* Number badge */}
              <div style={{
                width: 28, height: 28, borderRadius: '8px',
                background: isActive ? '#16a34a' : '#e8e8e8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                fontSize: '12px', fontWeight: 700,
                color: isActive ? '#ffffff' : '#666666',
                transition: 'all 0.2s ease',
              }}>
                {isLoading ? (
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    border: '2px solid #ccc', borderTopColor: '#16a34a',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                ) : s.num}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#111111' }}>
                    {s.icon} {s.title}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#999999', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.route} · {s.highway}
                </div>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#16a34a',
                  boxShadow: '0 0 6px rgba(22,163,74,0.6)',
                  flexShrink: 0,
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Reset button */}
      <button
        onClick={handleReset}
        disabled={!!loading || simulationRunning}
        style={{
          width: '100%',
          marginTop: '10px',
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          background: '#ffffff',
          cursor: loading || simulationRunning ? 'wait' : 'pointer',
          fontFamily: 'Inter, sans-serif',
          fontSize: '11px',
          fontWeight: 500,
          color: '#999999',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#111111'; e.currentTarget.style.borderColor = '#bbbbbb' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#999999'; e.currentTarget.style.borderColor = '#e0e0e0' }}
      >
        {loading === 'reset' ? 'Resetting…' : 'Reset Demo'}
      </button>

      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px' }}>
        {simulationRunning ? (
          <>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#d97706', animation: 'pulse-dot 1.5s infinite' }} />
            <span style={{ color: '#d97706', fontSize: '10px', fontWeight: 500 }}>Calculating routes…</span>
          </>
        ) : activeScenario ? (
          <>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ color: '#16a34a', fontSize: '10px', fontWeight: 500 }}>
              {SCENARIOS.find(s => s.key === activeScenario)?.title || activeScenario} active
            </span>
          </>
        ) : (
          <>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#999999' }} />
            <span style={{ color: '#999999', fontSize: '10px', fontWeight: 500 }}>Select a scenario to begin</span>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
