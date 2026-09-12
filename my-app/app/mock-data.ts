/**
 * ORACLE Edge - Baseline Data & ML Scenarios
 * Compliant with PRD Section 8, 9, 12, and 22.
 */

import { InfrastructureAsset, InspectionTeam, DemoScenario, ModelComparisonMetric, RiskLevel, ContributingFactor } from "./types";

export const INITIAL_ASSETS: InfrastructureAsset[] = [
  {
    asset_id: "B17",
    name: "Bridge B17 (Kadal Causeway)",
    asset_type: "Bridge",
    latitude: 13.0827,
    longitude: 80.2707,
    criticality: 0.95,
    population_served: 12000,
    nearest_hospital: "YES",
    historical_risk: "HIGH",
    elevation_m: 12.0,
    slope_deg: 3.0,
    distance_to_water_m: 15.0,
    status: "ACTIVE",

    water_level_cm: 20.0,
    water_rise_rate_cm_min: 0.1,
    rainfall_1h_mm: 0.0,
    rainfall_3h_mm: 1.5,
    rainfall_24h_mm: 5.0,
    forecast_rainfall_mm: 10.0,
    satellite_water_coverage_pct: 12.0,
    battery_voltage: 4.15,
    rain_detected: false,

    hazard_score: 24.5,
    exposure_score: 78.0,
    vulnerability_score: 68.5,
    risk_score: 22.0,
    priority_score: 38.0,
    risk_level: "LOW",
    factors: [
      { category: "Hazard", factor: "Water Level & Submergence", value: "20.0 cm", impact_pct: 7.5, severity: "NORMAL" },
      { category: "Exposure", factor: "Population & Hospital Route", value: "12,000 citizens", impact_pct: 22.0, severity: "HIGH" },
      { category: "Vulnerability", factor: "Bridge Criticality Index", value: "0.95 (High)", impact_pct: 18.0, severity: "CRITICAL" }
    ],

    recommended_action: "Routine Monitoring & Telemetry Check",
    action_priority: 4,
    target_response_time: "24 hours",
    assigned_team: null,
    action_status: "PENDING",
    action_reasoning: "Water levels normal (20cm). Structural clearance verified by baseline acoustic sensors."
  },
  {
    asset_id: "D03",
    name: "Drain D03 (Velachery Canal Outlet)",
    asset_type: "Drain",
    latitude: 12.9815,
    longitude: 80.2180,
    criticality: 0.85,
    population_served: 8500,
    nearest_hospital: "NO",
    historical_risk: "CRITICAL",
    elevation_m: 8.5,
    slope_deg: 1.5,
    distance_to_water_m: 5.0,
    status: "ACTIVE",

    water_level_cm: 45.0,
    water_rise_rate_cm_min: 0.9,
    rainfall_1h_mm: 18.0,
    rainfall_3h_mm: 36.0,
    rainfall_24h_mm: 68.0,
    forecast_rainfall_mm: 30.0,
    satellite_water_coverage_pct: 26.0,
    battery_voltage: 4.08,
    rain_detected: true,

    hazard_score: 52.0,
    exposure_score: 62.0,
    vulnerability_score: 75.0,
    risk_score: 58.0,
    priority_score: 64.0,
    risk_level: "MODERATE",
    factors: [
      { category: "Hazard", factor: "Water Rise Rate", value: "+0.9 cm/min", impact_pct: 14.5, severity: "HIGH" },
      { category: "Vulnerability", factor: "Historical Canal Siltation", value: "3 past blockages", impact_pct: 21.0, severity: "HIGH" },
      { category: "Exposure", factor: "Low-Lying Residential Catchment", value: "8,500 citizens", impact_pct: 16.0, severity: "NORMAL" }
    ],

    recommended_action: "Increased Monitoring & Sluice Desilt Inspection",
    action_priority: 3,
    target_response_time: "6 hours",
    assigned_team: null,
    action_status: "PENDING",
    action_reasoning: "Moderate runoff elevation. Flatter gradient (1.5 deg) indicates potential drainage stagnation."
  },
  {
    asset_id: "R08",
    name: "Road R08 (GST Arterial Underpass)",
    asset_type: "Road",
    latitude: 13.0102,
    longitude: 80.2158,
    criticality: 0.75,
    population_served: 25000,
    nearest_hospital: "YES",
    historical_risk: "HIGH",
    elevation_m: 9.0,
    slope_deg: 2.0,
    distance_to_water_m: 45.0,
    status: "ACTIVE",

    water_level_cm: 32.0,
    water_rise_rate_cm_min: 0.4,
    rainfall_1h_mm: 12.0,
    rainfall_3h_mm: 25.0,
    rainfall_24h_mm: 42.0,
    forecast_rainfall_mm: 20.0,
    satellite_water_coverage_pct: 18.0,
    battery_voltage: 4.12,
    rain_detected: true,

    hazard_score: 41.0,
    exposure_score: 82.0,
    vulnerability_score: 58.0,
    risk_score: 46.0,
    priority_score: 55.0,
    risk_level: "MODERATE",
    factors: [
      { category: "Exposure", factor: "High Commuter Traffic Flow", value: "25,000 peak vehicles", impact_pct: 25.0, severity: "HIGH" },
      { category: "Hazard", factor: "Underpass Basin Accumulation", value: "32.0 cm water depth", impact_pct: 12.0, severity: "NORMAL" },
      { category: "Vulnerability", factor: "Hospital Emergency Lane", value: "Direct Link", impact_pct: 14.0, severity: "HIGH" }
    ],

    recommended_action: "Monitor Submergence Level & Traffic Flow",
    action_priority: 3,
    target_response_time: "6 hours",
    assigned_team: null,
    action_status: "PENDING",
    action_reasoning: "Moderate surface runoff. Prepare arterial diversion signage if rain intensifies."
  },
  {
    asset_id: "H02",
    name: "Hospital Substation Corridor H02",
    asset_type: "Facility",
    latitude: 13.0405,
    longitude: 80.2450,
    criticality: 0.98,
    population_served: 45000,
    nearest_hospital: "YES",
    historical_risk: "MODERATE",
    elevation_m: 14.0,
    slope_deg: 4.0,
    distance_to_water_m: 95.0,
    status: "ACTIVE",

    water_level_cm: 15.0,
    water_rise_rate_cm_min: 0.05,
    rainfall_1h_mm: 5.0,
    rainfall_3h_mm: 10.0,
    rainfall_24h_mm: 18.0,
    forecast_rainfall_mm: 15.0,
    satellite_water_coverage_pct: 9.0,
    battery_voltage: 4.18,
    rain_detected: false,

    hazard_score: 18.0,
    exposure_score: 96.0,
    vulnerability_score: 55.0,
    risk_score: 28.0,
    priority_score: 48.0,
    risk_level: "LOW",
    factors: [
      { category: "Exposure", factor: "Critical Healthcare Dependency", value: "45,000 citizens served", impact_pct: 28.0, severity: "CRITICAL" },
      { category: "Hazard", factor: "Low Inundation Risk", value: "15.0 cm, 95m buffer", impact_pct: 5.0, severity: "NORMAL" },
      { category: "Vulnerability", factor: "Elevated Facility Berm", value: "14m elevation", impact_pct: -8.0, severity: "NORMAL" }
    ],

    recommended_action: "Continuous Standby & Sensor Heartbeat Check",
    action_priority: 4,
    target_response_time: "24 hours",
    assigned_team: null,
    action_status: "PENDING",
    action_reasoning: "Stable conditions. High consequence asset under automated surveillance."
  },
  {
    asset_id: "S05",
    name: "School Basin Zone S05",
    asset_type: "School",
    latitude: 12.9750,
    longitude: 80.2210,
    criticality: 0.80,
    population_served: 4200,
    nearest_hospital: "NO",
    historical_risk: "MODERATE",
    elevation_m: 7.0,
    slope_deg: 1.0,
    distance_to_water_m: 35.0,
    status: "ACTIVE",

    water_level_cm: 28.0,
    water_rise_rate_cm_min: 0.3,
    rainfall_1h_mm: 8.0,
    rainfall_3h_mm: 19.0,
    rainfall_24h_mm: 35.0,
    forecast_rainfall_mm: 25.0,
    satellite_water_coverage_pct: 14.0,
    battery_voltage: 4.10,
    rain_detected: false,

    hazard_score: 32.0,
    exposure_score: 55.0,
    vulnerability_score: 62.0,
    risk_score: 36.0,
    priority_score: 42.0,
    risk_level: "MODERATE",
    factors: [
      { category: "Exposure", factor: "School Campus Population", value: "4,200 students/staff", impact_pct: 18.0, severity: "NORMAL" },
      { category: "Hazard", factor: "Depression Basin Accumulation", value: "7m elevation", impact_pct: 14.0, severity: "NORMAL" },
      { category: "Vulnerability", factor: "Surface Drainage Capacity", value: "Flatter basin (1.0 deg)", impact_pct: 12.0, severity: "NORMAL" }
    ],

    recommended_action: "Inspect Boundary Drains & Verify Pump Status",
    action_priority: 3,
    target_response_time: "12 hours",
    assigned_team: null,
    action_status: "PENDING",
    action_reasoning: "Moderate surface runoff. Campus flood barriers functional."
  }
];

