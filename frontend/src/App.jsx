import { useState, useEffect } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from './firebase'
import MapView from './components/MapView'
import AlertBanner from './components/AlertBanner'
import ModeToggle from './components/ModeToggle'
import KPIPanel from './components/KPIPanel'
import DiagnosticPanel from './components/DiagnosticPanel'
import DispatchFeed from './components/DispatchFeed'
import OnboardingPage from './components/OnboardingPage'
import RoutesView from './components/RoutesView'
import OverviewPanel from './components/OverviewPanel'
import ScenarioSwitcher from './components/ScenarioSwitcher'

function App() {
  // ─── Onboarding gate ───────────────────────────────────────────────
  const [isOnboarded, setIsOnboarded] = useState(false)

  // ─── Dashboard state ───────────────────────────────────────────────
  const [mode, setMode] = useState("fleetpredict")
  const [fleetData, setFleetData] = useState([])
  const [kpiData, setKpiData] = useState({})
  const [disruption, setDisruption] = useState({})
  const [simulationRunning, setSimulationRunning] = useState(false)
  const [hasRunOnce, setHasRunOnce] = useState(false)
  const [selectedTruck, setSelectedTruck] = useState(null)
  const [activeNav, setActiveNav] = useState('Fleet')
  const [activeScenario, setActiveScenario] = useState(null)

  // ─── Firebase listener ─────────────────────────────────────────────
  useEffect(() => {
    const demoRef = ref(db, 'demo-state')
    const unsub = onValue(demoRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) return

      const fleetIsEmpty = !data.fleet || (Array.isArray(data.fleet) && data.fleet.length === 0)
      if (fleetIsEmpty) {
        setFleetData([])
        setKpiData({})
        setDisruption({})
        setHasRunOnce(false)
        setSelectedTruck(null)
      } else if (Array.isArray(data.fleet) && data.fleet.length > 0) {
        setFleetData(data.fleet)
        setHasRunOnce(true)
      }

      if (data.kpi && typeof data.kpi === 'object') setKpiData(data.kpi)
      setDisruption(data.disruption || {})
      setSimulationRunning(data.simulation_running || false)
      setActiveScenario(data.active_scenario || null)
    })
    return () => unsub()
  }, [])

  // ─── Onboarding gate ───────────────────────────────────────────────
  if (!isOnboarded) {
    return (
      <OnboardingPage
        onComplete={() => setIsOnboarded(true)}
        activeScenario={activeScenario}
        simulationRunning={simulationRunning}
      />
    )
  }

  // ─── Render dashboard nav items ────────────────────────────────────
  const navItems = ['Overview', 'Fleet', 'Routes']

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#e4e4e7' }}>

      {/* Top Navigation Bar */}
      <header className="h-[56px] flex items-center justify-between px-7 flex-shrink-0"
        style={{ background: '#ffffff', borderBottom: '1px solid #e8e8e8' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{ background: '#111111' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 18H3a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h6l2 3h6a2 2 0 012 2v7a2 2 0 01-2 2h-2"/>
              <circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
              <path d="M7 16h10"/>
            </svg>
          </div>
          <span style={{ fontWeight: 600, color: '#111111', fontSize: '15px', letterSpacing: '-0.01em' }}>FleetPredict</span>
        </div>

        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-0.5 mr-5">
            {navItems.map((item) => (
              <button key={item}
                onClick={() => setActiveNav(item)}
                className="px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all"
                style={activeNav === item
                  ? { background: '#f2f2f2', color: '#111111' }
                  : { color: '#999999' }
                }
              >
                {item}
              </button>
            ))}
          </nav>

          {hasRunOnce && (
            <div className="flex items-center gap-2 pl-4" style={{ borderLeft: '1px solid #e8e8e8' }}>
              <div className="live-dot" />
              <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em' }}>LIVE</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content — Tab-based rendering */}
      <main className="flex flex-1 overflow-hidden p-3 gap-3">

        {/* ─── ROUTES TAB ─── */}
        {activeNav === 'Routes' && (
          <RoutesView activeScenario={activeScenario} mode={mode} />
        )}

        {/* ─── FLEET TAB (default dashboard) ─── */}
        {activeNav === 'Fleet' && (
          <>
            {/* Left: Map */}
            <div className="flex-1 h-full map-container relative">
              <MapView
                fleetData={fleetData}
                mode={mode}
                disruption={disruption}
                onSelectTruck={setSelectedTruck}
                activeScenario={activeScenario}
              />

              {/* Floating route legend */}
              {hasRunOnce && (
              <div className="absolute bottom-4 left-4 z-10" style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #e8e8e8',
                borderRadius: '12px',
                padding: '8px 14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <div className="flex items-center gap-4" style={{ fontSize: '11px', fontWeight: 500 }}>
                  {mode === "reactive" ? (
                    <div className="flex items-center gap-2">
                      <div style={{ width: 12, height: 3, borderRadius: 2, background: '#dc2626' }} />
                      <span style={{ color: '#666666' }}>Single Route (Congested)</span>
                    </div>
                  ) : activeScenario === 'detroit' ? (
                    <>
                      <div className="flex items-center gap-2"><div style={{ width: 12, height: 3, borderRadius: 2, background: '#2563eb' }} /><span style={{ color: '#666666' }}>I-90</span></div>
                      <div className="flex items-center gap-2"><div style={{ width: 12, height: 3, borderRadius: 2, background: '#16a34a' }} /><span style={{ color: '#666666' }}>I-80 Alt</span></div>
                    </>
                  ) : activeScenario === 'indianapolis' ? (
                    <>
                      <div className="flex items-center gap-2"><div style={{ width: 12, height: 3, borderRadius: 2, background: '#2563eb' }} /><span style={{ color: '#666666' }}>I-74</span></div>
                      <div className="flex items-center gap-2"><div style={{ width: 12, height: 3, borderRadius: 2, background: '#f97316' }} /><span style={{ color: '#666666' }}>I-70 Detour</span></div>
                      <div className="flex items-center gap-2"><div style={{ width: 12, height: 3, borderRadius: 2, background: '#16a34a' }} /><span style={{ color: '#666666' }}>US-52</span></div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2"><div style={{ width: 12, height: 3, borderRadius: 2, background: '#2563eb' }} /><span style={{ color: '#666666' }}>I-94</span></div>
                      <div className="flex items-center gap-2"><div style={{ width: 12, height: 3, borderRadius: 2, background: '#d97706' }} /><span style={{ color: '#666666' }}>US-41 Alt</span></div>
                    </>
                  )}
                </div>
              </div>
              )}

              {/* Floating marker legend */}
              {hasRunOnce && (
              <div className="absolute top-4 left-4 z-10" style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #e8e8e8',
                borderRadius: '12px',
                padding: '8px 14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <div className="flex items-center gap-4" style={{ fontSize: '10px', fontWeight: 500, color: '#666666' }}>
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', opacity: 0.6 }} />
                    <span>On-Time</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
                    <span>Minor</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '9px solid #dc2626' }} />
                    <span>Critical</span>
                  </div>
                </div>
              </div>
              )}

              {/* Dispatch feed */}
              {hasRunOnce && (
                <div className="absolute bottom-4 right-4 z-10" style={{ width: '420px' }}>
                  <DispatchFeed fleetData={fleetData} disruption={disruption} mode={mode} activeScenario={activeScenario} />
                </div>
              )}
            </div>

            {/* Right: Sidebar */}
            <aside className="w-[340px] h-full overflow-y-auto flex flex-col gap-2.5 pr-0.5 flex-shrink-0">
              <AlertBanner disruption={disruption} mode={mode} />
              <ModeToggle mode={mode} onModeChange={setMode} />

              {selectedTruck ? (
                <DiagnosticPanel
                  truck={selectedTruck}
                  mode={mode}
                  onClose={() => setSelectedTruck(null)}
                />
              ) : (
                <KPIPanel kpiData={kpiData} mode={mode} hasRunOnce={hasRunOnce} />
              )}

              {/* Reset Control */}
              <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                <button
                  onClick={async () => {
                    await fetch('http://localhost:3000/reset', { method: 'POST' });
                    setIsOnboarded(false);
                  }}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '10px',
                    border: '1px solid #e0e0e0', background: '#ffffff',
                    color: '#dc2626', fontSize: '11px', fontWeight: 600,
                    fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e0e0e0' }}
                >
                  End Demo & Reset
                </button>
              </div>
            </aside>
          </>
        )}

        {/* ─── OVERVIEW TAB ─── */}
        {activeNav === 'Overview' && (
          <>
            {/* Left: Map (read-only view) */}
            <div className="flex-1 h-full map-container relative">
              <MapView
                fleetData={fleetData}
                mode={mode}
                disruption={disruption}
                onSelectTruck={setSelectedTruck}
                activeScenario={activeScenario}
              />
            </div>

            {/* Right: Overview sidebar */}
            <aside className="w-[340px] h-full overflow-y-auto flex flex-col gap-2.5 pr-0.5 flex-shrink-0">
              <OverviewPanel
                fleetData={fleetData}
                kpiData={kpiData}
                disruption={disruption}
                mode={mode}
                hasRunOnce={hasRunOnce}
              />
            </aside>
          </>
        )}

      </main>
    </div>
  )
}

export default App
