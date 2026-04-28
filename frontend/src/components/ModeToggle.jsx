export default function ModeToggle({ mode, onModeChange }) {
  return (
    <div className="card" style={{ padding: '16px' }}>
      <h2 style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '10px' }}>
        Routing Mode
      </h2>

      <div className="flex gap-2">
        <button
          onClick={() => onModeChange("reactive")}
          className={`mode-btn flex-1 flex flex-col items-center justify-center gap-1 ${
            mode === "reactive" ? "mode-btn-reactive-active" : "mode-btn-reactive-inactive"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: mode === "reactive" ? '#dc2626' : '#cccccc'
            }} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Reactive</span>
          </div>
          <span style={{ fontSize: '10px', opacity: 0.5, lineHeight: 1.3 }}>Single route</span>
        </button>

        <button
          onClick={() => onModeChange("fleetpredict")}
          className={`mode-btn flex-1 flex flex-col items-center justify-center gap-1 ${
            mode === "fleetpredict" ? "mode-btn-fp-active" : "mode-btn-fp-inactive"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: mode === "fleetpredict" ? '#16a34a' : '#cccccc'
            }} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>FleetPredict</span>
          </div>
          <span style={{ fontSize: '10px', opacity: 0.5, lineHeight: 1.3 }}>Distributed</span>
        </button>
      </div>
    </div>
  )
}
