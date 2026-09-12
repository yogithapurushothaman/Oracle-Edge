"""
ORACLE Edge - Dataset Generation & Feature Engineering
Implements the hybrid data strategy defined in PRD Section 7.2 & 7.4.
Fuses physical sensor features, rainfall windows, satellite water index,
and infrastructure GIS criticality into training samples.
"""

import numpy as np
import pandas as pd
from typing import Tuple

FEATURE_COLUMNS = [
    "water_level",          # cm
    "water_rise_rate",      # cm/min
    "rainfall_1h",          # mm
    "rainfall_3h",          # mm
    "rainfall_24h",         # mm
    "forecast_rainfall",    # mm (next 24h)
    "distance_to_water",    # meters
    "elevation",            # meters
    "slope",                # degrees
    "satellite_water_area", # delta water extent %
    "population_impact",    # scaled 0-100 or person count
    "asset_criticality",    # 0.0 - 1.0
    "historical_incidents"  # count
]

def generate_synthetic_dataset(n_samples: int = 3000, random_seed: int = 42) -> pd.DataFrame:
    """
    Generates a calibrated synthetic dataset reflecting municipal flood scenarios
    based on PRD Section 7.4 rules and physical dynamics.
    """
    np.random.seed(random_seed)

    # 1. Physical sensor readings
    water_level = np.random.uniform(5.0, 110.0, n_samples)
    water_rise_rate = np.random.uniform(-0.5, 4.5, n_samples)
    
    # Rising rate is often correlated with water level during severe events
    water_rise_rate = np.where(water_level > 60.0, water_rise_rate + np.random.uniform(0.5, 2.5, n_samples), water_rise_rate)
    water_rise_rate = np.clip(water_rise_rate, -1.0, 6.0)

    # 2. Weather & derived rainfall windows
    rainfall_1h = np.random.exponential(scale=12.0, size=n_samples)
    rainfall_1h = np.clip(rainfall_1h, 0.0, 80.0)
    
    rainfall_3h = rainfall_1h * np.random.uniform(1.5, 2.8, n_samples) + np.random.uniform(0, 15, n_samples)
    rainfall_3h = np.clip(rainfall_3h, rainfall_1h, 160.0)

    rainfall_24h = rainfall_3h * np.random.uniform(1.8, 4.0, n_samples) + np.random.uniform(5, 40, n_samples)
    rainfall_24h = np.clip(rainfall_24h, rainfall_3h, 350.0)

    forecast_rainfall = np.random.uniform(0.0, 150.0, n_samples)

    # 3. Terrain & GIS context
    distance_to_water = np.random.exponential(scale=150.0, size=n_samples) + 5.0
    distance_to_water = np.clip(distance_to_water, 5.0, 1200.0)

    elevation = np.random.uniform(1.5, 45.0, n_samples) # Coastal / plain delta like Chennai
    slope = np.random.uniform(0.2, 18.0, n_samples)

    # 4. Satellite water extent (NDWI derived % flooded or expansion)
    satellite_water_area = np.clip(
        (rainfall_24h / 350.0) * 80.0 + (water_level / 110.0) * 30.0 + np.random.normal(0, 8, n_samples),
        0.0, 100.0
    )

    # 5. Infrastructure Criticality & Population
    asset_criticality = np.random.choice([0.35, 0.55, 0.75, 0.90, 0.98], size=n_samples, p=[0.25, 0.25, 0.25, 0.15, 0.10])
    population_impact = np.random.choice([500, 2500, 8000, 25000, 60000], size=n_samples, p=[0.3, 0.3, 0.2, 0.15, 0.05])
    historical_incidents = np.random.poisson(lam=1.8, size=n_samples)
    historical_incidents = np.clip(historical_incidents, 0, 10)

    # PRD Section 8:
    # Hazard (H) = rainfall + water_level + water_rise_rate + satellite_water_change + terrain
    # Exposure (E) = population + roads + buildings + critical_facilities
    # Vulnerability (V) = asset_criticality + historical_failure + terrain

    # Compute Hazard Component (0-100)
    norm_wl = np.clip(water_level / 85.0, 0, 1.3)
    norm_rr = np.clip((water_rise_rate + 0.5) / 3.5, 0, 1.5)
    norm_rain1h = np.clip(rainfall_1h / 45.0, 0, 1.4)
    norm_rain24h = np.clip(rainfall_24h / 180.0, 0, 1.3)
    norm_sat = np.clip(satellite_water_area / 70.0, 0, 1.2)
    norm_dist = np.clip(1.0 - (distance_to_water / 400.0), 0, 1.0)
    norm_elev = np.clip(1.0 - (elevation / 30.0), 0, 1.0)

    hazard = (
        0.30 * norm_wl +
        0.18 * norm_rr +
        0.18 * norm_rain1h +
        0.12 * norm_rain24h +
        0.12 * norm_sat +
        0.10 * (0.6 * norm_dist + 0.4 * norm_elev)
    ) * 100.0
    hazard = np.clip(hazard + np.random.normal(0, 2.5, n_samples), 0.0, 100.0)

    # Compute Exposure Component (0-100)
    norm_pop = np.clip(np.log10(population_impact + 1) / np.log10(70000), 0, 1.0)
    exposure = (0.65 * norm_pop + 0.35 * asset_criticality) * 100.0
    exposure = np.clip(exposure + np.random.normal(0, 1.5, n_samples), 0.0, 100.0)

    # Compute Vulnerability Component (0-100)
    norm_hist = np.clip(historical_incidents / 6.0, 0, 1.0)
    norm_slope = np.clip(1.0 - (slope / 15.0), 0, 1.0) # flatter areas accumulate water
    vulnerability = (0.50 * asset_criticality + 0.30 * norm_hist + 0.20 * norm_slope) * 100.0
    vulnerability = np.clip(vulnerability + np.random.normal(0, 1.5, n_samples), 0.0, 100.0)

    # Risk Score = f(H, E, V)
    # PRD Section 8.1: Risk is driven heavily by Hazard with Exposure & Vulnerability amplifications
    risk_raw = 0.55 * hazard + 0.25 * exposure + 0.20 * vulnerability
    risk_score = np.clip(risk_raw, 0.0, 100.0)

    # Priority Score: PRD Section 8.2:
    # "The highest-hazard location is not automatically priority #1 — consequence of failure matters."
    # Location with hospital dependency or massive population takes higher precedence
    priority_raw = 0.40 * hazard + 0.38 * exposure + 0.22 * vulnerability
    priority_score = np.clip(priority_raw, 0.0, 100.0)

    # Categorical classification (0: Low 0-30, 1: Moderate 31-60, 2: High 61-80, 3: Critical 81-100)
    def categorize(score):
        if score <= 30.0:
            return 0 # Low
        elif score <= 60.0:
            return 1 # Moderate
        elif score <= 80.0:
            return 2 # High
        else:
            return 3 # Critical

    risk_category = [categorize(s) for s in risk_score]

    df = pd.DataFrame({
        "water_level": np.round(water_level, 2),
        "water_rise_rate": np.round(water_rise_rate, 2),
        "rainfall_1h": np.round(rainfall_1h, 2),
        "rainfall_3h": np.round(rainfall_3h, 2),
        "rainfall_24h": np.round(rainfall_24h, 2),
        "forecast_rainfall": np.round(forecast_rainfall, 2),
        "distance_to_water": np.round(distance_to_water, 1),
        "elevation": np.round(elevation, 1),
        "slope": np.round(slope, 1),
        "satellite_water_area": np.round(satellite_water_area, 2),
        "population_impact": population_impact,
        "asset_criticality": np.round(asset_criticality, 2),
        "historical_incidents": historical_incidents,
        "hazard_score": np.round(hazard, 1),
        "exposure_score": np.round(exposure, 1),
        "vulnerability_score": np.round(vulnerability, 1),
        "risk_score": np.round(risk_score, 1),
        "priority_score": np.round(priority_score, 1),
        "risk_category": risk_category
    })

    return df

