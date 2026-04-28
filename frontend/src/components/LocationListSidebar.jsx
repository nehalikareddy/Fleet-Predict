export default function LocationListSidebar({ fleetData, selectedTruck, onTruckSelect, mode }) {
  const getTruckStatus = (truck) => {
    if (mode === "reactive") {
      return truck.reactive_status === "on_time" ? "On Time" : "Late"
    }
    return truck.status === "on_time" ? "On Time" : truck.status === "late" ? "Late" : "Holding"
  }

  const getTruckStatusColor = (truck) => {
    if (mode === "reactive") {
      return truck.reactive_status === "on_time" ? "text-pink-400" : "text-red-400"
    }
    if (truck.status === "on_time") return "text-pink-400"
    if (truck.status === "late") return "text-red-400"
    return "text-yellow-400"
  }

  const getDelayInfo = (truck) => {
    if (mode === "reactive") {
      return truck.reactive_delay_mins > 0 ? `+${truck.reactive_delay_mins}m` : "On time"
    }
    return truck.delay_mins > 0 ? `+${truck.delay_mins}m` : "On time"
  }

  return (
    <aside className="w-72 bg-zinc-900/80 border-r border-pink-500/30 h-full flex flex-col overflow-hidden backdrop-blur rounded-3xl">
      {/* Header */}
      <div className="p-4 border-b border-pink-500/20 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Search trucks..."
            className="w-full bg-zinc-800/60 border border-pink-500/30 rounded-2xl px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/30"
          />
          <svg className="absolute right-3 top-2.5 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Trucks List */}
      <div className="flex-1 overflow-y-auto">
        {fleetData.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-sm">No trucks available</div>
        ) : (
          <div className="space-y-2 p-3">
            {fleetData.map((truck) => (
              <button
                key={truck.truck_id}
                onClick={() => onTruckSelect(truck)}
                className={`w-full p-3 rounded-2xl text-left transition-all ${
                  selectedTruck?.truck_id === truck.truck_id
                    ? "bg-pink-500/20 border border-pink-400 shadow-lg shadow-pink-500/20"
                    : "bg-zinc-800/40 border border-zinc-700/50 hover:border-pink-500/50 hover:bg-zinc-800/60"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-white text-sm">{truck.truck_id}</div>
                  <span className={`text-xs font-bold ${getTruckStatusColor(truck)}`}>
                    {getTruckStatus(truck)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div>
                    <p className="text-zinc-500">Route</p>
                    <p className="text-zinc-300">{truck.assigned_route}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Delay</p>
                    <p className={getTruckStatusColor(truck)}>{getDelayInfo(truck)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
