# FleetPredict — Live Fleet Intelligence 🚛

FleetPredict is an enterprise-grade logistics and fleet intelligence platform built to predict route disruptions and intelligently redistribute truck fleets to prevent traffic cascade effects.

This repository is structured as a **Microservice Monorepo** containing three decoupled services that run in tandem.

---

## 🏗️ Architecture & Folder Structure

```text
📁 soln/ (Root)
│
├── 📁 frontend/           # React + Vite Dashboard (Port 5173)
├── 📁 backend-node/       # Node.js + Express Orchestrator (Port 3000)
└── 📁 backend-ai/         # Python FastAPI Microservice (Port 8001)
```

### 1. Frontend (`/frontend`)
The user interface for dispatchers and fleet managers, built with React, Vite, and TailwindCSS principles (vanilla CSS + utility inline styling).
- **Onboarding Flow:** Full-screen landing page simulating telematics API integration (e.g., Samsara, Motive).
- **Live Map:** Integrates Google Maps API to visualize routes (I-94, Hwy-50, I-43) and live truck positions.
- **Dispatch Feed:** Auto-scrolling terminal simulation of outbound AI rerouting instructions sent to drivers.
- **Real-time Sync:** Uses Firebase Realtime Database (`onValue`) to instantly reflect backend routing decisions.

### 2. Node Orchestrator (`/backend-node`)
The central API gateway and state manager.
- **Cascade Prevention Engine:** Implements the core constraint-validation logic (Hours of Service, Vehicle Weight Limits, Time Windows) to distribute trucks across valid routes.
- **TomTom Live API:** Queries real-time incident data on the I-94 Chicago-Milwaukee corridor.
- **Firebase Writer:** Pushes structured fleet data, KPIs, and disruption events to Firebase for the frontend.
- **Simulation Adapter:** Exposes endpoints like `/trigger-simulation` and `/onboard-fleet` to generate dynamic demo scenarios (e.g., loading a FedEx fleet).

### 3. AI Microservice (`/backend-ai`)
A lightweight Python inference service for traffic delay predictions.
- **Speed Factor Model:** Calculates expected delays based on a baseline route time and dynamic modifiers (weather conditions, time-of-day, day-of-week).
- **FAISS RAG System:** Uses Facebook AI Similarity Search (FAISS) to retrieve historical traffic incidents and provide plain-english context for current disruptions.

---

## 🚀 Getting Started

To run the full FleetPredict platform locally, you need to start all three services in separate terminal windows.

### Prerequisites
- Node.js (v18+)
- Python (3.14+)
- Firebase Admin SDK credentials (`.env` in `backend-node`)
- TomTom API Key (`.env` in `backend-node`)
- Google Maps API Key (`.env` in `frontend`)

### Step 1: Start the AI Microservice
```bash
cd backend-ai
pip install -r requirements.txt
python main.py
```
*Runs on http://localhost:8001*

### Step 2: Start the Node Backend
```bash
cd backend-node
npm install
node server.js
```
*Runs on http://localhost:3000*

### Step 3: Start the React Frontend
```bash
cd frontend
npm install
npm run dev
```
*Runs on http://localhost:5173*

---

## 🎮 Demo & Pitch Flow

1. **Onboarding Simulation:** When opening the dashboard, use the valid demo key `samsara_fedex_fleet_xyz789` to simulate connecting a live telematics provider.
2. **Dashboard Navigation:** Explore the **Overview** (Architecture), **Fleet** (Live Map), and **Routes** (Route specific data).
3. **Trigger Disruption:** In the Fleet tab, click "Trigger Heavy Rain Disruption".
4. **Observe AI Routing:** Watch the map update instantly as the Node engine prevents a cascade bottleneck by distributing trucks across alternate routes.
5. **View Dispatch Feed:** The bottom-right terminal will simulate outbound text communications to the drivers' navigation systems.
6. **Compare:** Toggle between "FleetPredict" (Distributed) and "Reactive" (Single route) modes to see the KPI penalty differences.

---

*Status: Production-Ready Demo / Pitch Environment Finalized (April 2026)*
