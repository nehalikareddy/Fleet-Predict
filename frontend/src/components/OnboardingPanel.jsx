import { useState, useEffect, useRef } from 'react'

const PROVIDERS = [
  { id: 'samsara', name: 'Samsara', icon: '◆' },
  { id: 'motive', name: 'Motive (KeepTruckin)', icon: '▲' },
  { id: 'geotab', name: 'Geotab', icon: '●' },
  { id: 'platform_science', name: 'Platform Science', icon: '■' },
]

const LOADING_STEPS = [
  { text: 'API Connection Successful', duration: 800 },
  { text: 'Fetching Fleet B coordinates...', duration: 1200 },
  { text: 'Translating JSON data...', duration: 1000 },
  { text: 'Applying vehicle constraints...', duration: 1400 },
]

export default function OnboardingPanel({ onComplete }) {
  const [provider, setProvider] = useState('samsara')
  const [apiKey, setApiKey] = useState('')
  const [phase, setPhase] = useState('form')        // form | validating | error | loading | success
  const [errorMsg, setErrorMsg] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [trucksLoaded, setTrucksLoaded] = useState(0)
  const [providerOpen, setProviderOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProviderOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setErrorMsg('Please enter an API key.')
      setPhase('error')
      return
    }

    setPhase('validating')

    // Simulated validation delay
    await new Promise(r => setTimeout(r, 1500))

    try {
      const res = await fetch('http://localhost:3000/onboard-fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Connection failed.')
        setPhase('error')
        return
      }

      // Success — run loading progression
      setTrucksLoaded(data.trucks_loaded)
      setPhase('loading')
      setCurrentStep(0)

      for (let i = 0; i < LOADING_STEPS.length; i++) {
        await new Promise(r => setTimeout(r, LOADING_STEPS[i].duration))
        setCurrentStep(i + 1)
      }

      await new Promise(r => setTimeout(r, 600))
      setPhase('success')

    } catch (err) {
      setErrorMsg('Cannot connect to server on port 3000.')
      setPhase('error')
    }
  }

  const selectedProvider = PROVIDERS.find(p => p.id === provider)

  // ─── SUCCESS STATE ──────────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <div className="card flex flex-col items-center justify-center gap-4" style={{ padding: '40px 24px' }}>
        {/* Animated checkmark */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #16a34a, #22c55e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          boxShadow: '0 8px 24px rgba(22, 163, 74, 0.3)',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-1">
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111111' }}>Onboarding Complete!</h2>
          <p style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
            {trucksLoaded} Trucks Loaded
          </p>
          <p style={{ fontSize: '11px', color: '#999999', marginTop: '2px' }}>
            FedEx East Coast Fleet • via {selectedProvider?.name}
          </p>
        </div>

        <button
          onClick={() => onComplete && onComplete()}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: '#ffffff',
            background: '#111111',
            transition: 'all 0.2s ease',
            marginTop: '4px',
          }}
          onMouseEnter={e => e.target.style.background = '#333333'}
          onMouseLeave={e => e.target.style.background = '#111111'}
        >
          View My Fleet →
        </button>

        <style>{`
          @keyframes scaleIn {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // ─── LOADING STATE ──────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="card flex flex-col gap-4" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
          Onboarding Fleet B
        </h2>

        <div className="flex flex-col gap-3">
          {LOADING_STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-3" style={{
              opacity: i <= currentStep ? 1 : 0.3,
              transition: 'opacity 0.4s ease',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i < currentStep ? '#16a34a' : i === currentStep ? '#111111' : '#e8e8e8',
                transition: 'background 0.3s ease',
                flexShrink: 0,
              }}>
                {i < currentStep ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : i === currentStep ? (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    border: '2px solid #ffffff', borderTopColor: 'transparent',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                ) : (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#cccccc' }} />
                )}
              </div>
              <span style={{
                fontSize: '12px', fontWeight: i <= currentStep ? 600 : 400,
                color: i < currentStep ? '#16a34a' : i === currentStep ? '#111111' : '#999999',
                transition: 'color 0.3s ease',
              }}>
                {step.text}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{
          width: '100%', height: 3, borderRadius: 2, background: '#f0f0f0', overflow: 'hidden', marginTop: '4px'
        }}>
          <div style={{
            width: `${(currentStep / LOADING_STEPS.length) * 100}%`,
            height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, #16a34a, #22c55e)',
            transition: 'width 0.5s ease',
          }} />
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ─── FORM STATE (default) ───────────────────────────────────────────
  return (
    <div className="card flex flex-col gap-4" style={{ padding: '20px' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div style={{
          width: 28, height: 28, borderRadius: '8px',
          background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#111111', lineHeight: 1.2 }}>
            Telematics Integration
          </h2>
          <p style={{ fontSize: '10px', color: '#999999', fontWeight: 500 }}>
            Connect your fleet provider
          </p>
        </div>
      </div>

      {/* Provider selector */}
      <div className="flex flex-col gap-1.5">
        <label style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Provider
        </label>
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setProviderOpen(!providerOpen)}
            style={{
              width: '100%', padding: '10px 12px',
              borderRadius: '10px', border: '1px solid #e8e8e8',
              background: '#fafafa', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500,
              color: '#111111', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'border-color 0.2s ease',
            }}
          >
            <span className="flex items-center gap-2">
              <span style={{ fontSize: '10px' }}>{selectedProvider?.icon}</span>
              {selectedProvider?.name}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {providerOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#ffffff', borderRadius: '10px',
              border: '1px solid #e8e8e8',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              zIndex: 50, marginTop: '4px', overflow: 'hidden',
            }}>
              {PROVIDERS.map(p => (
                <button key={p.id}
                  onClick={() => { setProvider(p.id); setProviderOpen(false) }}
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: 'none', background: p.id === provider ? '#f5f5f5' : '#ffffff',
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    fontSize: '12px', fontWeight: p.id === provider ? 600 : 400,
                    color: '#111111', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => e.target.style.background = '#f5f5f5'}
                  onMouseLeave={e => { if (p.id !== provider) e.target.style.background = '#ffffff' }}
                >
                  <span style={{ fontSize: '10px' }}>{p.icon}</span>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* API Key input */}
      <div className="flex flex-col gap-1.5">
        <label style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          API Key
        </label>
        <input
          type="text"
          value={apiKey}
          onChange={e => { setApiKey(e.target.value); if (phase === 'error') setPhase('form') }}
          placeholder="Paste your API key here..."
          style={{
            width: '100%', padding: '10px 12px',
            borderRadius: '10px',
            border: phase === 'error' ? '1px solid #dc2626' : '1px solid #e8e8e8',
            background: '#fafafa',
            fontFamily: 'Inter, sans-serif', fontSize: '12px',
            color: '#111111', outline: 'none',
            transition: 'border-color 0.2s ease',
          }}
          onFocus={e => e.target.style.borderColor = '#111111'}
          onBlur={e => e.target.style.borderColor = phase === 'error' ? '#dc2626' : '#e8e8e8'}
        />
      </div>

      {/* Error message */}
      {phase === 'error' && (
        <div style={{
          padding: '10px 12px', borderRadius: '10px',
          background: '#fef2f2', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'fadeIn 0.3s ease',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>{errorMsg}</span>
        </div>
      )}

      {/* Connect button */}
      <button
        onClick={handleConnect}
        disabled={phase === 'validating'}
        style={{
          width: '100%', padding: '12px',
          borderRadius: '12px', border: 'none',
          cursor: phase === 'validating' ? 'wait' : 'pointer',
          fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600,
          color: '#ffffff',
          background: phase === 'validating' ? '#666666' : '#111111',
          transition: 'all 0.2s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
      >
        {phase === 'validating' ? (
          <>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid #999999', borderTopColor: '#ffffff',
              animation: 'spin 0.6s linear infinite',
            }} />
            Validating key...
          </>
        ) : (
          'Connect My Fleet'
        )}
      </button>

      {/* Hint text */}
      <p style={{ fontSize: '9px', color: '#bbbbbb', textAlign: 'center', fontWeight: 500, lineHeight: 1.4 }}>
        For demo: try <code style={{ background: '#f5f5f5', padding: '1px 4px', borderRadius: '3px', fontSize: '9px' }}>samsara_fedex_fleet_xyz789</code>
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
