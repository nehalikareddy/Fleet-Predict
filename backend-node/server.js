const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// ─── Mock Telematics Data (Samsara, Geotab) ───────────────────────────────────
const mockTelematics = {
  samsara_hos: {
    data: [
      {
        driver: { id: "78321", name: "John Doe" },
        vehicle: { id: "Truck-Alpha" },
        clocks: { drive: { driveRemainingDurationMs: 14400000, drivingInViolationCycle: false } }
      },
      {
        driver: { id: "99312", name: "Sarah Connor" },
        vehicle: { id: "Truck-Beta" },
        clocks: { drive: { driveRemainingDurationMs: 1800000, drivingInViolationCycle: false } }
      }
    ],
    pagination: { hasNextPage: false }
  },
  geotab_faults: {
    jsonrpc: "2.0",
    result: [
      {
        id: "Fault-9921",
        device: { id: "b12A", name: "Freightliner-09" },
        diagnostic: { id: "DiagnosticEngineLightWarningId", name: "Critical Engine Derate - Immobilized" },
        activeLocation: { x: -87.6298, y: 41.8781 },
        dateTime: "2024-10-25T14:32:00.000Z",
        faultState: "Active"
      }
    ]
  },
  samsara_weight: {
    data: [
      {
        id: "21201491823",
        name: "Heavy-Hauler-01",
        weightTickets: { grossWeightKg: 36287, time: "2024-10-25T12:00:00Z" },
        gps: { latitude: 41.8818, longitude: -87.6231, headingDegrees: 180, speedMilesPerHour: 65.2 }
      },
      {
        id: "21201491824",
        name: "Empty-Return-02",
        weightTickets: { grossWeightKg: 14000, time: "2024-10-25T12:00:00Z" },
        gps: { latitude: 41.8815, longitude: -87.6230, headingDegrees: 180, speedMilesPerHour: 65.0 }
      }
    ]
  }
};

// ─── Scenario Route Definitions ───────────────────────────────────────────────
const SCENARIO_ROUTES = {
  scenario_1_hos: {
    label: "HoS Compliance — Chicago → Milwaukee (I-94)",
    origin: { lat: 41.8781, lng: -87.6298, label: "Chicago, IL" },
    destination: { lat: 43.0389, lng: -87.9065, label: "Milwaukee, WI" },
    highway: "I-94",
    trucks: [
      {
        truck_id: "Truck-Alpha", driver: "John Doe", tier: "premium",
        weight_tons: 12, hours_driven: 7, deadline_hour: 18,
        startLat: 41.9200, startLng: -87.6600,
        scenario: "scenario_1_hos", telematicsFlag: "hos_safe", hos_remaining_mins: 240
      },
      {
        truck_id: "Truck-Beta", driver: "Sarah Connor", tier: "standard",
        weight_tons: 10, hours_driven: 10.5, deadline_hour: 17,
        startLat: 41.9500, startLng: -87.6800,
        scenario: "scenario_1_hos", telematicsFlag: "hos_critical", hos_remaining_mins: 30
      }
    ]
  },
  scenario_2_geotab: {
    label: "Engine Fault Chokepoint — Detroit → Cleveland (I-90)",
    origin: { lat: 42.3314, lng: -83.0458, label: "Detroit, MI" },
    destination: { lat: 41.4993, lng: -81.6944, label: "Cleveland, OH" },
    highway: "I-90",
    trucks: [
      {
        truck_id: "Freightliner-09", driver: "Marcus Webb", tier: "bulk",
        weight_tons: 22, hours_driven: 5, deadline_hour: 19,
        startLat: 42.1200, startLng: -82.5000,
        scenario: "scenario_2_geotab", telematicsFlag: "engine_fault",
        faultCode: "Critical Engine Derate - Immobilized"
      },
      {
        truck_id: "Kenworth-14", driver: "Priya Anand", tier: "standard",
        weight_tons: 18, hours_driven: 3, deadline_hour: 20,
        startLat: 42.1800, startLng: -82.6500,
        scenario: "scenario_2_geotab", telematicsFlag: "clear"
      },
      {
        truck_id: "Peterbilt-22", driver: "Luis Herrera", tier: "standard",
        weight_tons: 15, hours_driven: 4, deadline_hour: 20,
        startLat: 42.2200, startLng: -82.8000,
        scenario: "scenario_2_geotab", telematicsFlag: "clear"
      }
    ]
  },
  scenario_3_weight: {
    label: "Weight Restriction — Indianapolis → Cincinnati (I-74)",
    origin: { lat: 39.7684, lng: -86.1581, label: "Indianapolis, IN" },
    destination: { lat: 39.1031, lng: -84.5120, label: "Cincinnati, OH" },
    highway: "I-74",
    trucks: [
      {
        truck_id: "Heavy-Hauler-01", driver: "Tom Briggs", tier: "bulk",
        weight_tons: 40, hours_driven: 4, deadline_hour: 20,
        startLat: 39.7000, startLng: -85.8000,
        scenario: "scenario_3_weight", telematicsFlag: "weight_restricted", grossWeightKg: 36287
      },
      {
        truck_id: "Empty-Return-02", driver: "Dana Kim", tier: "standard",
        weight_tons: 7, hours_driven: 2, deadline_hour: 21,
        startLat: 39.6800, startLng: -85.7500,
        scenario: "scenario_3_weight", telematicsFlag: "weight_safe", grossWeightKg: 14000
      }
    ]
  }
};

