const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Firebase Admin Setup ─────────────────────────────────────────────────────
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
} catch (err) {
  console.warn('⚠️  Firebase could not be initialized. Please check your .env file credentials.');
}

const db = admin.database();

async function writeToFirebase(dbPath, data) {
  await db.ref(dbPath).set(data);
}

async function patchFirebase(dbPath, data) {
  await db.ref(dbPath).update(data);
}

// ─── Route Constants & Penalty Config ────────────────────────────────────────
const ROUTES = {
  "I-94": {
    base_time_mins: 75,
    safe_capacity: 15,
    overload_multiplier: 2.0
  },
  "Highway-50": {
    base_time_mins: 95,
    safe_capacity: 12,
    overload_multiplier: 1.8
  },
  "I-43": {
    base_time_mins: 88,
    safe_capacity: 10,
    overload_multiplier: 1.6
  }
};

const PENALTY_BY_TIER = {
  "premium": 250,
  "standard": 150,
  "bulk": 50
};

const TIER_PRIORITY = {
  "premium": 1,
  "standard": 2,
  "bulk": 3
};

const DEPARTURE_HOUR = 15;           // 3:00 PM
const DEPARTURE_MINS = DEPARTURE_HOUR * 60; // 900 minutes from midnight

// ─── Constraint Validator ─────────────────────────────────────────────────────
function checkConstraints(truck, routeName, travelMins) {
  // 1. HoS check
  const totalHours = (truck.hours_driven * 60 + travelMins) / 60;
  const hosValid = totalHours <= 11;

  // 2. Time window check
  const arrivalMins = DEPARTURE_MINS + travelMins;
  const deadlineMins = truck.deadline_hour * 60;
  const onTime = arrivalMins <= deadlineMins;
  const delayMins = Math.max(0, arrivalMins - deadlineMins);

  // 3. Weight check
  const ROUTE_WEIGHT_LIMITS = { "I-94": 40, "Highway-50": 30, "I-43": 35 };
  const weightValid = truck.weight_tons <= ROUTE_WEIGHT_LIMITS[routeName];

  return {
    hosValid,
    onTime,
    delayMins,
    weightValid,
    allValid: hosValid && weightValid
  };
}

// ─── Cascade Prevention Algorithm ────────────────────────────────────────────
function coordinateFleet(trucks, disruption) {
  // Step 1: Get capacity limits
  const recommended_capacity = disruption.disrupted
    ? disruption.recommended_capacity
    : { "I-94": 20, "Highway-50": 6, "I-43": 4 };

  // Step 2: Sort by tier priority
  trucks.sort((a, b) => TIER_PRIORITY[a.tier] - TIER_PRIORITY[b.tier]);

  // Step 3: Track route load
  const routeLoad = { "I-94": 0, "Highway-50": 0, "I-43": 0 };

  return trucks.map(truck => {
    // Step 4a: Build preferred route order by tier
    let preferredRoutes = [];
    if (truck.tier === "premium")  preferredRoutes = ["I-43", "Highway-50", "I-94"];
    else if (truck.tier === "standard") preferredRoutes = ["Highway-50", "I-43", "I-94"];
    else if (truck.tier === "bulk")     preferredRoutes = ["I-94", "Highway-50", "I-43"];

    // Step 4b: Find best valid route
    let assigned_route = null;
    for (const route of preferredRoutes) {
      if (routeLoad[route] < recommended_capacity[route]) {
        const constraints = checkConstraints(truck, route, ROUTES[route].base_time_mins);
        if (constraints.allValid) {
          assigned_route = route;
          routeLoad[route]++;
          break;
        }
      }
    }

    // Step 5: FleetPredict fields
    let status, delay_mins, hos_valid;
    if (assigned_route !== null) {
      const c = checkConstraints(truck, assigned_route, ROUTES[assigned_route].base_time_mins);
      status    = c.onTime ? "on_time" : "late";
      delay_mins = c.delayMins;
      hos_valid  = c.hosValid;
    } else {
      // Step 4c: Holding
      status     = "holding";
      delay_mins = 30;
      hos_valid  = true;
    }

    // Step 6: Reactive fields — all trucks go to Highway-50, overload if over capacity
    let reactiveTravel = ROUTES["Highway-50"].base_time_mins;
    if (trucks.length > ROUTES["Highway-50"].safe_capacity) {
      reactiveTravel *= ROUTES["Highway-50"].overload_multiplier;
    }
    const rc = checkConstraints(truck, "Highway-50", reactiveTravel);

    // Step 7: Return enriched truck object
    return {
      ...truck,
      assigned_route,
      status,
      delay_mins,
      hos_valid,
      reactive_route: "Highway-50",
      reactive_status: rc.onTime ? "on_time" : "late",
      reactive_delay_mins: rc.delayMins
    };
  });
}