export const INITIAL_TEAMS: InspectionTeam[] = [
  {
    team_id: "TEAM-A",
    team_name: "Team Alpha (Bridge Inspection)",
    specialty: "Structural, Pier Scour & Under-Deck Acoustics",
    status: "AVAILABLE",
    current_assignment: null,
    personnel_count: 4,
    equipment: ["Scour Sonar", "Bridge Scaffolding", "Hydraulic Jack Sets", "Emergency Radio"]
  },
  {
    team_id: "TEAM-B",
    team_name: "Team Bravo (Rapid Drainage)",
    specialty: "High-Capacity Storm De-Watering & Sluice Desilting",
    status: "AVAILABLE",
    current_assignment: null,
    personnel_count: 5,
    equipment: ["Diesel De-watering Pumps (1000 LPM)", "Jetting Vacuum Tanker", "Flood Barriers"]
  },
  {
    team_id: "TEAM-C",
    team_name: "Team Charlie (Traffic & Emergency)",
    specialty: "Arterial Road Diversion & Population Protection",
    status: "AVAILABLE",
    current_assignment: null,
    personnel_count: 6,
    equipment: ["Automated Variable Message Signs (VMS)", "Barricades", "Inflatable Rescue Boat"]
  }
];

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    step: 1,
    name: "Step 1: Normal Water Baseline",
    water_level_cm: 20.0,
    water_rise_rate_cm_min: 0.1,
    rainfall_1h_mm: 0.0,
    rain_detected: false,
    expected_risk: 22.0,
    expected_category: "LOW",
    description: "Dry weather conditions. River channel at baseflow (20cm). Normal sensor telemetry.",
    hardware_alert: false
  },
  {
    step: 2,
    name: "Step 2: Rising Water",
    water_level_cm: 40.0,
    water_rise_rate_cm_min: 0.8,
    rainfall_1h_mm: 15.0,
    rain_detected: true,
    expected_risk: 48.0,
    expected_category: "MODERATE",
    description: "Steady rainfall starts (15mm/h). Water level rises to 40cm. Telemetry interval increases.",
    hardware_alert: false
  },
  {
    step: 3,
    name: "Step 3: Rapid Water Rise",
    water_level_cm: 65.0,
    water_rise_rate_cm_min: 2.2,
    rainfall_1h_mm: 35.0,
    rain_detected: true,
    expected_risk: 76.0,
    expected_category: "HIGH",
    description: "Heavy downpour (35mm/h). High rise rate (+2.2 cm/min). Water reaches 65cm. Inspection team advised.",
    hardware_alert: false
  },
  {
    step: 4,
    name: "Step 4: Critical Bridge B17 Emergency",
    water_level_cm: 75.0,
    water_rise_rate_cm_min: 2.8,
    rainfall_1h_mm: 50.0,
    rain_detected: true,
    expected_risk: 92.0,
    expected_category: "CRITICAL",
    description: "Torrential rain (50mm/h). Bridge B17 reaches 75cm submerged clearance threshold! Priority #1 triggered. Physical buzzer and beacon alarm activated!",
    hardware_alert: true
  }
];