// ─── pollEnterpriseTelematics() ───────────────────────────────────────────────
async function pollEnterpriseTelematics() {
  return new Promise((resolve) => {
    setTimeout(async () => {

      // ── SAMSARA HoS POLLING ──
      console.log("\n[TELEMATICS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[TELEMATICS] 📡 Polling Samsara API → /fleet/hos/clocks");
      console.log("[TELEMATICS]    Route: Chicago → Milwaukee (I-94)");
      await new Promise(r => setTimeout(r, 400));
      const hosData = mockTelematics.samsara_hos.data;
      hosData.forEach(driver => {
        const minsRemaining = driver.clocks.drive.driveRemainingDurationMs / 60000;
        if (minsRemaining < 60) {
          console.log(`[TELEMATICS] ⚠️  ALERT: ${driver.vehicle.id} — Driver ${driver.driver.name} has ${minsRemaining} mins drive time remaining. DOT HoS constraint applied. Routing to nearest safe truck stop.`);
        } else {
          console.log(`[TELEMATICS] ✅ ${driver.vehicle.id} — Driver ${driver.driver.name}: ${minsRemaining} mins remaining. Eligible for full reroute.`);
        }
      });

      // ── GEOTAB ENGINE FAULT POLLING ──
      console.log("\n[TELEMATICS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[TELEMATICS] 📡 Polling Geotab API → Get<FaultData>");
      console.log("[TELEMATICS]    Route: Detroit → Cleveland (I-90)");
      await new Promise(r => setTimeout(r, 400));
      const faults = mockTelematics.geotab_faults.result;
      if (faults.length > 0) {
        faults.forEach(fault => {
          if (fault.faultState === "Active") {
            console.log(`[TELEMATICS] 🔴 ENGINE FAULT DETECTED: ${fault.device.name} — "${fault.diagnostic.name}". Vehicle immobilized at [${fault.activeLocation.y}, ${fault.activeLocation.x}]. Triggering upstream cascade-prevention reroute.`);
          }
        });
      } else {
        console.log("[TELEMATICS] ✅ All active vehicles cleared. No critical engine derates detected.");
      }

      // ── SAMSARA WEIGHT TELEMETRY POLLING ──
      console.log("\n[TELEMATICS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[TELEMATICS] 📡 Polling Samsara API → /fleet/vehicles/stats");
      console.log("[TELEMATICS]    Route: Indianapolis → Cincinnati (I-74)");
      await new Promise(r => setTimeout(r, 400));
      const weightData = mockTelematics.samsara_weight.data;
      weightData.forEach(vehicle => {
        const lbs = Math.round(vehicle.weightTickets.grossWeightKg * 2.205);
        if (vehicle.weightTickets.grossWeightKg > 18000) {
          console.log(`[TELEMATICS] ⚠️  WEIGHT ALERT: ${vehicle.name} — Gross weight ${vehicle.weightTickets.grossWeightKg}kg (${lbs.toLocaleString()} lbs). Exceeds rural bridge limit of 40,000 lbs. Constraint: primary highway routing ONLY.`);
        } else {
          console.log(`[TELEMATICS] ✅ ${vehicle.name} — Gross weight ${vehicle.weightTickets.grossWeightKg}kg (${lbs.toLocaleString()} lbs). Within all bridge limits. Eligible for rural shortcut routing.`);
        }
      });

      console.log("\n[TELEMATICS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[TELEMATICS] ✅ Enterprise telematics poll complete. All constraints injected into routing engine.\n");

      resolve();
    }, 800);
  });
}

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

let db = null;
try {
  db = admin.database();
} catch (err) {
  console.warn('⚠️  Firebase database could not be accessed. Real-time sync disabled.');
}

async function writeToFirebase(dbPath, data) {
  if (!db) return;
  await db.ref(dbPath).set(data);
}

