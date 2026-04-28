import json
import random
from datetime import datetime, timedelta

random.seed(42)

# ─────────────────────────────────────────────
# PART 1 — Generate historical_traffic.json
# ─────────────────────────────────────────────

records = []
routes = ["I-94", "Highway-50", "I-43"]
weather_conditions = ["clear", "clear", "clear", "light_rain", "heavy_rain"]

BASE_FACTORS = {
    "I-94": {
        0: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 0.95, 5: 0.90,
        6: 0.80, 7: 0.70, 8: 0.65, 9: 0.75, 10: 0.85, 11: 0.88,
        12: 0.85, 13: 0.82, 14: 0.78, 15: 0.70, 16: 0.55,
        17: 0.40, 18: 0.50, 19: 0.65, 20: 0.80, 21: 0.90,
        22: 0.95, 23: 1.0
    },
    "Highway-50": {
        0: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 0.98, 5: 0.95,
        6: 0.92, 7: 0.88, 8: 0.85, 9: 0.88, 10: 0.90, 11: 0.92,
        12: 0.90, 13: 0.88, 14: 0.87, 15: 0.86, 16: 0.84,
        17: 0.82, 18: 0.85, 19: 0.88, 20: 0.92, 21: 0.95,
        22: 0.97, 23: 1.0
    },
    "I-43": {
        0: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 0.97, 5: 0.93,
        6: 0.88, 7: 0.82, 8: 0.78, 9: 0.82, 10: 0.87, 11: 0.90,
        12: 0.88, 13: 0.85, 14: 0.83, 15: 0.80, 16: 0.74,
        17: 0.68, 18: 0.74, 19: 0.80, 20: 0.87, 21: 0.92,
        22: 0.96, 23: 1.0
    }
}

WEATHER_MULT = {"clear": 1.0, "light_rain": 0.88, "heavy_rain": 0.65, "storm": 0.45}

start_date = datetime(2024, 10, 1)

for day in range(180):
    current_date = start_date + timedelta(days=day)
    day_of_week = current_date.weekday()

    for hour in range(24):
        for route in routes:
            weather = random.choice(weather_conditions)
            base = BASE_FACTORS[route][hour]

            # Friday rush hour amplifier
            if day_of_week == 4 and 16 <= hour <= 18:
                base *= 0.85

            speed_factor = base * WEATHER_MULT[weather]
            noise = random.uniform(-0.03, 0.03)
            speed_factor = max(0.2, min(1.0, speed_factor + noise))

            records.append({
                "ds": current_date.strftime(f"%Y-%m-%d {hour:02d}:00:00"),
                "y": round(speed_factor, 3),
                "route": route,
                "hour": hour,
                "day_of_week": day_of_week,
                "weather": weather
            })

with open("historical_traffic.json", "w") as f:
    json.dump(records, f, indent=2)
print(f"Generated {len(records)} historical traffic records")


# ─────────────────────────────────────────────
# PART 2 — Generate demo_fleet.json
# ─────────────────────────────────────────────

random.seed(42)

CHI_LAT_RANGE = (41.850, 41.900)
CHI_LNG_RANGE = (-87.660, -87.600)

trucks = []

# 5 premium trucks
for i in range(1, 6):
    trucks.append({
        "truck_id": f"TRK-{i:03d}",
        "tier": "premium",
        "cargo_type": "perishable",
        "lat": round(random.uniform(*CHI_LAT_RANGE), 6),
        "lng": round(random.uniform(*CHI_LNG_RANGE), 6),
        "destination": "Milwaukee",
        "deadline_hour": 18,
        "hours_driven": random.randint(1, 4),
        "weight_tons": random.randint(8, 15)
    })

# 20 standard trucks
for i in range(6, 26):
    trucks.append({
        "truck_id": f"TRK-{i:03d}",
        "tier": "standard",
        "cargo_type": "standard",
        "lat": round(random.uniform(*CHI_LAT_RANGE), 6),
        "lng": round(random.uniform(*CHI_LNG_RANGE), 6),
        "destination": "Milwaukee",
        "deadline_hour": 20,
        "hours_driven": random.randint(2, 7),
        "weight_tons": random.randint(10, 25)
    })

# 5 bulk trucks
for i in range(26, 31):
    trucks.append({
        "truck_id": f"TRK-{i:03d}",
        "tier": "bulk",
        "cargo_type": "bulk",
        "lat": round(random.uniform(*CHI_LAT_RANGE), 6),
        "lng": round(random.uniform(*CHI_LNG_RANGE), 6),
        "destination": "Milwaukee",
        "deadline_hour": 22,
        "hours_driven": random.randint(3, 8),
        "weight_tons": random.randint(15, 30)
    })

with open("demo_fleet.json", "w") as f:
    json.dump(trucks, f, indent=2)
print(f"Generated {len(trucks)} trucks")
print("Share demo_fleet.json with Person A NOW")
