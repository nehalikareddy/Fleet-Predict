import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Base fleet dispatch messages ─────────────────────────────────────────────
const BASE_DISPATCH = [
  (truck) => `Rerouting via ${truck.assigned_route || 'I-43'} to avoid cascade. Nav updated.`,
  (truck) => `Speed advisory: reduced to ${Math.round(40 + Math.random() * 15)}mph on I-94. Alternate locked.`,
  (truck) => `ETA recalculated. New arrival: ${truck.deadline_hour || 17}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')}. Hold lane.`,
  (truck) => `Constraint check passed. HOS compliant. Proceed on ${truck.assigned_route || 'Highway-50'}.`,
  (truck) => `Weather gate cleared. Resume standard speed on ${truck.assigned_route || 'I-43'}.`,
  (truck) => `Cascade prevention active. Holding at staging zone ${Math.floor(Math.random() * 4) + 1}.`,
]



function getTimestamp() {
  const now = new Date()
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':')
}

const CONTEXT_MAP = {
  chicago: 'Driver hours-of-service (HoS) violation imminent on I-94 Chicago–Milwaukee corridor. Some trucks must divert to truck stops.',
  detroit: 'Critical engine derate on I-90 near Detroit. One truck immobilized at mile marker 94. Upstream cascade risk for 11 trucks heading to Cleveland.',
  indianapolis: 'Bridge weight restriction on rural shortcut near Indianapolis. Heavy trucks (>40,000 lbs) must stay on I-74 primary. Light trucks may use US-52 shortcut to Cincinnati.',
}

