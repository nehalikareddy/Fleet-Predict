# FleetPredict: AI Assistant Project Context

> **Note to AI Assistants:** If you have been provided this file, you are assisting with the **FleetPredict** project. Read this document thoroughly to understand the monorepo architecture, data flow, component logic, and business rules before suggesting any code modifications.

---

## 1. Project Overview

**FleetPredict** is a B2B enterprise logistics platform designed to prevent "traffic cascades." When a major route disruption occurs (e.g., a severe crash on I-94), traditional routing apps send all traffic to the same alternate route, causing a secondary gridlock (a cascade). FleetPredict uses AI to distribute a logistics fleet across *multiple* alternate routes intelligently, based on complex vehicle constraints.

### The Stack (Decoupled Monorepo)
1. **Frontend:** React + Vite (`/frontend`, Port 5173)
2. **Backend Node:** Express + Firebase Admin (`/backend-node`, Port 3000)
3. **Backend AI:** Python FastAPI (`/backend-ai`, Port 8001)
4. **Database:** Firebase Realtime Database (`demo-state/` node)
5. **External APIs:** TomTom Traffic API (Live incidents), Google Maps API (UI rendering)

---

## 2. Core Data Flow & Architecture

The system operates via an asynchronous, event-driven loop centered around Firebase:

1. **Trigger:** A user clicks "Trigger Disruption" in the React Dashboard, sending a POST request to Node (`/trigger-simulation`).
2. **AI Prediction:** Node pings the Python AI microservice (`/predict-disruption`) with weather/time params. Python calculates a speed factor and returns delay predictions + recommended capacities.
3. **Live Traffic:** Node checks TomTom API for live incidents on the I-94 corridor and injects real-time context.
4. **Cascade Prevention (Node):** Node takes the static fleet JSON (`demo_fleet.json`), applies the AI's predicted capacities, and runs the Constraint Engine to assign each truck a new route.
5. **Firebase Write:** Node writes the final Fleet array, KPIs, and Disruption object to Firebase.
6. **Frontend Render:** React listens via `onValue()`. It receives the payload, plots trucks on the map, updates KPIs, and triggers a simulated "Dispatch Feed" to show outbound text messages to drivers.

---

## 3. Business Logic: The Cascade Prevention Engine

Located in `backend-node/server.js`, the `coordinateFleet()` function is the brain of the app. 

### Truck Tiers & Priorities
Trucks are processed in order of tier:
1. `premium` (Perishables/Pharmaceuticals) - High penalty cost ($250)
2. `standard` (Electronics/Retail) - Medium penalty cost ($150)
3. `bulk` (Raw materials/Construction) - Low penalty cost ($50)

### Constraint Validation (`checkConstraints()`)
A truck can only be assigned to a route if it passes all constraints:
1. **Hours of Service (HOS):** Current hours driven + predicted travel time must be $\le$ 11 hours.
2. **Weight Limits:** The route must support the truck's weight (e.g., Highway-50 limits trucks to 30 tons).
3. **Deadline:** The arrival time must be $\le$ the delivery deadline.
4. **Route Capacity:** The route must not exceed the AI's recommended safe vehicle capacity.

If a truck fails to find a valid route, it is assigned `status: "holding"`.

### "FleetPredict" vs "Reactive" Modes
The frontend allows toggling between two modes. The Node backend pre-calculates *both* outcomes for every truck:
- **FleetPredict Fields:** `assigned_route`, `status`, `delay_mins` (Intelligently distributed)
- **Reactive Fields:** `reactive_route`, `reactive_status`, `reactive_delay_mins` (Dumb routing where *all* trucks pile onto Highway-50, causing massive delays and penalties).

---

## 4. Frontend Component Structure (`/frontend`)

The React application uses an onboarding gate before showing the main dashboard.

- **`App.jsx`**: The root component. Connects to Firebase. If `isOnboarded` is false, it renders `OnboardingPage`. Otherwise, it renders the tabbed dashboard (Overview, Fleet, Routes).
- **`OnboardingPage.jsx`**: A full-screen simulation of a telematics integration (e.g., Samsara). Validates keys against the Node backend (`/onboard-fleet`) to load a different JSON dataset (`fleet_b.json`).
- **`MapView.jsx`**: Google Maps container. Renders fixed polylines for routes and loops through `fleetData` to render dynamic `Marker` components for trucks.
- **`DispatchFeed.jsx`**: A simulated terminal overlay that auto-scrolls outbound SMS messages to drivers when a disruption occurs.
- **`KPIPanel.jsx` & `DiagnosticPanel.jsx`**: Contextual sidebars. KPIs show total savings and on-time rates. Clicking a truck on the map opens the Diagnostic view for that specific asset.

---

## 5. Python AI Microservice (`/backend-ai`)

Located in `main.py`. This service replaced a legacy Prophet model with a lightweight, synchronous heuristic model to ensure broad environment compatibility.

- **Endpoint:** `POST /predict-disruption`
- **Logic:**
  1. Base speed is 65mph.
  2. Multipliers are applied for weather (`heavy_rain` = 0.6x speed).
  3. Time-of-day multipliers are applied (Rush hour = 0.5x speed).
  4. FAISS (Facebook AI Similarity Search) calculates L2 distance against a vectorized database of historical incidents to retrieve "historical context" strings (e.g., "Similar 2023 storm caused 60-minute gridlock").
- **Output:** Returns a JSON object containing `severity`, `predicted_delay_mins`, `recommended_capacity`, and `confidence`.

---

## 6. Critical Data Schemas

### Truck Object (Firebase `demo-state/fleet`)
```json
{
  "truck_id": "TRK-104",
  "tier": "premium",
  "weight_tons": 12,
  "hours_driven": 4,
  "deadline_hour": 18,
  
  // FleetPredict Result
  "assigned_route": "I-43",
  "status": "on_time", // "on_time" | "late" | "holding"
  "delay_mins": 0,
  
  // Reactive Result (for comparison)
  "reactive_route": "Highway-50",
  "reactive_status": "late",
  "reactive_delay_mins": 45
}
```

### Disruption Object (Firebase `demo-state/disruption`)
```json
{
  "active": true,
  "severity": 8,
  "affected_route": "I-94",
  "weather_condition": "heavy_rain",
  "historical_context": "TomTom Live: Detected 4 major incidents. Similar historical storms caused 60min delays.",
  "recommended_capacity": {
    "I-94": 5,
    "Highway-50": 15,
    "I-43": 10
  }
}
```

## 7. Development Guidelines for AI

1. **Do not break the Firebase contract:** The React frontend expects `data.fleet` to be exactly `null` upon reset, and an Array of truck objects upon success. 
2. **Aesthetic Consistency:** The frontend uses a highly polished "Dark Mode / Premium Dashboard" aesthetic. Use inline styles carefully with `#111111` blacks, `#16a34a` greens, and `#f5f5f5` grays. Do not introduce raw Tailwind utility classes without checking `tailwind.config.js` or standard CSS.
3. **No Database Migrations:** The Firebase structure is completely volatile under the `demo-state` node. There is no user authentication. It is a live demonstration singleton.
