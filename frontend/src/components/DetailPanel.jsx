export default function DetailPanel({ selectedTruck, mode, kpiData }) {
  if (!selectedTruck) {
    return (
      <div className="w-96 bg-zinc-900/80 border-l border-pink-500/30 h-full flex flex-col items-center justify-center backdrop-blur p-6 text-center rounded-3xl">
        <p className="text-zinc-500 text-sm">Select a truck to view details</p>
      </div>
    )
  }

  const getStatus = (truck) => {
    if (mode === "reactive") {
      return {
        text: truck.reactive_status === "on_time" ? "On Time" : "Late",
        color: truck.reactive_status === "on_time" ? "text-pink-400" : "text-red-400",
        bgColor: truck.reactive_status === "on_time" ? "bg-pink-500/10" : "bg-red-500/10"
      }
    }
    const statusMap = {
      "on_time": { text: "On Time", color: "text-pink-400", bgColor: "bg-pink-500/10" },
      "late": { text: "Late", color: "text-red-400", bgColor: "bg-red-500/10" },
      "holding": { text: "Holding", color: "text-yellow-400", bgColor: "bg-yellow-500/10" }
    }
    return statusMap[truck.status] || statusMap["holding"]
  }

  const getDelayMins = () => {
    if (mode === "reactive") return selectedTruck.reactive_delay_mins
    return selectedTruck.delay_mins
  }

  const status = getStatus(selectedTruck)

  return (
    <aside className="w-96 bg-gradient-to-b from-zinc-900/90 to-zinc-950/80 border-l border-pink-500/30 h-full overflow-y-auto backdrop-blur flex flex-col rounded-3xl">
      {/* Header */}
      <div className="p-6 border-b border-pink-500/20 flex-shrink-0">
        <h2 className="text-white font-bold text-xl mb-2">{selectedTruck.truck_id}</h2>
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${status.bgColor}`}>
          <div className={`w-2 h-2 rounded-full ${status.color}`}></div>
          <span className={`text-sm font-semibold ${status.color}`}>{status.text}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
        {/* Status Card */}
        <div className="bg-zinc-800/40 border border-pink-500/20 rounded-2xl p-4">
          <h3 className="text-pink-400 font-semibold text-sm mb-3">STATUS</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Delay</p>
              <p className={`text-lg font-bold ${status.color}`}>
                {getDelayMins() > 0 ? `+${getDelayMins()}m` : "On time"}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Hours Driven</p>
              <p className="text-lg font-bold text-white">{selectedTruck.hours_driven}h</p>
            </div>
          </div>
        </div>

        {/* Route & Location */}
        <div className="bg-zinc-800/40 border border-pink-500/20 rounded-2xl p-4">
          <h3 className="text-pink-400 font-semibold text-sm mb-3">ROUTE</h3>
          <div className="space-y-3">
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Assigned Route</p>
              <p className="text-white font-medium">{selectedTruck.assigned_route}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Location</p>
              <p className="text-white font-mono text-sm">
                {selectedTruck.lat.toFixed(4)}, {selectedTruck.lng.toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        {/* Cargo Info */}
        <div className="bg-zinc-800/40 border border-pink-500/20 rounded-2xl p-4">
          <h3 className="text-pink-400 font-semibold text-sm mb-3">CARGO</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-zinc-500 text-sm">Type</span>
              <span className="text-white font-medium capitalize">{selectedTruck.cargo_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 text-sm">Weight</span>
              <span className="text-white font-medium">{selectedTruck.weight_tons} tons</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 text-sm">Tier</span>
              <span className="text-white font-medium capitalize">{selectedTruck.tier}</span>
            </div>
          </div>
        </div>

        {/* Deadline */}
        <div className="bg-zinc-800/40 border border-pink-500/20 rounded-2xl p-4">
          <h3 className="text-pink-400 font-semibold text-sm mb-3">DEADLINE</h3>
          <p className="text-2xl font-bold text-white">{selectedTruck.deadline_hour}:00</p>
        </div>
      </div>
    </aside>
  )
}
