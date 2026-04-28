# FleetPredict — Live Fleet Intelligence 🚛

FleetPredict is an enterprise-grade logistics intelligence platform that predicts route disruptions and intelligently redistributes truck fleets to prevent traffic cascade effects — powered by **Google Gemini AI**.

This repository is a **Microservice Monorepo** containing three decoupled services that run in tandem.

---

## 🏗️ Architecture & Folder Structure

```text
📁 soln/ (Root)
│
├── 📁 frontend/                    # React + Vite Dashboard (Port 5173)
├── 📁 backend-node/                # Node.js + Express Orchestrator (Port 3000)
└── 📁 backend-ai/                  # Python FastAPI AI Microservice (Port 8001)
    └── 📁 scripts/
        └── generate_polylines.py   # OSRM road-geometry fetcher (run once)
```

---

## 📦 Services

### 1. Frontend (`/frontend`)
Dispatcher-facing React dashboard built with Vite, Google Maps JS API, and Firebase Realtime Database.

- **Onboarding Flow:** Fleet API connection simulation with a one-click demo key.
- **Scenario Selection:** 3 pre-built disruption scenarios before entering the dashboard.
- **Live Map:** Google Maps integration visualising truck positions animated along real OSRM highway geometry.
- **Mode Toggle:** Instantly compare **FleetPredict** (multi-route AI distribution) vs **Reactive** (single red congested route).
- **Gemini Dispatch Feed:** AI-generated real-time dispatcher radio messages, powered by **Gemini 2.0 Flash**.
- **Routes View:** Scenario-aware route corridor map with distance, time, and capacity cards.
- **Firebase Sync:** `onValue()` listener keeps all state in sync with the backend in real time.

### 2. Node Orchestrator (`/backend-node`)
Central API gateway and state manager.

- **Cascade Prevention Engine:** Constraint-validation logic (Hours of Service, Vehicle Weight, Time Windows) distributes trucks across valid routes.
- **TomTom Live API:** Queries real-time incident data on active corridors.
- **Firebase Writer:** Pushes structured fleet data, KPIs, and disruption events.
- **Simulation Adapter:** `/trigger-simulation`, `/onboard-fleet`, and `/reset` endpoints.

### 3. AI Microservice (`/backend-ai`)
Python FastAPI inference service.

- **Gemini 2.0 Flash:** Generates contextual, per-scenario dispatcher messages in real time.
- **Speed Factor Model:** Predicts delays from weather conditions, time-of-day, and day-of-week.
- **FAISS RAG System:** Retrieves historical traffic incidents for plain-english disruption context.
- **Scenario Engine:** Returns fleet data with `assigned_route` (FleetPredict) and `reactive_route` (Reactive) fields for all 3 scenarios.

---

## 🚀 Getting Started

Start all three services in separate terminal windows.

### Prerequisites
| Requirement | Where |
|---|---|
| Node.js v18+ | — |
| Python 3.10+ | — |
| Firebase Admin credentials | `backend-node/.env` |
| TomTom API Key | `backend-node/.env` |
| Google Maps API Key | `frontend/.env` |
| **Google Gemini API Key** | `backend-ai/.env` |

Get a free Gemini key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### Step 1 — AI Microservice
```bash
cd backend-ai
pip install -r requirements.txt
python main.py
```
Runs on `http://localhost:8001`

### Step 2 — Node Backend
```bash
cd backend-node
npm install
node server.js
```
Runs on `http://localhost:3000`

### Step 3 — React Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`

---

## 🗺️ Regenerating Route Geometry

If you need to refresh the OSRM highway polylines:

```bash
cd backend-ai/scripts
python generate_polylines.py
```

This fetches real road geometry from the public OSRM API and writes it to `frontend/src/utils/routePolylines.js`.

---

## 🎮 Demo Flow (Dispatcher Walkthrough)

1. **Connect Fleet** — Enter the demo key `fleet_demo_key_xyz789` (or click it to autofill) → Connect Fleet.
2. **Select Scenario** — Choose one of 3 disruption scenarios:
   - 🕐 **HoS Compliance** — Chicago → Milwaukee (I-94)
   - 🔴 **Engine Fault** — Detroit → Cleveland (I-90)
   - ⚖️ **Weight Restriction** — Indianapolis → Cincinnati (I-74)
3. **Launch Dashboard** — Map pans to the active city. Trucks animate along real highway roads.
4. **Gemini Dispatch Feed** — Watch real-time AI-generated dispatcher messages appear in the terminal (bottom right), labelled `GEMINI AI`.
5. **Toggle Mode** — Switch between **FleetPredict** and **Reactive**:
   - FleetPredict: trucks distributed across multiple coloured routes.
   - Reactive: all routes disappear except one thick **red** congested line.
6. **Routes Tab** — See the active corridor map with per-route stats (distance, time, safe capacity).
7. **Reset** — Click "End Demo & Reset" in the sidebar to return to onboarding.

---

## 🔑 Environment Variables

### `backend-node/.env`
```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."
FIREBASE_DATABASE_URL=...
TOMTOM_API_KEY=...
PORT=3000
```

### `backend-ai/.env`
```
GEMINI_API_KEY=your_key_here
```

### `frontend/.env`
```
VITE_GOOGLE_MAPS_KEY=your_key_here
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_DATABASE_URL=...
```

---

*Status: Hackathon Demo Ready — Google Gemini integrated — April 2026*
