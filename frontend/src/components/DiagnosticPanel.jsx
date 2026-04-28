export default function DiagnosticPanel({ truck, mode, onClose }) {
  if (!truck) return null

  const status = mode === "reactive" ? truck.reactive_status : truck.status
  const delay = mode === "reactive" ? truck.reactive_delay_mins : truck.delay_mins
  const route = mode === "reactive" ? "Highway-50" : (truck.assigned_route || "Holding")

  const statusColor = status === "late" ? "#dc2626" : status === "on_time" ? "#16a34a" : "#d97706"
  const hosPass = truck.hos_valid !== false
  const weightOk = (truck.weight_tons || 0) <= 20

  return (
    <div className="card flex flex-col" style={{ padding: '20px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{ background: '#f5f5f5' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
              <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div>
            <h3 style={{ color: '#111111', fontWeight: 700, fontSize: '14px', lineHeight: 1.2 }}>
              {truck.truck_id}
            </h3>
            <p style={{ color: '#999999', fontSize: '10px', marginTop: '1px', textTransform: 'capitalize' }}>
              {truck.tier} · {truck.cargo_type}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28, height: 28,
            borderRadius: '8px',
            border: '1px solid #e8e8e8',
            background: '#fafafa',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-4">
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '5px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
          textTransform: 'capitalize',
          background: status === "late" ? '#fef2f2' : status === "on_time" ? '#f0fdf4' : '#fffbeb',
          color: statusColor,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
          {status}
        </span>
        {delay > 0 && (
          <span style={{
            padding: '5px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
            background: '#f5f5f5', color: '#666666',
          }}>
            +{delay} min
          </span>
        )}
      </div>

      {/* Diagnostic Grid */}
      <div className="flex flex-col gap-2">
        {/* Route */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px', borderRadius: '12px', background: '#fafafa', border: '1px solid #f0f0f0',
        }}>
          <div>
            <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Current Route</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{route}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cccccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>

        {/* HOS Remaining */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px', borderRadius: '12px', background: '#fafafa', border: '1px solid #f0f0f0',
        }}>
          <div>
            <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Hours of Service</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>
              {truck.hours_driven || 0}h driven
              <span style={{ color: '#999999', fontWeight: 400 }}> / 11h max</span>
            </div>
          </div>
          <span style={{
            padding: '4px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 700,
            background: hosPass ? '#f0fdf4' : '#fef2f2',
            color: hosPass ? '#16a34a' : '#dc2626',
          }}>
            {hosPass ? "PASS" : "FAIL"}
          </span>
        </div>

        {/* Weight Limit */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px', borderRadius: '12px', background: '#fafafa', border: '1px solid #f0f0f0',
        }}>
          <div>
            <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Weight Load</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>
              {truck.weight_tons || 0} tons
              <span style={{ color: '#999999', fontWeight: 400 }}> / 20t limit</span>
            </div>
          </div>
          <span style={{
            padding: '4px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 700,
            background: weightOk ? '#f0fdf4' : '#fef2f2',
            color: weightOk ? '#16a34a' : '#dc2626',
          }}>
            {weightOk ? "PASS" : "OVER"}
          </span>
        </div>

        {/* Delay Breakdown */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px', borderRadius: '12px', background: '#fafafa', border: '1px solid #f0f0f0',
        }}>
          <div>
            <div style={{ fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Exact Delay</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: delay > 0 ? '#dc2626' : '#16a34a' }}>
              {delay > 0 ? `${delay} minutes behind` : "On schedule"}
            </div>
          </div>
          <div style={{
            fontSize: '9px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Deadline: {truck.deadline_hour || '—'}:00
          </div>
        </div>
      </div>

      {/* Coordinates */}
      <div className="flex items-center gap-2 mt-3" style={{ fontSize: '10px', color: '#bbbbbb' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#cccccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        {truck.lat?.toFixed(4)}, {truck.lng?.toFixed(4)}
      </div>
    </div>
  )
}
