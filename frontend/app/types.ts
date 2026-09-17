/**
 * ORACLE Edge - TypeScript Data Types
 * Aligned with PRD Section 12 Data Model & Step 4 Multi-Hazard Architecture
 */

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type TargetHazard = "FLOOD" | "WILDFIRE" | "STRUCTURAL";

export type AssetDomain = "URBAN_INFRASTRUCTURE" | "FORESTRY" | "INDUSTRIAL";

export interface ContributingFactor {
  category: "Hazard" | "Exposure" | "Vulnerability";
  factor: string;
  value: string;
  impact_pct: number;
  severity: "NORMAL" | "HIGH" | "CRITICAL";
}

export interface AssetMonitoringData {
  asset_id: string;
  name: string;
  type: string;
  domain?: AssetDomain | string;
  target_hazard?: TargetHazard | string;
  latitude?: number;
  longitude?: number;
  criticality: number;
  population_served: number;
  water_level_cm: number;
  rise_rate_cm_min: number;
  surface_temp_c?: number;
  thermal_risk_pct?: number;
  humidity_pct?: number;
  wind_speed_kmh?: number;
  tilt_deg?: number;
  vibration_g?: number;
  scour_risk_pct?: number;
  satellite_ndwi_delta?: number;
  priority_score: number;
  risk_score: number;
  priority_rank: number;
  status: "CRITICAL" | "SAFE" | "MODERATE" | "ELEVATED" | string;
  led_safe: boolean;
  led_critical: boolean;
  shap_breakdown?: Record<string, number>;
  timestamp?: string;
}

export interface ActionItem {
  action_id: string;
  asset_id: string;
  recommended_action: string;
  priority: number;
  priority_score: number;
  target_hazard: TargetHazard | string;
  assigned_team: string | null;
  target_response_time: string;
  status: "PENDING" | "DISPATCHED" | "COMPLETED";
  reasoning?: string;
  created_at?: string;
  dispatched_at?: string;
  completed_at?: string;
  countdown_seconds: number;
}

export interface TeamItem {
  team_id: string;
  team_name: string;
  specialty: string;
  hazard_domain: string;
  status: "AVAILABLE" | "DISPATCHED";
  current_assignment?: string | null;
}

export interface InfrastructureAsset {
  asset_id: string;
  name: string;
  asset_type: "Bridge" | "Drain" | "Road" | "Facility" | "School" | "Forest_Reserve" | "Substation";
  latitude: number;
  longitude: number;
  criticality: number;
  population_served: number;
  nearest_hospital: string;
  historical_risk: string;
  elevation_m: number;
  slope_deg: number;
  distance_to_water_m: number;
  status: "ACTIVE" | "INACTIVE";
  water_level_cm: number;
  water_rise_rate_cm_min: number;
  rainfall_1h_mm: number;
  rainfall_3h_mm: number;
  rainfall_24h_mm: number;
  forecast_rainfall_mm: number;
  satellite_water_coverage_pct: number;
  battery_voltage: number;
  rain_detected: boolean;
  hazard_score: number;
  exposure_score: number;
  vulnerability_score: number;
  risk_score: number;
  priority_score: number;
  risk_level: RiskLevel;
  factors: ContributingFactor[];

  // Action status
  recommended_action?: string;
  action_priority?: number;
  target_response_time?: string;
  assigned_team?: string | null;
  action_status?: "PENDING" | "DISPATCHED" | "ON_SITE" | "COMPLETED";
  action_reasoning?: string;
}

export interface InspectionTeam {
  team_id: string;
  team_name: string;
  specialty: string;
  status: "AVAILABLE" | "DEPLOYED" | "STANDBY";
  current_assignment: string | null;
  personnel_count: number;
  equipment: string[];
}

export interface DemoScenario {
  step: number;
  name: string;
  water_level_cm: number;
  water_rise_rate_cm_min: number;
  rainfall_1h_mm: number;
  rain_detected: boolean;
  expected_risk: number;
  expected_category: RiskLevel;
  description: string;
  hardware_alert: boolean;
}

export interface ModelComparisonMetric {
  name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
  latency_ms: number;
  is_selected: boolean;
}

export interface ApiStatus {
  open_meteo: "LIVE" | "FALLBACK" | string;
  sentinel_2: "LIVE" | "FALLBACK" | string;
}

export interface DeviceStatus {
  device_id: string;
  status: "ONLINE" | "OFFLINE" | "SIMULATION" | string;
  mode?: "HARDWARE" | "SIMULATION" | string;
  is_online?: boolean;
  last_seen_sec: number;
  last_seen?: string;
}



