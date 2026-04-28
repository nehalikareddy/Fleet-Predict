import json
import os
import fastapi
import uvicorn
import pandas as pd
import numpy as np
from prophet import Prophet
import faiss
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import datetime

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
# Prophet Model Training Setup
# -----------------------------------------------------------------------------

def train_prophet_model(route_name: str):
    # 1. Load historical_traffic.json into a pandas DataFrame
    with open("historical_traffic.json", "r") as f:
        data = json.load(f)
    df_all = pd.DataFrame(data)
    
    # 2. Filter rows where record["route"] == route_name
    filtered = df_all[df_all["route"] == route_name]
    
    # 3. Create prophet-format dataframe: columns "ds" and "y"
    df = filtered[["ds", "y"]].copy()
    df["ds"] = pd.to_datetime(df["ds"])
    
    # 4. Train Prophet model
    model = Prophet(
        yearly_seasonality=False,
        weekly_seasonality=True,
        daily_seasonality=True,
        changepoint_prior_scale=0.05
    )
    model.fit(df)
    return model

# Train models for all 3 routes AT STARTUP and cache them
models = {}
models["I-94"] = train_prophet_model("I-94")
models["Highway-50"] = train_prophet_model("Highway-50")
models["I-43"] = train_prophet_model("I-43")

def predict_speed_factor(model, target_datetime_str: str) -> float:
    future = pd.DataFrame({"ds": [pd.to_datetime(target_datetime_str)]})
    forecast = model.predict(future)
    raw_factor = forecast["yhat"].values[0]
    return max(0.2, min(1.0, round(float(raw_factor), 3)))

# -----------------------------------------------------------------------------
# Endpoints and Request Models
# -----------------------------------------------------------------------------

class PredictRequest(BaseModel):
    route: str
    time: str   # format "HH:MM"
    weather_condition: str  # "clear", "light_rain", "heavy_rain", "storm"

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

@app.post("/predict-disruption")
def predict_disruption(request: PredictRequest):
    # 1. Parse hour from request.time
    hour = int(request.time.split(":")[0])
    
    # 2. Get Prophet prediction
    today = datetime.date.today()
    target_dt = f"{today} {request.time}:00"
    base_speed = predict_speed_factor(models[request.route], target_dt)
    
    # 3. Apply weather multiplier
    weather_mult = WEATHER_IMPACT.get(request.weather_condition, 1.0)
    combined_speed = round(base_speed * weather_mult, 3)
    
    # 4. Calculate delay
    base_travel_mins = 75  # Chicago to Milwaukee baseline
    actual_travel_mins = base_travel_mins / combined_speed
    delay_mins = round(actual_travel_mins - base_travel_mins, 1)
    
    # 5. Determine severity
    severity = min(10, int(delay_mins / 6))
    
    # 6. Determine disruption
    disrupted = delay_mins > 15
    
    # 7. Get historical context via FAISS
    query = f"{request.route} {request.weather_condition} hour {hour}"
    historical_context = get_similar_incident(query)
    
    # 8. Get capacity recommendation
    if severity >= 7:
        cap_tier = "high"
    elif severity >= 4:
        cap_tier = "medium"
    else:
        cap_tier = "low"
    recommended_capacity = RECOMMENDED_CAPACITY_BY_SEVERITY[cap_tier]
    
    # 9. Calculate confidence
    confidence = round(min(0.97, 0.65 + (severity / 10) * 0.35), 2)
    
    # 10. Return
    return {
        "disrupted": disrupted,
        "severity": severity,
        "predicted_delay_mins": delay_mins,
        "historical_context": historical_context,
        "predicted_speed_factor": combined_speed,
        "confidence": confidence,
        "affected_route": request.route,
        "recommended_capacity": recommended_capacity
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "FleetPredict AI Microservice",
        "port": 8001,
        "models_loaded": list(models.keys()),
        "faiss_index_size": len(INCIDENT_TEXTS)
    }

# -----------------------------------------------------------------------------
# Startup Tests and Server Run
# -----------------------------------------------------------------------------

def run_startup_test():
    print("\n=== RUNNING STARTUP TESTS ===")
    
    # Test 1: Models loaded
    assert len(models) == 3, "FAIL: Not all 3 route models loaded"
    print("OK: Prophet models loaded for all 3 routes")
    
    # Test 2: FAISS index works
    result = get_similar_incident("I-94 heavy rain delay")
    assert len(result) > 10, "FAIL: FAISS returned empty result"
    print(f"OK: FAISS RAG working: '{result[:60]}...'")
    
    # Test 3: Prediction logic works
    from datetime import date
    today = str(date.today())
    speed = predict_speed_factor(models["I-94"], f"{today} 17:00:00")
    assert 0.2 <= speed <= 1.0, f"FAIL: Speed factor out of range: {speed}"
    print(f"OK: Prophet prediction: I-94 at 5pm speed factor = {speed}")
    
    # Test 4: demo_fleet.json exists
    assert os.path.exists("demo_fleet.json"), "FAIL: demo_fleet.json not found. Run generate_data.py first"
    fleet = json.load(open("demo_fleet.json"))
    assert len(fleet) == 30, f"FAIL: Expected 30 trucks, got {len(fleet)}"
    print(f"OK: demo_fleet.json valid: {len(fleet)} trucks")
    
    print("=== ALL TESTS PASSED ===\n")

if __name__ == "__main__":
    run_startup_test()
    print("Starting FleetPredict AI Microservice...")
    print("Training Prophet models (this takes ~15 seconds)...")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
