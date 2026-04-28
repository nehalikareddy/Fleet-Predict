import json
import os
import fastapi
import uvicorn
import numpy as np
import faiss
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import datetime
import math
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    print(f"[Gemini] Client initialized with gemini-2.0-flash")
else:
    gemini_client = None
    print("[WARN] GEMINI_API_KEY not set — dispatch generation will use fallback messages.")

# Initialize FastAPI app
app = fastapi.FastAPI()

# Add CORS middleware allowing all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# FAISS Index Setup
# -----------------------------------------------------------------------------

INCIDENT_TEXTS = [
    "I-94 heavy rain Friday 5pm caused 62 minute average delay across 3 incidents in past 6 months",
    "I-94 light rain added 18 minutes average delay during afternoon peak hours on weekdays",
    "Highway-50 overloaded with 18+ trucks caused 28 minute secondary cascade bottleneck",
    "I-43 eastern route handled 12 truck reroute during October storm with only 8 minute delay",
    "Storm conditions caused complete I-94 shutdown for 3 hours requiring full fleet redistribution",
    "Friday evening rush hour consistently reduces I-94 speed to 40% of normal between 5pm and 7pm",
    "Light rain on Highway-50 causes 12% speed reduction due to narrower lanes and less drainage"
]

# Build vocabulary
vocab = set()
for text in INCIDENT_TEXTS:
    for word in text.lower().split():
        vocab.add(word)
vocab_list = list(vocab)
vocab_size = len(vocab_list)

# Build binary vectors
vectors = []
for text in INCIDENT_TEXTS:
    words = text.lower().split()
    vector = [1.0 if word in words else 0.0 for word in vocab_list]
    vectors.append(vector)

# Convert to numpy array and build FAISS index
vectors_np = np.array(vectors, dtype=np.float32)
faiss_index = faiss.IndexFlatL2(vocab_size)
faiss_index.add(vectors_np)

def get_similar_incident(query_text: str) -> str:
    words = query_text.lower().split()
    query_vector = [1.0 if word in words else 0.0 for word in vocab_list]
    query_np = np.array([query_vector], dtype=np.float32)
    distances, indices = faiss_index.search(query_np, 1)
    nearest_index = indices[0][0]
    return INCIDENT_TEXTS[nearest_index]

# -----------------------------------------------------------------------------
# Lightweight Speed Model (replaces Prophet — same output contract)
# Uses historical traffic patterns with time-of-day seasonality
# -----------------------------------------------------------------------------

# Pre-computed speed profiles per route (hour -> base speed factor)
# Derived from the historical_traffic.json patterns
ROUTE_SPEED_PROFILES = {
    "I-94": {
        # Rush hours are slower, overnight is faster
        0: 0.92, 1: 0.94, 2: 0.95, 3: 0.95, 4: 0.93, 5: 0.88,
        6: 0.78, 7: 0.68, 8: 0.62, 9: 0.70, 10: 0.75, 11: 0.73,
        12: 0.70, 13: 0.72, 14: 0.68, 15: 0.60, 16: 0.52, 17: 0.48,
        18: 0.55, 19: 0.65, 20: 0.75, 21: 0.82, 22: 0.88, 23: 0.90
    },
    "Highway-50": {
        0: 0.95, 1: 0.96, 2: 0.96, 3: 0.96, 4: 0.95, 5: 0.92,
        6: 0.85, 7: 0.78, 8: 0.72, 9: 0.78, 10: 0.82, 11: 0.80,
        12: 0.78, 13: 0.80, 14: 0.76, 15: 0.70, 16: 0.65, 17: 0.60,
        18: 0.68, 19: 0.75, 20: 0.82, 21: 0.88, 22: 0.92, 23: 0.94
    },
    "I-43": {
        0: 0.94, 1: 0.95, 2: 0.96, 3: 0.96, 4: 0.94, 5: 0.90,
        6: 0.82, 7: 0.75, 8: 0.70, 9: 0.76, 10: 0.80, 11: 0.78,
        12: 0.76, 13: 0.78, 14: 0.74, 15: 0.68, 16: 0.62, 17: 0.56,
        18: 0.64, 19: 0.72, 20: 0.80, 21: 0.86, 22: 0.90, 23: 0.92
    }
}

