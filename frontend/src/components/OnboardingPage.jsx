import { useState } from 'react'
import ScenarioSwitcher from './ScenarioSwitcher'

const LOADING_STEPS = [
  { text: 'API Connection Successful', duration: 800 },
  { text: 'Fetching fleet coordinates...', duration: 1200 },
  { text: 'Translating telematics data...', duration: 1000 },
  { text: 'Applying vehicle constraints...', duration: 1400 },
]

export default function OnboardingPage({ onComplete, activeScenario, simulationRunning }) {
  const [apiKey, setApiKey] = useState('')
  const [phase, setPhase] = useState('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [trucksLoaded, setTrucksLoaded] = useState(0)

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setErrorMsg('Please enter your API key.')
      setPhase('error')
      return
    }

    setPhase('validating')
    await new Promise(r => setTimeout(r, 1500))

    try {
      const res = await fetch('http://localhost:3000/onboard-fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'fleet', apiKey: apiKey.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Connection failed. Check your API key.')
        setPhase('error')
        return
      }

      setTrucksLoaded(data.trucks_loaded)
      setPhase('loading')
      setCurrentStep(0)

      for (let i = 0; i < LOADING_STEPS.length; i++) {
        await new Promise(r => setTimeout(r, LOADING_STEPS[i].duration))
        setCurrentStep(i + 1)
      }

      await new Promise(r => setTimeout(r, 600))
      setPhase('success')
    } catch {
      setErrorMsg('Cannot reach FleetPredict server. Is it running?')
      setPhase('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fafafa 0%, #e4e4e7 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: phase === 'success' ? '540px' : '420px', padding: '24px', transition: 'max-width 0.3s ease' }}>

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '14px',
            background: '#111111', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 18H3a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h6l2 3h6a2 2 0 012 2v7a2 2 0 01-2 2h-2"/>
              <circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
              <path d="M7 16h10"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111111', marginBottom: '6px' }}>
            Welcome to FleetPredict
          </h1>
          <p style={{ fontSize: '13px', color: '#888888', fontWeight: 400 }}>
            {phase === 'success' ? 'Select a demo scenario to begin' : 'Connect your fleet to get started'}
          </p>
        </div>

        {/* ─── SUCCESS STATE ─── */}
        {phase === 'success' && (
          <div style={{
            background: '#ffffff', borderRadius: '20px',
            border: '1px solid #e8e8e8', padding: '32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                animation: 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                boxShadow: '0 8px 24px rgba(22, 163, 74, 0.3)',
                marginBottom: '16px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111111', marginBottom: '4px' }}>Fleet Connected!</h2>
              <p style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600, marginBottom: '2px' }}>{trucksLoaded} Trucks Loaded</p>
              <p style={{ fontSize: '12px', color: '#999999' }}>Telematics data synced. Choose a scenario below.</p>
            </div>

            <ScenarioSwitcher activeScenario={activeScenario} simulationRunning={simulationRunning} />

            <button onClick={() => onComplete && onComplete()} disabled={!activeScenario && !simulationRunning} style={{
              width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
              cursor: (!activeScenario && !simulationRunning) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, color: '#ffffff',
              background: (!activeScenario && !simulationRunning) ? '#cccccc' : '#111111', fontFamily: 'Inter, sans-serif',
              transition: 'background 0.2s', marginTop: '16px'
            }} onMouseEnter={e => { if (activeScenario || simulationRunning) e.target.style.background = '#333333' }} onMouseLeave={e => { if (activeScenario || simulationRunning) e.target.style.background = '#111111' }}>
              {simulationRunning ? 'Loading Dashboard...' : activeScenario ? 'Launch Dashboard →' : 'Select a Scenario Above'}
            </button>
            <style>{`@keyframes scaleIn { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
          </div>
        )}

        {/* ─── LOADING STATE ─── */}
        {phase === 'loading' && (
          <div style={{
            background: '#ffffff', borderRadius: '20px',
            border: '1px solid #e8e8e8', padding: '32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          }}>
            <h3 style={{ fontSize: '11px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '20px' }}>
              Connecting Fleet...
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {LOADING_STEPS.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  opacity: i <= currentStep ? 1 : 0.3, transition: 'opacity 0.4s ease',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i < currentStep ? '#16a34a' : i === currentStep ? '#111111' : '#e8e8e8',
                    transition: 'background 0.3s ease',
                  }}>
                    {i < currentStep ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : i === currentStep ? (
                      <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #999', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} />
                    ) : (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ccc' }} />
                    )}
                  </div>
                  <span style={{
                    fontSize: '13px', fontWeight: i <= currentStep ? 600 : 400,
                    color: i < currentStep ? '#16a34a' : i === currentStep ? '#111111' : '#999999',
                  }}>{step.text}</span>
                </div>
              ))}
            </div>
            <div style={{ width: '100%', height: 4, borderRadius: 2, background: '#f0f0f0', overflow: 'hidden', marginTop: '20px' }}>
              <div style={{
                width: `${(currentStep / LOADING_STEPS.length) * 100}%`, height: '100%', borderRadius: 2,
                background: 'linear-gradient(90deg, #16a34a, #22c55e)', transition: 'width 0.5s ease',
              }} />
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ─── FORM STATE ─── */}
        {(phase === 'form' || phase === 'validating' || phase === 'error') && (
          <div style={{
            background: '#ffffff', borderRadius: '20px',
            border: '1px solid #e8e8e8', padding: '32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          }}>
            <label style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Fleet API Key
            </label>
            <input
              type="text" value={apiKey}
              onChange={e => { setApiKey(e.target.value); if (phase === 'error') setPhase('form') }}
              placeholder="Paste your fleet API key here..."
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '12px',
                border: phase === 'error' ? '1px solid #dc2626' : '1px solid #e8e8e8',
                background: '#fafafa', fontFamily: 'Inter, sans-serif', fontSize: '13px',
                color: '#111111', outline: 'none', marginBottom: '6px',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={e => e.target.style.borderColor = '#111111'}
              onBlur={e => e.target.style.borderColor = phase === 'error' ? '#dc2626' : '#e8e8e8'}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
            />
            {/* Demo hint */}
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: '#bbbbbb' }}>Demo key:</span>
              <code
                onClick={() => setApiKey('fleet_demo_key_xyz789')}
                style={{
                  fontSize: '10px', color: '#6366f1', background: '#f5f5ff',
                  padding: '2px 8px', borderRadius: '5px', cursor: 'pointer',
                  border: '1px solid #e0e0ff', fontFamily: 'monospace',
                }}
                title="Click to autofill"
              >
                fleet_demo_key_xyz789
              </code>
              <span style={{ fontSize: '10px', color: '#cccccc' }}>← click to fill</span>
            </div>

            {/* Error */}
            {phase === 'error' && (
              <div style={{
                padding: '10px 14px', borderRadius: '10px',
                background: '#fef2f2', border: '1px solid #fecaca',
                display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>{errorMsg}</span>
              </div>
            )}

            {/* Connect button */}
            <button onClick={handleConnect} disabled={phase === 'validating'} style={{
              width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
              cursor: phase === 'validating' ? 'wait' : 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600,
              color: '#ffffff', background: phase === 'validating' ? '#666666' : '#111111',
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              marginBottom: '16px',
            }}>
              {phase === 'validating' ? (
                <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #999', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} /> Validating...</>
              ) : 'Connect Fleet'}
            </button>

            {/* Skip link */}
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => { setTrucksLoaded(24); setPhase('success') }} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', color: '#bbbbbb', fontFamily: 'Inter, sans-serif',
                textDecoration: 'underline', textUnderlineOffset: '2px',
              }}>
                Skip — use demo fleet
              </button>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    </div>
  )
}