// ─── KPI Calculator ───────────────────────────────────────────────────────────
function calculateKPIs(enrichedTrucks) {
  // FleetPredict KPIs
  const onTimeCount = enrichedTrucks.filter(t => t.status === "on_time" || t.status === "holding").length;
  const lateCount   = enrichedTrucks.filter(t => t.status === "late").length;
  const penaltyCost = enrichedTrucks
    .filter(t => t.status === "late")
    .reduce((sum, t) => sum + PENALTY_BY_TIER[t.tier], 0);
  const onTimeRate  = Math.round((onTimeCount / enrichedTrucks.length) * 100);

  // Reactive KPIs
  const reactiveOnTime  = enrichedTrucks.filter(t => t.reactive_status === "on_time").length;
  const reactiveLate    = enrichedTrucks.filter(t => t.reactive_status === "late").length;
  const reactivePenalty = enrichedTrucks
    .filter(t => t.reactive_status === "late")
    .reduce((sum, t) => sum + PENALTY_BY_TIER[t.tier], 0);
  const reactiveOnTimeRate = Math.round((reactiveOnTime / enrichedTrucks.length) * 100);

  return {
    fleetpredict: {
      on_time_count: onTimeCount,
      late_count: lateCount,
      total_penalty_cost: penaltyCost,
      cascade_prevented: true,
      on_time_rate: onTimeRate
    },
    reactive: {
      on_time_count: reactiveOnTime,
      late_count: reactiveLate,
      total_penalty_cost: reactivePenalty,
      cascade_prevented: false,
      on_time_rate: reactiveOnTimeRate
    }
  };
}

