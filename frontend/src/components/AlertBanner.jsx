export default function AlertBanner({ disruption, mode }) {
  if (!disruption?.active) return null

  return (
    <div className="alert-banner">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[10px] flex items-center justify-center"
            style={{ background: '#fef2f2' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 style={{ color: '#111111', fontWeight: 600, fontSize: '13px', lineHeight: 1.2 }}>Disruption Detected</h3>
            <p style={{ color: '#999999', fontSize: '11px', marginTop: '2px' }}>I-94 Corridor</p>
          </div>
        </div>
        <span className="pill" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {disruption.severity || 8}/10
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 mb-3">
        <span className="pill" style={{ background: '#f5f5f5', color: '#666666' }}>
          {disruption.predicted_delay_mins || 45} min delay
        </span>
        <span className="pill" style={{ background: '#f5f5f5', color: '#666666' }}>
          {((disruption.confidence || 0.92) * 100).toFixed(0)}% confidence
        </span>
      </div>

      {/* Context */}
      <p style={{ color: '#999999', fontSize: '11px', marginBottom: '12px', lineHeight: 1.5 }}>
        {disruption.historical_context || "Based on historical severe weather patterns in this corridor"}
      </p>

      {/* Cascade */}
      <div style={{
        borderRadius: '10px',
        padding: '10px 12px',
        background: mode === "reactive" ? '#fef2f2' : '#f0fdf4',
      }}>
        {mode === "reactive" ? (
          <p style={{ color: '#dc2626', fontWeight: 600, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
            CASCADE OVERLOAD — All 30 trucks on Highway 50
          </p>
        ) : (
          <p style={{ color: '#16a34a', fontWeight: 600, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            CASCADE PREVENTED — Fleet distributed across 3 routes
          </p>
        )}
      </div>
    </div>
  )
}
