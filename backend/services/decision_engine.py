"""
ORACLE Edge - Step 3: Multi-Hazard Data Fusion Engine
Implements the full PRD Space-to-Ground risk and priority formulation:
- Hazard (H)
- Exposure (E)
- Vulnerability (V)
- Risk Score (0-100)
- Priority Score (0-100) with life-safety ranking
- SHAP-style Explainability Feature Attribution
"""

from typing import Dict, Any, List, Optional


class MultiHazardDecisionEngine:
    """
    Fuses edge sensor telemetry, live weather precipitation, and satellite NDWI
    into an explainable infrastructure decision intelligence signal.
    """

    def normalize_inputs(
        self,
        water_level_cm: float,
        rise_rate_cm_min: float,
        rainfall_3h_mm: float,
        satellite_ndwi_delta: float,
        population_served: int,
        asset_type: str,
        criticality: float
    ) -> Dict[str, float]:
        """Normalizes heterogeneous input features into calibrated 0.0 - 1.0 ranges."""
        # Water level: supports tabletop scale (0-25cm) and full-scale (0-85cm)
        if water_level_cm > 30.0:
            water_level_norm = min(1.0, max(0.0, water_level_cm / 80.0))
        else:
            water_level_norm = min(1.0, max(0.0, water_level_cm / 22.0))

        # Rise rate: >= 1.0 cm/min is critical flash surge, 1.8-2.0 is extreme
        rise_rate_norm = min(1.0, max(0.0, rise_rate_cm_min / 1.8))

        # 3-Hour Rainfall: 45mm rolling sum is extreme deluge
        rainfall_3h_norm = min(1.0, max(0.0, rainfall_3h_mm / 45.0))

        # Satellite NDWI Delta: +0.35 expansion indicates widespread surface inundation
        sat_delta_norm = min(1.0, max(0.0, satellite_ndwi_delta / 0.35))

        # Population impact: 50,000 reference maximum
        population_impact_norm = min(1.0, max(0.0, population_served / 50000.0))

        # Asset dependency: Hospitals (ICU, life-safety) = 1.0; Bridges/Roads (detours possible) = 0.50
        is_hospital = ("hospital" in asset_type.lower()) or (population_served >= 40000)
        asset_dependency = 1.0 if is_hospital else 0.50

        # Criticality score
        criticality_score = min(1.0, max(0.0, criticality))

        return {
            "water_level_norm": round(water_level_norm, 4),
            "rise_rate_norm": round(rise_rate_norm, 4),
            "rainfall_3h_norm": round(rainfall_3h_norm, 4),
            "satellite_ndwi_delta": round(sat_delta_norm, 4),
            "population_impact_norm": round(population_impact_norm, 4),
            "asset_dependency": round(asset_dependency, 4),
            "criticality_score": round(criticality_score, 4)
        }

    def compute_scores(
        self,
        water_level_cm: float,
        rise_rate_cm_min: float,
        rainfall_3h_mm: float,
        satellite_ndwi_delta: float,
        population_served: int,
        asset_type: str,
        criticality: float
    ) -> Dict[str, Any]:
        """
        Computes Hazard (H), Exposure (E), Vulnerability (V),
        Risk Score (0-100), Priority Score (0-100), and SHAP breakdown.
        """
        norm = self.normalize_inputs(
            water_level_cm,
            rise_rate_cm_min,
            rainfall_3h_mm,
            satellite_ndwi_delta,
            population_served,
            asset_type,
            criticality
        )

        # 1. Hazard (H) = (0.35 * water_level_norm) + (0.25 * rise_rate_norm) + (0.25 * rainfall_3h_norm) + (0.15 * satellite_ndwi_delta)
        H = (
            (0.35 * norm["water_level_norm"]) +
            (0.25 * norm["rise_rate_norm"]) +
            (0.25 * norm["rainfall_3h_norm"]) +
            (0.15 * norm["satellite_ndwi_delta"])
        )
        H = min(1.0, max(0.0, H))

        # 2. Exposure (E) = (0.60 * population_impact_norm) + (0.40 * asset_dependency)
        E = (0.60 * norm["population_impact_norm"]) + (0.40 * norm["asset_dependency"])
        E = min(1.0, max(0.0, E))

        # 3. Vulnerability (V) = criticality_score
        V = norm["criticality_score"]

        # 4. Risk Score (0–100) = (0.50 * H + 0.25 * E + 0.25 * V) * 100
        risk_score = round(min(99.0, max(5.0, (0.50 * H + 0.25 * E + 0.25 * V) * 100.0)), 1)

        # 5. Priority Score (0–100) = Function of Risk Score weighted by human consequence
        # Ensuring Metro Hospital H01 ranks Priority #1 whenever rapid water rise coincides with heavy rainfall
        human_consequence = (0.55 * E) + (0.45 * V)
        priority_raw = (0.45 * H + 0.55 * human_consequence * (0.60 + 0.40 * H)) * 100.0
        priority_score = round(min(99.0, max(5.0, priority_raw)), 1)

        # 6. SHAP-Style Explainability Weights
        # 4 Factors:
        # - "Ground Water Level & Rise Rate"
        # - "3-Hour Rainfall Accumulation"
        # - "Satellite Water Extent Expansion"
        # - "Critical Infrastructure Vulnerability"
        c1 = 0.50 * ((0.35 * norm["water_level_norm"]) + (0.25 * norm["rise_rate_norm"]))
        c2 = 0.50 * (0.25 * norm["rainfall_3h_norm"])
        c3 = 0.50 * (0.15 * norm["satellite_ndwi_delta"])
        c4 = (0.25 * E) + (0.25 * V)

        total_contrib = c1 + c2 + c3 + c4
        if total_contrib > 0:
            p1 = (c1 / total_contrib) * 100.0
            p2 = (c2 / total_contrib) * 100.0
            p3 = (c3 / total_contrib) * 100.0
            p4 = (c4 / total_contrib) * 100.0
        else:
            p1, p2, p3, p4 = 35.0, 25.0, 15.0, 25.0

        p1_r = round(p1, 1)
        p2_r = round(p2, 1)
        p3_r = round(p3, 1)
        p4_r = round(100.0 - (p1_r + p2_r + p3_r), 1)

        shap_breakdown = {
            "Ground Water Level & Rise Rate": p1_r,
            "3-Hour Rainfall Accumulation": p2_r,
            "Satellite Water Extent Expansion": p3_r,
            "Critical Infrastructure Vulnerability": p4_r
        }

        # Determine Operational Risk Level
        if risk_score >= 80.0 or (water_level_cm >= 18.0) or (rise_rate_cm_min >= 1.0):
            risk_level = "CRITICAL"
        elif risk_score >= 45.0 or (water_level_cm >= 12.0) or (rise_rate_cm_min >= 0.5):
            risk_level = "MODERATE"
        else:
            risk_level = "SAFE"

        return {
            "hazard_score": round(H * 100.0, 1),
            "exposure_score": round(E * 100.0, 1),
            "vulnerability_score": round(V * 100.0, 1),
            "risk_score": risk_score,
            "priority_score": priority_score,
            "risk_level": risk_level,
            "is_critical": (risk_level == "CRITICAL"),
            "shap_breakdown": shap_breakdown,
            "normalized_components": norm
        }

    def compute_wildfire_scores(
        self,
        surface_temp_c: float = 38.5,
        thermal_anomaly: float = 0.65,
        humidity_pct: float = 28.0,
        wind_speed_kmh: float = 24.0,
        dry_fuel_index: float = 0.75,
        population_impact: int = 30000,
        criticality: float = 0.82
    ) -> Dict[str, Any]:
        """
        Computes Wildfire multi-hazard decision intelligence scores:
        Fuses surface temperature, thermal anomaly, relative humidity, wind speed,
        and vegetative dry fuel index.
        """
        # 1. Normalization
        norm_temp = min(1.0, max(0.0, (surface_temp_c - 24.0) / 22.0))
        norm_thermal = min(1.0, max(0.0, thermal_anomaly))
        norm_humidity = min(1.0, max(0.0, (65.0 - humidity_pct) / 45.0))
        norm_wind = min(1.0, max(0.0, wind_speed_kmh / 38.0))
        norm_fuel = min(1.0, max(0.0, dry_fuel_index))
        norm_pop = min(1.0, max(0.0, population_impact / 45000.0))
        crit_score = min(1.0, max(0.0, criticality))

        # 2. Hazard (H)
        H = (
            (0.32 * norm_temp) +
            (0.28 * norm_thermal) +
            (0.18 * norm_humidity) +
            (0.14 * norm_wind) +
            (0.08 * norm_fuel)
        )
        H = min(1.0, max(0.0, H))

        # 3. Exposure (E)
        E = (0.65 * norm_pop) + (0.35 * crit_score)
        E = min(1.0, max(0.0, E))

        # 4. Vulnerability (V)
        V = (0.75 * crit_score) + (0.25 * norm_fuel)
        V = min(1.0, max(0.0, V))

        # 5. Risk & Priority
        risk_score = round(min(99.0, max(8.0, (0.55 * H + 0.25 * E + 0.20 * V) * 100.0)), 1)
        human_consequence = (0.55 * E) + (0.45 * V)
        priority_score = round(min(99.0, max(10.0, (0.45 * H + 0.55 * human_consequence) * 100.0)), 1)

        # 6. SHAP Breakdown
        c1 = 0.55 * ((0.32 * norm_temp) + (0.28 * norm_thermal))
        c2 = 0.55 * ((0.18 * norm_humidity) + (0.14 * norm_wind))
        c3 = 0.55 * (0.08 * norm_fuel)
        c4 = (0.25 * E) + (0.20 * V)
        total_c = max(1e-4, c1 + c2 + c3 + c4)

        shap_breakdown = {
            "Surface Temperature & Thermal Anomaly": round((c1 / total_c) * 100.0, 1),
            "Low Relative Humidity & Wind Speed": round((c2 / total_c) * 100.0, 1),
            "Vegetative Dry Fuel Index": round((c3 / total_c) * 100.0, 1),
            "Forest Reserve Criticality & Exposure": round((c4 / total_c) * 100.0, 1)
        }

        # Level
        if risk_score >= 78.0 or surface_temp_c >= 42.0 or thermal_anomaly >= 0.80:
            risk_level = "CRITICAL"
        elif risk_score >= 45.0 or surface_temp_c >= 35.0:
            risk_level = "MODERATE"
        else:
            risk_level = "SAFE"

        return {
            "hazard_score": round(H * 100.0, 1),
            "exposure_score": round(E * 100.0, 1),
            "vulnerability_score": round(V * 100.0, 1),
            "risk_score": risk_score,
            "priority_score": priority_score,
            "risk_level": risk_level,
            "is_critical": (risk_level == "CRITICAL"),
            "shap_breakdown": shap_breakdown,
            "surface_temp_c": round(surface_temp_c, 1),
            "thermal_anomaly": round(thermal_anomaly, 2),
            "humidity_pct": round(humidity_pct, 1),
            "wind_speed_kmh": round(wind_speed_kmh, 1)
        }

    def compute_structural_scores(
        self,
        tilt_deg: float = 1.2,
        vibration_g: float = 0.35,
        flood_scour_risk: float = 45.0,
        population_impact: int = 15000,
        criticality: float = 0.85
    ) -> Dict[str, Any]:
        """
        Computes Structural multi-hazard decision intelligence scores:
        Fuses MPU6050 pier tilt, vibration RMS, and hydrodynamic scour velocity.
        """
        norm_tilt = min(1.0, max(0.0, tilt_deg / 3.5))
        norm_vib = min(1.0, max(0.0, vibration_g / 1.2))
        norm_scour = min(1.0, max(0.0, flood_scour_risk / 100.0))
        norm_pop = min(1.0, max(0.0, population_impact / 35000.0))
        crit_score = min(1.0, max(0.0, criticality))

        H = (0.42 * norm_tilt) + (0.35 * norm_vib) + (0.23 * norm_scour)
        H = min(1.0, max(0.0, H))

        E = (0.60 * norm_pop) + (0.40 * crit_score)
        V = crit_score

        risk_score = round(min(99.0, max(5.0, (0.50 * H + 0.25 * E + 0.25 * V) * 100.0)), 1)
        priority_score = round(min(99.0, max(5.0, (0.40 * H + 0.60 * ((0.55 * E) + (0.45 * V))) * 100.0)), 1)

        c1 = 0.50 * ((0.42 * norm_tilt) + (0.35 * norm_vib))
        c2 = 0.50 * (0.23 * norm_scour)
        c3 = 0.25 * E
        c4 = 0.25 * V
        total_c = max(1e-4, c1 + c2 + c3 + c4)

        shap_breakdown = {
            "Bridge Pier Tilt & Vibration (MPU6050)": round((c1 / total_c) * 100.0, 1),
            "Hydrodynamic Scour & Water Velocity": round((c2 / total_c) * 100.0, 1),
            "Daily Traffic & Commuter Impact": round((c3 / total_c) * 100.0, 1),
            "Asset Structural Criticality": round((c4 / total_c) * 100.0, 1)
        }

        if risk_score >= 75.0 or tilt_deg >= 2.5 or vibration_g >= 0.8:
            risk_level = "CRITICAL"
        elif risk_score >= 45.0 or tilt_deg >= 1.0:
            risk_level = "MODERATE"
        else:
            risk_level = "SAFE"

        return {
            "hazard_score": round(H * 100.0, 1),
            "exposure_score": round(E * 100.0, 1),
            "vulnerability_score": round(V * 100.0, 1),
            "risk_score": risk_score,
            "priority_score": priority_score,
            "risk_level": risk_level,
            "is_critical": (risk_level == "CRITICAL"),
            "shap_breakdown": shap_breakdown,
            "tilt_deg": round(tilt_deg, 2),
            "vibration_g": round(vibration_g, 2),
            "scour_risk": round(flood_scour_risk, 1)
        }


# Global singleton instance
decision_engine = MultiHazardDecisionEngine()