export const MODEL_METRICS: ModelComparisonMetric[] = [
  {
    name: "Logistic Regression (Baseline)",
    accuracy: 0.7386,
    precision: 0.7333,
    recall: 0.7386,
    f1_score: 0.7269,
    roc_auc: 0.8299,
    latency_ms: 1.2,
    is_selected: false
  },
  {
    name: "Random Forest (Baseline)",
    accuracy: 0.8771,
    precision: 0.8795,
    recall: 0.8771,
    f1_score: 0.8745,
    roc_auc: 0.9690,
    latency_ms: 6.8,
    is_selected: false
  },
  {
    name: "XGBoost (Primary Engine)",
    accuracy: 0.9029,
    precision: 0.9027,
    recall: 0.9029,
    f1_score: 0.9015,
    roc_auc: 0.9813,
    latency_ms: 4.5,
    is_selected: true
  }
];

/**
 * Calculates updated risk, priority, and SHAP factors for an asset when telemetry changes.
 * Compliant with PRD Section 8.1, 8.2, 8.3 formula.
 */
export function calculateDynamicRisk(asset: InfrastructureAsset, waterLevel: number, riseRate: number, rain1h: number, rainDetected: boolean): InfrastructureAsset {
  const normWl = Math.min(waterLevel / 85.0, 1.3);
  const normRr = Math.min(Math.max((riseRate + 0.5) / 3.5, 0), 1.5);
  const normRain = Math.min(rain1h / 45.0, 1.4);
  const satExpansion = Math.min(12.0 + (waterLevel / 80.0) * 55.0, 75.0);
  const normSat = Math.min(satExpansion / 70.0, 1.3);
  const normTerrain = Math.min(
    Math.max(1.0 - (asset.distance_to_water_m / 300.0), 0) * 0.6 +
    Math.max(1.0 - (asset.elevation_m / 30.0), 0) * 0.4,
    1.0
  );

  const hazard = Math.min(Math.max(
    (0.32 * normWl + 0.20 * normRr + 0.20 * normRain + 0.16 * normSat + 0.12 * normTerrain) * 100.0,
    0
  ), 100.0);

  const normPop = Math.min(Math.log10(asset.population_served + 1) / Math.log10(70000), 1.0);
  const exposure = Math.min(Math.max((0.65 * normPop + 0.35 * asset.criticality) * 100.0, 0), 100.0);

  const normHist = asset.historical_risk === "CRITICAL" ? 0.9 : (asset.historical_risk === "HIGH" ? 0.65 : 0.3);
  const normSlope = Math.max(1.0 - (asset.slope_deg / 15.0), 0);
  const vulnerability = Math.min(Math.max((0.50 * asset.criticality + 0.30 * normHist + 0.20 * normSlope) * 100.0, 0), 100.0);

  // Risk Score: f(H, E, V)
  const risk = Math.round(Math.min(Math.max(0.55 * hazard + 0.25 * exposure + 0.20 * vulnerability, 0), 100.0) * 10) / 10;
  
  // Priority Score: PRD 8.2 consequence of failure
  const priority = Math.round(Math.min(Math.max(0.40 * hazard + 0.38 * exposure + 0.22 * vulnerability, 0), 100.0) * 10) / 10;

  let riskLevel: RiskLevel = "LOW";
  if (risk > 80) riskLevel = "CRITICAL";
  else if (risk > 60) riskLevel = "HIGH";
  else if (risk > 30) riskLevel = "MODERATE";

  // SHAP Factors
  const factors: ContributingFactor[] = [
    {
      category: "Hazard",
      factor: "Water Level & Submergence",
      value: `${waterLevel.toFixed(1)} cm`,
      impact_pct: Math.round(normWl * 32.0 * 10) / 10,
      severity: waterLevel > 70 ? "CRITICAL" : (waterLevel > 50 ? "HIGH" : "NORMAL")
    },
    {
      category: "Hazard",
      factor: "Water Rise Rate",
      value: `${riseRate >= 0 ? "+" : ""}${riseRate.toFixed(1)} cm/min`,
      impact_pct: Math.round(normRr * 20.0 * 10) / 10,
      severity: riseRate > 2.0 ? "CRITICAL" : (riseRate > 1.0 ? "HIGH" : "NORMAL")
    },
    {
      category: "Hazard",
      factor: "Rainfall Intensity",
      value: `${rain1h.toFixed(1)} mm/h`,
      impact_pct: Math.round(normRain * 20.0 * 10) / 10,
      severity: rain1h > 35 ? "CRITICAL" : (rain1h > 15 ? "HIGH" : "NORMAL")
    },
    {
      category: "Hazard",
      factor: "Sentinel-2 NDWI Water Extent",
      value: `${satExpansion.toFixed(1)}% expansion`,
      impact_pct: Math.round(normSat * 16.0 * 10) / 10,
      severity: satExpansion > 40 ? "HIGH" : "NORMAL"
    },
    {
      category: "Exposure",
      factor: "Exposed Population",
      value: `${asset.population_served.toLocaleString()} citizens`,
      impact_pct: Math.round(normPop * 22.0 * 10) / 10,
      severity: asset.population_served > 10000 ? "HIGH" : "NORMAL"
    },
    {
      category: "Vulnerability",
      factor: "Asset Criticality Index",
      value: `${asset.criticality.toFixed(2)} (${asset.nearest_hospital === "YES" ? "Hospital Access" : "Standard"})`,
      impact_pct: Math.round(asset.criticality * 18.0 * 10) / 10,
      severity: asset.criticality >= 0.9 ? "CRITICAL" : "HIGH"
    }
  ];

  // Action Recommendation (PRD Section 9)
  let recommended_action = "Routine Monitoring & Telemetry Check";
  let action_priority = 4;
  let target_response_time = "24 hours";
  let action_reasoning = "Normal baseline state. Telemetry within safe operating margins.";

  if (risk > 80) {
    action_priority = 1;
    target_response_time = "30 minutes";
    if (asset.asset_type === "Bridge") {
      recommended_action = "IMMEDIATE INTERVENTION: Close Bridge Deck & Dispatch Inspection Team";
      action_reasoning = "CRITICAL SUBMERGENCE EXCEEDED. Pier scour danger high with active hospital route impact.";
    } else if (asset.asset_type === "Drain") {
      recommended_action = "IMMEDIATE INTERVENTION: Activate Auxiliary Storm Pumps & Clear Inlet";
      action_reasoning = "Canal overflowing. Critical desilting and bypass pumping required to protect residential basin.";
    } else if (asset.asset_type === "Road") {
      recommended_action = "EMERGENCY: Immediate Road Closure & Arterial Traffic Diversion";
      action_reasoning = "Arterial underpass submerged. High commuter entrapment hazard.";
    } else {
      recommended_action = "EMERGENCY WARNING: Deploy High-Capacity Flood Barrier & Emergency Teams";
      action_reasoning = "Critical zone breach. Immediate protective intervention mandated.";
    }
  } else if (risk > 60) {
    action_priority = 2;
    target_response_time = "2 hours";
    if (asset.asset_type === "Bridge") {
      recommended_action = "Dispatch Structural & Scour Inspection Team";
    } else if (asset.asset_type === "Drain") {
      recommended_action = "Dispatch Rapid Sluice & Desilting Crew";
    } else {
      recommended_action = "Issue Pre-Emptive Traffic Caution & Divert Heavy Vehicles";
    }
    action_reasoning = `Elevated hazard (${hazard.toFixed(0)}/100). Rapid water rise threatening threshold clearance.`;
  } else if (risk > 30) {
    action_priority = 3;
    target_response_time = "6 hours";
    recommended_action = "Increased Monitoring & Sensor Heartbeat Check";
    action_reasoning = "Steady inflow registered. Maintain elevated telemetry frequency.";
  }

  return {
    ...asset,
    water_level_cm: Math.round(waterLevel * 10) / 10,
    water_rise_rate_cm_min: Math.round(riseRate * 10) / 10,
    rainfall_1h_mm: Math.round(rain1h * 10) / 10,
    rain_detected: rainDetected,
    satellite_water_coverage_pct: Math.round(satExpansion * 10) / 10,
    hazard_score: Math.round(hazard * 10) / 10,
    exposure_score: Math.round(exposure * 10) / 10,
    vulnerability_score: Math.round(vulnerability * 10) / 10,
    risk_score: risk,
    priority_score: priority,
    risk_level: riskLevel,
    factors: factors,
    recommended_action: recommended_action,
    action_priority: action_priority,
    target_response_time: target_response_time,
    action_reasoning: action_reasoning
  };
}