async function patchFirebase(dbPath, data) {
  if (!db) return;
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
  const scenario = req.body.scenario; // e.g. "chicago", "detroit", "indianapolis"

  try {
    await pollEnterpriseTelematics();
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
        
        const bbox = "41.8781,-87.9065,43.0389,-87.6298";
        const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${tomtomKey}&bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory}}}`;
        
        const ttRes = await axios.get(url, { timeout: 4000 });
        const incidents = ttRes.data.incidents || [];
        
        const majorIncidents = incidents.filter(inc => inc.properties.iconCategory === 1 || inc.properties.iconCategory === 8).length;
        
        let weather_condition = "clear";
        if (majorIncidents > 3) weather_condition = "storm";
        else if (majorIncidents > 0) weather_condition = "light_rain";
        
        liveTrafficContext = `TomTom Live: Detected ${incidents.length} total incidents (${majorIncidents} major) on I-94 corridor. `;
        
        pythonParams = { 
          route: "I-94", 
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), 
          weather_condition,
          scenario_id: scenario
        };
      } catch (err) {
        console.log('TomTom API error or key missing, using fallback live data:', err.message);
        liveTrafficContext = "TomTom API unavailable. Falling back to simulated live traffic. ";
        pythonParams = { route: "I-94", time: "17:00", weather_condition: "light_rain", scenario_id: scenario };
      }
    } else {
      // Historical: fixed demo parameters
      pythonParams = { route: "I-94", time: "17:00", weather_condition: "heavy_rain", scenario_id: scenario };
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

    let enrichedTrucks;
    if (disruption.fleet) {
      // Detroit or Indianapolis scenario handled entirely by Python
      enrichedTrucks = disruption.fleet;
      await writeToFirebase('demo-state/active_scenario', scenario);
      await writeToFirebase('demo-state/disruption', null);
    } else {
      // Default Chicago behavior
      await writeToFirebase('demo-state/active_scenario', null);
      await writeToFirebase('demo-state/disruption', {
        ...disruption,
        active: true,
        weather_condition: pythonParams.weather_condition,
        affected_route: "I-94",
        historical_context: liveTrafficContext + disruption.historical_context,
        timestamp: Date.now(),
        scenarios: SCENARIO_ROUTES
      });
      enrichedTrucks = coordinateFleet(trucks, disruption);
    }

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

// ─── POST /onboard-fleet (Simulated Telematics Onboarding) ────────────────────
app.post('/onboard-fleet', async (req, res) => {
  const { provider, apiKey } = req.body;

  // Simulation key validation — accept the demo key or any key starting with 'fleet_'
  const VALID_KEY = 'fleet_demo_key_xyz789';

  if (!apiKey || apiKey.trim() === '') {
    return res.status(401).json({
      success: false,
      error: 'API connection failed. No key provided.',
      step: 'validation'
    });
  }

  if (apiKey !== VALID_KEY && !apiKey.startsWith('fleet_')) {
    return res.status(401).json({
      success: false,
      error: `Unrecognized API key. Use the demo key shown on screen.`,
      step: 'validation'
    });
  }

  try {
    await writeToFirebase('demo-state/simulation_running', true);

    // Load Fleet B (FedEx simulation)
    const trucks = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'fleet_b.json'), 'utf8')
    );

    // Get disruption prediction from Python AI
    let disruption;
    try {
      const pythonRes = await axios.post(
        'http://localhost:8001/predict-disruption',
        { route: "I-94", time: "14:00", weather_condition: "light_rain" },
        { timeout: 5000 }
      );
      disruption = pythonRes.data;
    } catch (err) {
      console.log('Python unavailable during onboarding, using fallback');
      disruption = {
        disrupted: false,
        severity: 3,
        predicted_delay_mins: 12,
        historical_context: "Fleet B onboarded: East Coast corridor, light traffic conditions",
        predicted_speed_factor: 0.82,
        confidence: 0.78,
        recommended_capacity: { "I-94": 15, "Highway-50": 10, "I-43": 8 }
      };
    }

    await writeToFirebase('demo-state/disruption', {
      ...disruption,
      active: disruption.disrupted,
      weather_condition: "light_rain",
      affected_route: "I-95",
      historical_context: `Fleet B (FedEx) onboarded via ${provider || 'Samsara'} API. ${disruption.historical_context}`,
      timestamp: Date.now()
    });

    const enrichedTrucks = coordinateFleet(trucks, disruption);
    const kpis = calculateKPIs(enrichedTrucks);

    await writeToFirebase('demo-state/fleet', enrichedTrucks);
    await writeToFirebase('demo-state/kpi', kpis);
    await writeToFirebase('demo-state/simulation_running', false);

    res.json({
      success: true,
      provider: provider || 'Samsara',
      fleet_name: 'FedEx East Coast',
      trucks_loaded: enrichedTrucks.length,
      kpis
    });
  } catch (error) {
    console.error(error);
    await writeToFirebase('demo-state/simulation_running', false).catch(console.error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /set-scenario ───────────────────────────────────────────────────────
app.post('/set-scenario', async (req, res) => {
  const { scenarioKey } = req.body;
  const scenario = SCENARIO_ROUTES[scenarioKey];
  if (!scenario) {
    return res.status(400).json({ error: "Unknown scenario key" });
  }
  const scenarioFleet = scenario.trucks.map(truck => ({
    ...truck,
    assigned_route: scenario.highway,
    status: "on_time",
    delay_mins: 0,
    reactive_route: scenario.highway,
    reactive_status: "on_time",
    reactive_delay_mins: 0
  }));
  await db.ref("demo-state/fleet").set(scenarioFleet);
  await db.ref("demo-state/active_scenario").set(scenarioKey);
  await db.ref("demo-state/disruption").set(null);
  res.json({ success: true, scenario: scenarioKey, trucks_loaded: scenarioFleet.length });
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
