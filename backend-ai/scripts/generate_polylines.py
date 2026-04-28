import requests
import json

# ─────────────────────────────────────────────────────────────────────────────
# generate_polylines.py
#
# Fetches high-resolution, road-snapped geometry from the OSRM routing API
# and writes it to frontend/src/utils/routePolylines.js.
#
# Run from backend-ai/scripts/:
#   python generate_polylines.py
# ─────────────────────────────────────────────────────────────────────────────

# Waypoints [longitude, latitude] that force each route to the correct highway.
routes = {
    # Scenario 1: Chicago → Milwaukee
    "I-94": [
        [-87.6298, 41.8781],  # Chicago
        [-87.9065, 43.0389],  # Milwaukee
    ],
    "I-94-ALT-US41": [
        [-87.6298, 41.8781],
        [-87.8000, 42.1200],  # US-41 waypoints
        [-87.9065, 43.0389],
    ],

    # Scenario 2: Detroit → Cleveland
    "I-90": [
        [-83.0458, 42.3314],  # Detroit
        [-83.5500, 41.6600],  # Toledo
        [-82.1000, 41.3600],  # Elyria
        [-81.6944, 41.4993],  # Cleveland
    ],
    "I-90-ALT-I-80": [
        [-83.0458, 42.3314],  # Detroit
        [-83.5500, 41.6600],  # Toledo
        [-83.1100, 41.3500],  # Fremont
        [-81.8600, 41.1400],  # Medina
        [-81.6944, 41.4993],  # Cleveland
    ],

    # Scenario 3: Indianapolis → Cincinnati
    "I-74": [
        [-86.1581, 39.7684],  # Indy
        [-85.2222, 39.2975],  # Batesville
        [-84.5120, 39.1031],  # Cincy
    ],
    "I-74-HEAVY-DETOUR": [
        [-86.1581, 39.7684],  # Indy
        [-84.8902, 39.8289],  # Richmond (I-70)
        [-84.5120, 39.1031],  # Cincy (US-127 south)
    ],
    "I-74-LIGHT-SHORTCUT": [
        [-86.1581, 39.7684],  # Indy
        [-85.4464, 39.6092],  # Rushville (US-52)
        [-84.5120, 39.1031],  # Cincy
    ],

    # Base fleet (Chicago corridor)
    "Highway-50": [
        [-87.6298, 41.8781],
        [-88.0298, 41.9742],
        [-88.0762, 42.4959],
        [-87.9065, 43.0389],
    ],
    "I-43": [
        [-87.6298, 41.8781],
        [-87.6901, 42.0651],
        [-87.8114, 42.4959],
        [-87.9065, 43.0389],
    ],
}

js_content = "export const ROUTE_POLYLINES = {\n"

for name, coords in routes.items():
    print(f"Fetching {name}...")
    coord_str = ";".join([f"{lon},{lat}" for lon, lat in coords])
    url = (
        f"http://router.project-osrm.org/route/v1/driving/{coord_str}"
        "?geometries=geojson&overview=full"
    )
    res = requests.get(url, timeout=15).json()

    if res["code"] == "Ok":
        geom = res["routes"][0]["geometry"]["coordinates"]

        # Thin out very dense geometries to reduce file size
        step = 1
        if len(geom) > 500:
            step = 3
        if len(geom) > 1000:
            step = 5
        if len(geom) > 2000:
            step = 10

        thinned = geom[::step]
        last = res["routes"][0]["geometry"]["coordinates"][-1]
        if thinned[-1] != last:
            thinned.append(last)

        js_content += f'  "{name}": [\n'
        for lon, lat in thinned:
            js_content += f"    {{ lat: {lat:.5f}, lng: {lon:.5f} }},\n"
        js_content += "  ],\n"
    else:
        print(f"  ERROR for {name}: {res}")

js_content += "};\n\n"
js_content += """\
// Auto-camera config per scenario
export const SCENARIO_MAP_CONFIG = {
  chicago: { center: { lat: 42.4500, lng: -87.7800 }, zoom: 9 },
  detroit: { center: { lat: 41.8500, lng: -82.6000 }, zoom: 8 },
  indianapolis: { center: { lat: 39.4500, lng: -85.2000 }, zoom: 9 }
};

export function getPolylineForTruck(truck, mode) {
  if (!truck) return null;
  const routeName = mode === 'reactive'
    ? (truck.reactive_route || truck.assigned_route)
    : truck.assigned_route;
  return ROUTE_POLYLINES[routeName] || ROUTE_POLYLINES['I-94'];
}
"""

output_path = "../../frontend/src/utils/routePolylines.js"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Done! Written to {output_path}")