// ─── POST /trigger-simulation (Adapter Pattern) ───────────────────────────────
app.post('/trigger-simulation', async (req, res) => {
  const source = req.body.source || 'historical';

  try {
    await writeToFirebase('demo-state/simulation_running', true);

    const trucks = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'demo_fleet.json'), 'utf8')
    );

    // ── Adapter Logic ──────────────────────────────────────────────────────
    let pythonParams;
    let liveTrafficContext = "";
    
    if (source === 'live') {
      try {
        const tomtomKey = process.env.TOMTOM_API_KEY;
        if (!tomtomKey) {
          throw new Error("Missing TOMTOM_API_KEY");
        }
        
        // I-94 Bounding Box (Chicago to Milwaukee roughly)
        const bbox = "41.8781,-87.9065,43.0389,-87.6298";
        const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${tomtomKey}&bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory}}}`;
        
        const ttRes = await axios.get(url, { timeout: 4000 });
        const incidents = ttRes.data.incidents || [];
        
        // Count major incidents (e.g., accidents or extreme delays)
        const majorIncidents = incidents.filter(inc => inc.properties.iconCategory === 1 || inc.properties.iconCategory === 8).length;
        
        let weather_condition = "clear";
        if (majorIncidents > 3) weather_condition = "storm";
        else if (majorIncidents > 0) weather_condition = "light_rain";
        
        liveTrafficContext = `TomTom Live: Detected ${incidents.length} total incidents (${majorIncidents} major) on I-94 corridor. `;
        
        pythonParams = { 
          route: "I-94", 
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), 
          weather_condition 
        };
      } catch (err) {
        console.log('TomTom API error or key missing, using fallback live data:', err.message);
        liveTrafficContext = "TomTom API unavailable. Falling back to simulated live traffic. ";
        pythonParams = { route: "I-94", time: "17:00", weather_condition: "light_rain" };
      }
    } else {
      // Historical: fixed demo parameters
      pythonParams = { route: "I-94", time: "17:00", weather_condition: "heavy_rain" };
    }

    let disruption;
    try {
      const pythonRes = await axios.post(
        'http://localhost:8001/predict-disruption',
        pythonParams,
        { timeout: 5000 }
      );
      disruption = pythonRes.data;
    } catch (err) {
      console.log('Python unavailable, using fallback disruption data');
      disruption = {
        disrupted: true,
        severity: 8,
        predicted_delay_mins: 62,
        historical_context: "Fallback: I-94 heavy rain Friday = 62 min delay",
        predicted_speed_factor: 0.35,
        confidence: 0.91,
        recommended_capacity: { "I-94": 5, "Highway-50": 15, "I-43": 10 }
      };
    }

    await writeToFirebase('demo-state/disruption', {
      ...disruption,
      active: true,
      weather_condition: pythonParams.weather_condition,
      affected_route: "I-94",
      historical_context: liveTrafficContext + disruption.historical_context,
      timestamp: Date.now()
    });

    const enrichedTrucks = coordinateFleet(trucks, disruption);
    const kpis = calculateKPIs(enrichedTrucks);

    await writeToFirebase('demo-state/fleet', enrichedTrucks);
    await writeToFirebase('demo-state/kpi', kpis);
    await writeToFirebase('demo-state/simulation_running', false);

    res.json({ success: true, source, trucks_processed: enrichedTrucks.length, kpis });
  } catch (error) {
    console.error(error);
    await writeToFirebase('demo-state/simulation_running', false).catch(console.error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /trigger-event ──────────────────────────────────────────────────────
app.post('/trigger-event', async (req, res) => {
  const { weather_condition, time } = req.body;

  try {
    await writeToFirebase('demo-state/simulation_running', true);

    const trucks = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'demo_fleet.json'), 'utf8')
    );

    let disruption;
    try {
      const pythonRes = await axios.post(
        'http://localhost:8001/predict-disruption',
        { route: "I-94", time: time || "17:00", weather_condition: weather_condition || "heavy_rain" },
        { timeout: 5000 }
      );
      disruption = pythonRes.data;
    } catch (err) {
      console.log('Python unavailable, using fallback disruption data');
      disruption = {
        disrupted: true,
        severity: 8,
        predicted_delay_mins: 62,
        historical_context: `Fallback: I-94 ${weather_condition || "heavy_rain"} = 62 min delay`,
        predicted_speed_factor: 0.35,
        confidence: 0.91,
        recommended_capacity: { "I-94": 5, "Highway-50": 15, "I-43": 10 }
      };
    }

    await writeToFirebase('demo-state/disruption', {
      ...disruption,
      active: true,
      weather_condition: weather_condition || "heavy_rain",
      affected_route: "I-94",
      timestamp: Date.now()
    });

    const enrichedTrucks = coordinateFleet(trucks, disruption);
    const kpis = calculateKPIs(enrichedTrucks);

    await writeToFirebase('demo-state/fleet', enrichedTrucks);
    await writeToFirebase('demo-state/kpi', kpis);
    await writeToFirebase('demo-state/simulation_running', false);

    res.json({ success: true, trucks_processed: enrichedTrucks.length, kpis });
  } catch (error) {
    console.error(error);
    await writeToFirebase('demo-state/simulation_running', false).catch(console.error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /reset ──────────────────────────────────────────────────────────────
app.post('/reset', async (req, res) => {
  try {
    // Firebase deletes empty arrays, so we write a null sentinel for fleet
    // which the frontend maps to "clear state"
    await writeToFirebase('demo-state', {
      fleet: null,
      kpi: null,
      disruption: { active: false },
      simulation_running: false
    });
    res.json({ success: true, message: "Demo reset complete" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /fleet-status ────────────────────────────────────────────────────────
app.get('/fleet-status', async (req, res) => {
  try {
    const snapshot = await db.ref('demo-state').once('value');
    res.json(snapshot.val() || {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /health ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: "ok", service: "FleetPredict Node Core", port: 3000 });
});

// ─── Self Test ────────────────────────────────────────────────────────────────
function selfTest() {
  const testTrucks = [
    {
      truck_id: "TEST-001", tier: "premium", cargo_type: "perishable",
      lat: 41.878, lng: -87.629, hours_driven: 3, weight_tons: 10, deadline_hour: 16.5
    },
    {
      truck_id: "TEST-002", tier: "standard", cargo_type: "standard",
      lat: 41.879, lng: -87.630, hours_driven: 7, weight_tons: 25, deadline_hour: 20
    }
  ];

  const testDisruption = {
    disrupted: true,
    severity: 8,
    recommended_capacity: { "I-94": 5, "Highway-50": 15, "I-43": 10 }
  };

  const result = coordinateFleet(testTrucks, testDisruption);
  const kpis   = calculateKPIs(result);

  const passed =
    result.length === 2 &&
    result[0].assigned_route !== undefined &&
    kpis.fleetpredict !== undefined &&
    kpis.reactive !== undefined &&
    kpis.reactive.on_time_rate < kpis.fleetpredict.on_time_rate;

  console.log(
    passed ? '✅ SELF TEST PASSED' : '❌ SELF TEST FAILED',
    JSON.stringify(kpis, null, 2)
  );
}

selfTest();

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FleetPredict Node Core running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Trigger demo: POST http://localhost:${PORT}/trigger-simulation`);
});