# Day-of-week multiplier (Fri is worse)
DAY_MULTIPLIER = {
    0: 1.0,   # Mon
    1: 1.0,   # Tue
    2: 0.98,  # Wed
    3: 0.97,  # Thu
    4: 0.92,  # Fri — worst
    5: 0.96,  # Sat
    6: 0.98   # Sun
}

def predict_speed_factor(route: str, hour: int) -> float:
    """Predict speed factor using pre-computed profiles + day-of-week adjustment"""
    base = ROUTE_SPEED_PROFILES.get(route, ROUTE_SPEED_PROFILES["I-94"]).get(hour, 0.7)
    day = datetime.date.today().weekday()
    day_mult = DAY_MULTIPLIER.get(day, 1.0)
    # Add small random jitter for realism
    jitter = np.random.uniform(-0.03, 0.03)
    result = base * day_mult + jitter
    return max(0.2, min(1.0, round(float(result), 3)))

print("Speed model loaded (lightweight, no Prophet dependency)")

# -----------------------------------------------------------------------------
# Endpoints and Request Models
# -----------------------------------------------------------------------------

class PredictRequest(BaseModel):
    route: str
    time: str   # format "HH:MM"
    weather_condition: str  # "clear", "light_rain", "heavy_rain", "storm"
    scenario_id: str = None

WEATHER_IMPACT = {
    "clear": 1.0,
    "light_rain": 0.88,
    "heavy_rain": 0.65,
    "storm": 0.45
}

RECOMMENDED_CAPACITY_BY_SEVERITY = {
    "high":   {"I-94": 5, "Highway-50": 15, "I-43": 10},
    "medium": {"I-94": 10, "Highway-50": 12, "I-43": 8},
    "low":    {"I-94": 20, "Highway-50": 6, "I-43": 4}
}

import random