export default function DispatchFeed({ fleetData, disruption, mode, activeScenario }) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [aiSource, setAiSource] = useState(null) // 'gemini' | 'fallback'
  const feedRef = useRef(null)
  const hasStreamedRef = useRef(null)

  // Auto-scroll
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [messages])

  const streamScenarioMessages = useCallback(async (scenarioKey) => {
    setIsStreaming(true)
    setMessages([{
      id: Date.now(), type: 'system',
      text: `Generating dispatch — Gemini AI analyzing fleet constraints...`,
      time: getTimestamp(),
    }])

    let result = { messages: [], source: 'fallback' }
    try {
      const context = CONTEXT_MAP[scenarioKey] || `Active fleet scenario: ${scenarioKey}`
      const res = await fetch(`${import.meta.env.VITE_AI_URL || 'http://localhost:8001'}/generate-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioKey, trucks: fleetData.slice(0, 6), context }),
      })
      result = await res.json()
    } catch (e) {
      console.warn('[DispatchFeed] Gemini endpoint unavailable, using fallback', e)
    }

    setAiSource(result.source)
    setMessages([])

    for (let i = 0; i < result.messages.length; i++) {
      const msg = result.messages[i]
      setMessages(prev => [...prev, {
        id: Date.now() + i,
        ...msg,
        prefix: msg.prefix || 'DISPATCH',
        time: getTimestamp(),
      }])
      await new Promise(r => setTimeout(r, 700))
    }

    setIsStreaming(false)
  }, [fleetData])

  const streamBaseMessages = useCallback(async (trucks) => {
    setIsStreaming(true)
    setMessages([{
      id: Date.now(),
      type: 'system',
      text: `DISRUPTION DETECTED — Initiating distributed reroute for ${trucks.length} assets`,
      time: getTimestamp(),
    }])

    await new Promise(r => setTimeout(r, 400))

    const shuffled = [...trucks].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(12, trucks.length))

    for (let i = 0; i < selected.length; i++) {
      const truck = selected[i]
      const msgTemplate = BASE_DISPATCH[Math.floor(Math.random() * BASE_DISPATCH.length)]
      setMessages(prev => [...prev, {
        id: Date.now() + i,
        type: 'dispatch',
        truckId: truck.truck_id,
        driver: truck.driver,
        prefix: 'DISPATCH',
        route: truck.assigned_route,
        status: truck.status,
        text: msgTemplate(truck),
        time: getTimestamp(),
      }])
      await new Promise(r => setTimeout(r, 200 + Math.random() * 400))
    }

    await new Promise(r => setTimeout(r, 300))
    const onTimeCount = trucks.filter(t => t.status === 'on_time' || t.status === 'holding').length
    setMessages(prev => [...prev, {
      id: Date.now() + 999,
      type: 'confirm',
      text: `ALL DISPATCHES SENT — ${onTimeCount}/${trucks.length} assets rerouted successfully. Cascade prevented.`,
      time: getTimestamp(),
    }])

    setIsStreaming(false)
  }, [])

  // Trigger on scenario change
  useEffect(() => {
    if (activeScenario && activeScenario !== hasStreamedRef.current && fleetData.length > 0) {
      hasStreamedRef.current = activeScenario
      streamScenarioMessages(activeScenario)
    }
  }, [activeScenario, fleetData, streamScenarioMessages])

  // Trigger on base disruption
  useEffect(() => {
    if (!activeScenario && disruption?.active && mode === 'fleetpredict' && fleetData.length > 0) {
      const key = `disruption-${disruption.timestamp}`
      if (hasStreamedRef.current !== key) {
        hasStreamedRef.current = key
        streamBaseMessages(fleetData)
      }
    }
    if (!disruption?.active && !activeScenario) {
      hasStreamedRef.current = null
    }
  }, [disruption, mode, fleetData, activeScenario, streamBaseMessages])

  if (messages.length === 0) return null

  return (
    <div style={{
      background: 'rgba(17, 17, 17, 0.92)',
      backdropFilter: 'blur(12px)',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      width: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isStreaming ? '#22c55e' : '#555555',
            boxShadow: isStreaming ? '0 0 8px rgba(34,197,94,0.6)' : 'none',
          }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#888888', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Live Dispatch Feed
          </span>
          {aiSource === 'gemini' && (
            <span style={{ fontSize: '8px', fontWeight: 700, color: '#818cf8', background: 'rgba(129,140,248,0.15)', padding: '1px 6px', borderRadius: '4px', letterSpacing: '0.08em' }}>
              GEMINI AI
            </span>
          )}
        </div>
        <span style={{ fontSize: '9px', color: '#555555', fontWeight: 500 }}>
          {messages.length} msg{messages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Messages */}
      <div ref={feedRef} style={{
        maxHeight: '160px', overflowY: 'auto', padding: '8px 12px',
        display: 'flex', flexDirection: 'column', gap: '3px', scrollBehavior: 'smooth',
      }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ fontSize: '10px', lineHeight: 1.5, animation: 'fadeSlideIn 0.3s ease' }}>
            {msg.type === 'system' && (
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                <span style={{ color: '#666666' }}>[{msg.time}]</span> ⚠ {msg.text}
              </span>
            )}
            {msg.type === 'confirm' && (
              <span style={{ color: '#22c55e', fontWeight: 600 }}>
                <span style={{ color: '#666666' }}>[{msg.time}]</span> ✅ {msg.text}
              </span>
            )}
            {msg.type === 'fault' && (
              <span>
                <span style={{ color: '#666666' }}>[{msg.time}]</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}> 🔴 {msg.prefix}</span>
                <span style={{ color: '#888888' }}> → </span>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>{msg.truckId}</span>
                {msg.driver && <span style={{ color: '#666666' }}> ({msg.driver})</span>}
                <span style={{ color: '#a1a1aa' }}>: "{msg.text}"</span>
              </span>
            )}
            {msg.type === 'warn' && (
              <span>
                <span style={{ color: '#666666' }}>[{msg.time}]</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}> ⚠ {msg.prefix || 'DISPATCH'}</span>
                <span style={{ color: '#888888' }}> → </span>
                <span style={{ color: '#f97316', fontWeight: 600 }}>{msg.truckId}</span>
                {msg.driver && <span style={{ color: '#666666' }}> ({msg.driver})</span>}
                <span style={{ color: '#a1a1aa' }}>: "{msg.text}"</span>
              </span>
            )}
            {msg.type === 'dispatch' && (
              <span>
                <span style={{ color: '#666666' }}>[{msg.time}]</span>
                <span style={{ color: '#60a5fa' }}> 📡 {msg.prefix || 'DISPATCH'}</span>
                <span style={{ color: '#888888' }}> → </span>
                <span style={{
                  color: msg.status === 'late' ? '#f87171' : msg.status === 'holding' ? '#fbbf24' : '#4ade80',
                  fontWeight: 600,
                }}>
                  {msg.truckId}
                </span>
                {msg.driver && <span style={{ color: '#666666' }}> ({msg.driver})</span>}
                <span style={{ color: '#a1a1aa' }}>: "{msg.text}"</span>
              </span>
            )}
          </div>
        ))}
        {isStreaming && (
          <div style={{ fontSize: '10px', color: '#555555', animation: 'blink 1s step-end infinite' }}>▌</div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}
