export default function OverviewPanel({ fleetData, kpiData, disruption, mode, hasRunOnce }) {
  const fpKpi = kpiData?.fleetpredict || {}
  const rxKpi = kpiData?.reactive || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* System Status */}
      <div className="card" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '12px' }}>
          System Status
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { name: 'Python AI Engine', port: 8001, color: '#16a34a' },
            { name: 'Node Orchestrator', port: 3000, color: '#16a34a' },
            { name: 'Firebase Realtime DB', port: null, color: '#16a34a' },
          ].map(svc => (
            <div key={svc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: svc.color }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#333333' }}>{svc.name}</span>
              </div>
              <span style={{ fontSize: '10px', color: '#999999', fontWeight: 500 }}>
                {svc.port ? `Port ${svc.port}` : 'Cloud'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Fleet Summary */}
      <div className="card" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '12px' }}>
          Fleet Summary
        </h2>
        {hasRunOnce ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: '#f8f8f8', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '4px' }}>Total Assets</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#111111' }}>{fleetData.length}</div>
            </div>
            <div style={{ background: '#f8f8f8', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '4px' }}>On-Time Rate</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#16a34a' }}>{fpKpi.on_time_rate || 0}%</div>
            </div>
            <div style={{ background: '#f8f8f8', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '4px' }}>Disruption</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: disruption?.active ? '#dc2626' : '#16a34a' }}>
                {disruption?.active ? `Severity ${disruption.severity}/10` : 'None Active'}
              </div>
            </div>
            <div style={{ background: '#f8f8f8', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '4px' }}>Savings vs Reactive</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a' }}>
                ${((rxKpi.total_penalty_cost || 0) - (fpKpi.total_penalty_cost || 0)).toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: '12px', color: '#bbbbbb', fontWeight: 500 }}>
              Trigger a simulation to see fleet metrics
            </p>
          </div>
        )}
      </div>

      {/* Architecture */}
      <div className="card" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '10px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '12px' }}>
          Architecture
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { from: 'React Dashboard', to: 'Node Backend', label: 'POST /trigger-simulation' },
            { from: 'Node Backend', to: 'Python AI', label: 'POST /predict-disruption' },
            { from: 'Python AI', to: 'FAISS + Speed Model', label: 'Prophet-free prediction' },
            { from: 'Node Backend', to: 'Firebase RTDB', label: 'SET demo-state/*' },
            { from: 'Firebase RTDB', to: 'React Dashboard', label: 'onValue() listener' },
          ].map((flow, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '10px', fontWeight: 500, color: '#666666',
              padding: '6px 8px', background: '#f8f8f8', borderRadius: '8px',
            }}>
              <span style={{ color: '#111111', fontWeight: 600, minWidth: '80px' }}>{flow.from}</span>
              <span style={{ color: '#cccccc' }}>→</span>
              <span style={{ color: '#111111', fontWeight: 600, minWidth: '80px' }}>{flow.to}</span>
              <span style={{ color: '#bbbbbb', fontSize: '9px', marginLeft: 'auto' }}>{flow.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