def get_expert_benchmark_scenarios() -> pd.DataFrame:
    """
    Expert-defined scenarios from PRD Section 7.4 & 22 for Priority Agreement validation.
    """
    scenarios = [
        {
            "scenario_name": "Demo Step 1: Normal Water (20cm)",
            "water_level": 20.0, "water_rise_rate": 0.0, "rainfall_1h": 2.0, "rainfall_3h": 5.0,
            "rainfall_24h": 10.0, "forecast_rainfall": 5.0, "distance_to_water": 50.0,
            "elevation": 12.0, "slope": 3.0, "satellite_water_area": 5.0,
            "population_impact": 12000, "asset_criticality": 0.95, "historical_incidents": 2,
            "expected_risk_category": 0, "expected_risk_range": (15, 30), "expert_rank": 4
        },
        {
            "scenario_name": "Demo Step 2: Rising Water (40cm)",
            "water_level": 40.0, "water_rise_rate": 0.8, "rainfall_1h": 15.0, "rainfall_3h": 32.0,
            "rainfall_24h": 55.0, "forecast_rainfall": 25.0, "distance_to_water": 45.0,
            "elevation": 12.0, "slope": 3.0, "satellite_water_area": 18.0,
            "population_impact": 12000, "asset_criticality": 0.95, "historical_incidents": 2,
            "expected_risk_category": 1, "expected_risk_range": (35, 55), "expert_rank": 3
        },
        {
            "scenario_name": "Demo Step 3: Rapid Rise (65cm)",
            "water_level": 65.0, "water_rise_rate": 2.2, "rainfall_1h": 35.0, "rainfall_3h": 70.0,
            "rainfall_24h": 120.0, "forecast_rainfall": 45.0, "distance_to_water": 30.0,
            "elevation": 12.0, "slope": 3.0, "satellite_water_area": 42.0,
            "population_impact": 12000, "asset_criticality": 0.95, "historical_incidents": 2,
            "expected_risk_category": 2, "expected_risk_range": (65, 80), "expert_rank": 2
        },
        {
            "scenario_name": "Demo Step 4: Critical Bridge B17 (75cm, heavy rain, high criticality)",
            "water_level": 75.0, "water_rise_rate": 2.8, "rainfall_1h": 50.0, "rainfall_3h": 105.0,
            "rainfall_24h": 190.0, "forecast_rainfall": 70.0, "distance_to_water": 15.0,
            "elevation": 12.0, "slope": 3.0, "satellite_water_area": 68.0,
            "population_impact": 12000, "asset_criticality": 0.95, "historical_incidents": 2,
            "expected_risk_category": 3, "expected_risk_range": (85, 98), "expert_rank": 1
        }
    ]
    return pd.DataFrame(scenarios)
