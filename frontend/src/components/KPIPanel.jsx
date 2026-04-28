export default function KPIPanel({ kpiData, mode, hasRunOnce }) {
  if (!hasRunOnce) {
    return (
      <div className="card flex flex-col items-center justify-center text-center"
        style={{ padding: '32px 20px', minHeight: '160px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cccccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
          <rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
          <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1"/>
          <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        <p style={{ color: '#888888', fontSize: '12px', fontWeight: 500 }}>
          Trigger a disruption to see fleet metrics
        </p>
        <p style={{ color: '#bbbbbb', fontSize: '11px', marginTop: '4px' }}>
          Data appears here after simulation runs
        </p>
      </div>
    )
  }

  const activeKPI = mode === "reactive" ? kpiData?.reactive : kpiData?.fleetpredict
  if (!activeKPI) return null

  const savings = (kpiData?.reactive?.total_penalty_cost || 0) - (kpiData?.fleetpredict?.total_penalty_cost || 0)
  const isCascadePrevented = activeKPI.cascade_prevented

  const getOnTimeColor = (rate) => {
    if (rate >= 85) return '#16a34a'
    if (rate >= 60) return '#d97706'
    return '#dc2626'
  }

  const getLateColor = (count) => {
    if (count === 0) return '#16a34a'
    if (count <= 5) return '#d97706'
    return '#dc2626'
  }

  return (
    <div className="flex flex-col gap-2.5">
      <h2 style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, paddingLeft: '2px' }}>
        Fleet Metrics
      </h2>

      <div className="grid grid-cols-2 gap-2.5">
        {/* On-Time Rate */}
        <div className="metric-card flex flex-col items-center justify-center text-center">
          <div style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1, marginBottom: '4px', color: getOnTimeColor(activeKPI.on_time_rate) }}>
            {activeKPI.on_time_rate}<span style={{ fontSize: '16px', opacity: 0.6 }}>%</span>
          </div>
          <div style={{ fontSize: '10px', color: '#999999', fontWeight: 500 }}>On-Time Rate</div>
        </div>

        {/* Trucks Late */}
        <div className="metric-card flex flex-col items-center justify-center text-center">
          <div style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1, marginBottom: '4px', color: getLateColor(activeKPI.late_count) }}>
            {activeKPI.late_count}
          </div>
          <div style={{ fontSize: '10px', color: '#999999', fontWeight: 500 }}>Trucks Late</div>
        </div>

        {/* Penalty Cost */}
        <div className="metric-card flex flex-col items-center justify-center text-center">
          <div style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1, marginBottom: '4px', color: '#dc2626' }}>
            <span style={{ fontSize: '16px', opacity: 0.6 }}>$</span>{(activeKPI.total_penalty_cost || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '10px', color: '#999999', fontWeight: 500 }}>Penalty Cost</div>
        </div>

        {/* Cascade */}
        <div className="metric-card flex flex-col items-center justify-center text-center">
          <div style={{ marginBottom: '4px' }}>
            {isCascadePrevented ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            )}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: isCascadePrevented ? '#16a34a' : '#dc2626' }}>
            {isCascadePrevented ? "Cascade Prevented" : "Cascade Active"}
          </div>
        </div>
      </div>

      {/* Savings Callout */}
      {savings > 0 && kpiData?.fleetpredict && kpiData?.reactive && (
        <div className="savings-card">
          <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', opacity: 0.7 }}>
            Total Savings
          </div>
          <h3 style={{ color: '#16a34a', fontWeight: 700, fontSize: '24px', lineHeight: 1, marginBottom: '4px' }}>
            ${savings.toLocaleString()}
          </h3>
          <p style={{ color: '#888888', fontSize: '10px', fontWeight: 500 }}>
            FleetPredict vs Reactive — this incident
          </p>
        </div>
      )}
    </div>
  )
}