@app.post("/predict-disruption")
def predict_disruption(request: PredictRequest):
    if request.scenario_id == "detroit":
        fleet = []
        for i in range(12):
            fleet.append({
                "truck_id": f"Truck-DET-{10+i}",
                "driver": f"Driver {i}",
                "tier": "standard",
                "weight_tons": 22,
                "hours_driven": 5,
                "deadline_hour": 19,
                "status": "late" if i == 0 else "on_time",
                "delay_mins": 45 if i == 0 else 0,
                "assigned_route": "I-90-ALT-I-80" if i % 2 == 0 else "I-90",
                "reactive_route": "I-90",
                "reactive_status": "late",
                "reactive_delay_mins": 45,
                "scenario": "detroit",
                "telematicsFlag": "engine_fault" if i == 0 else "clear",
                "startLat": 42.33 + random.uniform(-0.04, 0.04),
                "startLng": -83.04 + random.uniform(-0.04, 0.04)
            })
        return {
            "disrupted": True,
            "severity": 8,
            "predicted_delay_mins": 45.0,
            "historical_context": "Engine Fault detected on I-75 near Detroit. Rerouting 12 trucks via local arterials to maintain supply chain SLA.",
            "predicted_speed_factor": 0.25,
            "confidence": 0.95,
            "affected_route": "I-90",
            "recommended_capacity": {"I-90": 2, "I-80": 15},
            "fleet": fleet
        }
        
    elif request.scenario_id == "indianapolis":
        fleet = []
        for i in range(8):
            fleet.append({
                "truck_id": f"Truck-IND-{20+i}",
                "driver": f"Driver {i}",
                "tier": "bulk" if i % 2 == 0 else "standard",
                "weight_tons": 40 if i % 2 == 0 else 15,
                "hours_driven": 4,
                "deadline_hour": 20,
                "status": "on_time",
                "delay_mins": 0,
                "assigned_route": "I-74-HEAVY-DETOUR" if i % 2 == 0 else "I-74-LIGHT-SHORTCUT",
                "reactive_route": "I-74-HEAVY-DETOUR",
                "reactive_status": "late" if i % 2 != 0 else "on_time",
                "reactive_delay_mins": 25 if i % 2 != 0 else 0,
                "scenario": "indianapolis",
                "telematicsFlag": "weight_restricted" if i % 2 == 0 else "weight_safe",
                "startLat": 39.76 + random.uniform(-0.05, 0.05),
                "startLng": -86.15 + random.uniform(-0.05, 0.05)
            })
        return {
            "disrupted": True,
            "severity": 6,
            "predicted_delay_mins": 25.0,
            "historical_context": "Weight Restriction enforced on I-70 bridge near Indianapolis. Fleet predictably distributed across I-74 and US-40.",
            "predicted_speed_factor": 0.60,
            "confidence": 0.88,
            "affected_route": "I-74",
            "recommended_capacity": {"I-74": 5, "I-74-LIGHT-SHORTCUT": 12},
            "fleet": fleet
        }

    # Default Chicago behavior
    hour = int(request.time.split(":")[0])
    base_speed = predict_speed_factor(request.route, hour)
    weather_mult = WEATHER_IMPACT.get(request.weather_condition, 1.0)
    combined_speed = round(base_speed * weather_mult, 3)
    base_travel_mins = 75
    actual_travel_mins = base_travel_mins / max(combined_speed, 0.2)
    delay_mins = round(actual_travel_mins - base_travel_mins, 1)
    severity = min(10, int(delay_mins / 6))
    disrupted = delay_mins > 15
    query = f"{request.route} {request.weather_condition} hour {hour}"
    historical_context = get_similar_incident(query)
    
    if severity >= 7: cap_tier = "high"
    elif severity >= 4: cap_tier = "medium"
    else: cap_tier = "low"
    
    return {
        "disrupted": disrupted,
        "severity": severity,
        "predicted_delay_mins": delay_mins,
        "historical_context": historical_context,
        "predicted_speed_factor": combined_speed,
        "confidence": round(min(0.97, 0.65 + (severity / 10) * 0.35), 2),
        "affected_route": request.route,
        "recommended_capacity": RECOMMENDED_CAPACITY_BY_SEVERITY[cap_tier]
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "FleetPredict AI Microservice",
        "port": 8001,
        "gemini_enabled": gemini_client is not None,
        "models_loaded": list(ROUTE_SPEED_PROFILES.keys()),
        "faiss_index_size": len(INCIDENT_TEXTS)
    }

# -----------------------------------------------------------------------------
# Gemini Dispatch Generation
# -----------------------------------------------------------------------------

class DispatchRequest(BaseModel):
    scenario: str   # e.g. "detroit"
    trucks: list    # list of truck dicts
    context: str    # human-readable situation summary

