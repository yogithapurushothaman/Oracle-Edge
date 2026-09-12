"""
ORACLE Edge - ML Inference & "Why This Risk?" Explainability Engine
Loads pre-trained XGBoost / RF models and produces risk scores, priority rankings,
and SHAP-style contributing factor breakdowns per PRD Section 8.1, 8.3 & 14.
"""

import os
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from ml.dataset import FEATURE_COLUMNS

class RiskInferenceEngine:
    def __init__(self, model_path: str = "ml/models/oracle_models.pkl"):
        self.model_path = model_path
        self.classifier = None
        self.regressor = None
        self.feature_columns = FEATURE_COLUMNS
        self.feature_importances = {}
        self.load_models()

    def load_models(self):
        if os.path.exists(self.model_path):
            with open(self.model_path, "rb") as f:
                artifacts = pickle.load(f)
                self.classifier = artifacts.get("classifier")
                self.regressor = artifacts.get("regressor")
                self.feature_columns = artifacts.get("feature_columns", FEATURE_COLUMNS)
                self.feature_importances = artifacts.get("feature_importances", {})
        else:
            print(f"[WARN] Model file {self.model_path} not found. Using algorithmic scoring fallback.")

    def predict(self, feature_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Takes raw features, runs ML inference or algorithmic fallback, and computes
        Hazard, Exposure, Vulnerability, Risk Score (0-100), Priority Score (0-100),
        and "Why this risk?" contributing factor weights.
        """
        # 1. Sanitize features
        vector = []
        for col in self.feature_columns:
            val = float(feature_dict.get(col, 0.0))
            vector.append(val)
        
        X = pd.DataFrame([vector], columns=self.feature_columns)

        # 2. Base Component Scores (PRD Section 8.1)
        water_level = float(feature_dict.get("water_level", 20.0))
        water_rise_rate = float(feature_dict.get("water_rise_rate", 0.0))
        rainfall_1h = float(feature_dict.get("rainfall_1h", 0.0))
        rainfall_24h = float(feature_dict.get("rainfall_24h", 0.0))
        satellite_water = float(feature_dict.get("satellite_water_area", 0.0))
        distance_to_water = float(feature_dict.get("distance_to_water", 100.0))
        elevation = float(feature_dict.get("elevation", 15.0))
        slope = float(feature_dict.get("slope", 3.0))
        population = float(feature_dict.get("population_impact", 1000.0))
        criticality = float(feature_dict.get("asset_criticality", 0.5))
        historical = float(feature_dict.get("historical_incidents", 1.0))

        # Hazard calculation (H)
        norm_wl = min(water_level / 85.0, 1.4)
        norm_rr = max(min((water_rise_rate + 0.5) / 3.5, 1.5), 0.0)
        norm_rain = min(rainfall_1h / 45.0, 1.4) * 0.6 + min(rainfall_24h / 180.0, 1.4) * 0.4
        norm_sat = min(satellite_water / 70.0, 1.3)
        norm_terrain = min(max(1.0 - (distance_to_water / 300.0), 0.0) * 0.6 + max(1.0 - (elevation / 30.0), 0.0) * 0.4, 1.0)
        
        hazard_score = round(min(max(
            (0.32 * norm_wl + 0.20 * norm_rr + 0.20 * norm_rain + 0.16 * norm_sat + 0.12 * norm_terrain) * 100.0,
            0.0
        ), 100.0), 1)

        # Exposure calculation (E)
        norm_pop = min(np.log10(population + 1) / np.log10(70000), 1.0)
        exposure_score = round(min(max((0.65 * norm_pop + 0.35 * criticality) * 100.0, 0.0), 100.0), 1)

        # Vulnerability calculation (V)
        norm_hist = min(historical / 6.0, 1.0)
        norm_slope = max(1.0 - (slope / 15.0), 0.0)
        vulnerability_score = round(min(max((0.50 * criticality + 0.30 * norm_hist + 0.20 * norm_slope) * 100.0, 0.0), 100.0), 1)

        # 3. Model Inference for Risk & Priority
        if self.regressor is not None:
            raw_risk = float(self.regressor.predict(X)[0])
            risk_score = round(min(max(raw_risk, 0.0), 100.0), 1)
        else:
            risk_score = round(0.55 * hazard_score + 0.25 * exposure_score + 0.20 * vulnerability_score, 1)

        # Priority Score (PRD Section 8.2: consequence of failure matters!)
        priority_score = round(min(max(0.40 * hazard_score + 0.38 * exposure_score + 0.22 * vulnerability_score, 0.0), 100.0), 1)

        # Risk Level Category (PRD Section 9.1)
        if risk_score <= 30.0:
            risk_level = "LOW"
            risk_badge = "🟢 Low"
        elif risk_score <= 60.0:
            risk_level = "MODERATE"
            risk_badge = "🟡 Moderate"
        elif risk_score <= 80.0:
            risk_level = "HIGH"
            risk_badge = "🟠 High"
        else:
            risk_level = "CRITICAL"
            risk_badge = "🔴 Critical"

        # 4. "Why This Risk?" - SHAP-style Explainability Decomposition (PRD Section 8.3)
        # Factor contributions to the final risk score
        factors = [
            {
                "category": "Hazard",
                "factor": "Water Level & Submergence",
                "value": f"{water_level:.1f} cm",
                "impact_pct": round(norm_wl * 32.0, 1),
                "severity": "CRITICAL" if water_level > 70 else ("HIGH" if water_level > 50 else "NORMAL")
            },
            {
                "category": "Hazard",
                "factor": "Water Rise Rate",
                "value": f"{water_rise_rate:+.1f} cm/min",
                "impact_pct": round(norm_rr * 20.0, 1),
                "severity": "CRITICAL" if water_rise_rate > 2.0 else ("HIGH" if water_rise_rate > 1.0 else "NORMAL")
            },
            {
                "category": "Hazard",
                "factor": "Rainfall Intensity (1h / 24h)",
                "value": f"{rainfall_1h:.1f} mm/h | {rainfall_24h:.1f} mm/24h",
                "impact_pct": round(norm_rain * 20.0, 1),
                "severity": "CRITICAL" if rainfall_1h > 40 else ("HIGH" if rainfall_1h > 20 else "NORMAL")
            },
            {
                "category": "Hazard",
                "factor": "Sentinel-2 NDWI Flood Extent",
                "value": f"{satellite_water:.1f}% expansion",
                "impact_pct": round(norm_sat * 16.0, 1),
                "severity": "HIGH" if satellite_water > 40 else "NORMAL"
            },
            {
                "category": "Exposure",
                "factor": "Population & Critical Facilities",
                "value": f"{int(population):,} citizens exposed",
                "impact_pct": round(norm_pop * 22.0, 1),
                "severity": "HIGH" if population > 10000 else "NORMAL"
            },
            {
                "category": "Vulnerability",
                "factor": "Asset Structural Criticality",
                "value": f"Criticality index {criticality:.2f}",
                "impact_pct": round(criticality * 18.0, 1),
                "severity": "CRITICAL" if criticality >= 0.9 else ("HIGH" if criticality >= 0.7 else "NORMAL")
            },
            {
                "category": "Vulnerability",
                "factor": "Historical Flood Incidents",
                "value": f"{int(historical)} past events recorded",
                "impact_pct": round(norm_hist * 10.0, 1),
                "severity": "HIGH" if historical >= 3 else "NORMAL"
            }
        ]

        return {
            "risk_score": risk_score,
            "priority_score": priority_score,
            "risk_level": risk_level,
            "risk_badge": risk_badge,
            "hazard_score": hazard_score,
            "exposure_score": exposure_score,
            "vulnerability_score": vulnerability_score,
            "model_version": "XGBoost-v1.0-Hybrid",
            "why_this_risk": factors
        }

# Global singleton
inference_engine = RiskInferenceEngine()