@app.post("/generate-dispatch")
async def generate_dispatch(req: DispatchRequest):
    """Ask Gemini to generate realistic fleet dispatcher messages."""

    FALLBACKS = {
        "chicago": [
            {"type": "system",   "text": "SCENARIO ACTIVE: CHICAGO — HoS constraints applied"},
            {"type": "warn",     "truckId": "Truck-Alpha", "driver": "John Doe",     "prefix": "HOS ALERT",   "text": "Hours of service limit in 30 mins. Diverting to DeKalb Truck Stop. ⚠️"},
            {"type": "dispatch", "truckId": "Truck-Beta",  "driver": "Sarah Connor", "prefix": "DISPATCH",    "text": "I-94 disrupted. Rerouting via US-41. ETA Milwaukee: 16:45. ✅"},
            {"type": "confirm",  "text": "ALL ASSETS REROUTED — cascade prevented. ✅"},
        ],
        "detroit": [
            {"type": "system",   "text": "SCENARIO ACTIVE: DETROIT — Engine fault upstream"},
            {"type": "fault",    "truckId": "Freightliner-09", "driver": "Marcus Webb",  "prefix": "GEOTAB ALERT", "text": "IMMOBILIZED at I-90 mile marker 94. Engine derate. Emergency services notified. 🔴"},
            {"type": "dispatch", "truckId": "Kenworth-14",     "driver": "Priya Anand",  "prefix": "DISPATCH",    "text": "Upstream fault detected. Rerouting via I-80 South. ETA Cleveland: 17:20. ✅"},
            {"type": "dispatch", "truckId": "Peterbilt-22",    "driver": "Luis Herrera", "prefix": "DISPATCH",    "text": "Speed reduced — incident upstream. Proceed via I-80 alternate. ETA: 17:35. ✅"},
            {"type": "confirm",  "text": "CASCADE PREVENTED — 11 trucks rerouted successfully. ✅"},
        ],
        "indianapolis": [
            {"type": "system",   "text": "SCENARIO ACTIVE: INDIANAPOLIS — Weight restrictions active"},
            {"type": "warn",     "truckId": "Heavy-Hauler-01", "driver": "Tom Briggs", "prefix": "WEIGHT ALERT", "text": "80,000 lbs gross. Rural shortcut BLOCKED. Routing via I-74. Extra 22 mins. ⚠️"},
            {"type": "dispatch", "truckId": "Empty-Return-02", "driver": "Dana Kim",   "prefix": "DISPATCH",    "text": "14,000 kg — within bridge limits. Shortcut approved. ETA Cincinnati: 15:50. ✅"},
            {"type": "confirm",  "text": "WEIGHT CONSTRAINTS APPLIED — fleet distributed safely. ✅"},
        ],
    }

    if not gemini_client:
        msgs = FALLBACKS.get(req.scenario, FALLBACKS["chicago"])
        return {"messages": msgs, "source": "fallback"}

    try:
        truck_summary = ", ".join([
            f"{t.get('truck_id','?')} ({t.get('status','?')}, {t.get('assigned_route','?')})"
            for t in req.trucks[:6]
        ])

        prompt = f"""You are a real-time fleet dispatcher AI for a logistics company.
Scenario: {req.context}
Trucks affected: {truck_summary}

Generate exactly 3 short, realistic dispatcher radio messages for this situation.
Each message should be a JSON object with these fields:
- type: one of "fault", "warn", "dispatch"
- truckId: truck identifier (e.g. Truck-DET-10)
- driver: plausible driver first and last name
- prefix: short tag like "GEOTAB ALERT", "WEIGHT ALERT", or "DISPATCH"
- text: the actual radio message (max 15 words, direct dispatcher style, include ETA or action)

Return ONLY a JSON array of 3 objects, no explanation."""

        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        raw = response.text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            raw = raw.rsplit("```", 1)[0]
        ai_messages = json.loads(raw)

        messages = [{"type": "system", "text": f"SCENARIO ACTIVE: {req.scenario.upper()} — Gemini AI dispatch generated"}]
        messages.extend(ai_messages)
        messages.append({"type": "confirm", "text": "ALL ASSETS REROUTED — FleetPredict cascade prevention active. ✅"})

        return {"messages": messages, "source": "gemini"}

    except Exception as e:
        print(f"[Gemini] Error: {e}")
        msgs = FALLBACKS.get(req.scenario, FALLBACKS["chicago"])
        return {"messages": msgs, "source": "fallback"}


# -----------------------------------------------------------------------------
# Startup Tests and Server Run
# -----------------------------------------------------------------------------

def run_startup_test():
    print("\n=== RUNNING STARTUP TESTS ===")
    
    # Test 1: Speed model works
    speed = predict_speed_factor("I-94", 17)
    assert 0.2 <= speed <= 1.0, f"FAIL: Speed factor out of range: {speed}"
    print(f"OK: Speed prediction: I-94 at 5pm speed factor = {speed}")
    
    # Test 2: FAISS index works
    result = get_similar_incident("I-94 heavy rain delay")
    assert len(result) > 10, "FAIL: FAISS returned empty result"
    print(f"OK: FAISS RAG working: '{result[:60]}...'")
    
    # Test 3: demo_fleet.json exists
    assert os.path.exists("demo_fleet.json"), "FAIL: demo_fleet.json not found"
    fleet = json.load(open("demo_fleet.json"))
    assert len(fleet) == 30, f"FAIL: Expected 30 trucks, got {len(fleet)}"
    print(f"OK: demo_fleet.json valid: {len(fleet)} trucks")
    
    print("=== ALL TESTS PASSED ===\n")

if __name__ == "__main__":
    run_startup_test()
    print("Starting FleetPredict AI Microservice on port 8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
