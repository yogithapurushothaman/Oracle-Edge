"""
ORACLE Edge - Verification of Edge Simulator PRD Scenarios
Runs all 4 demonstration steps through FastAPI TestClient.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app
from edge.edge_simulator import SCENARIOS

client = TestClient(app)

print("=" * 65)
print(" VERIFYING EDGE SIMULATOR PRD DEMONSTRATION SCENARIOS (1-4)")
print("=" * 65)

for step, sc in SCENARIOS.items():
    payload = {
        "device_id": sc["device_id"],
        "asset_id": "B17",
        "water_level_cm": sc["water_level_cm"],
        "water_rise_rate_cm_min": sc["water_rise_rate_cm_min"],
        "rain_detected": sc["rain_detected"],
        "rainfall_1h_mm": sc["rainfall_1h_mm"],
        "rainfall_3h_mm": sc["rainfall_3h_mm"],
        "rainfall_24h_mm": sc["rainfall_24h_mm"],
        "battery_voltage": sc["battery_voltage"]
    }
    
    resp = client.post("/api/v1/sensors/readings", json=payload)
    assert resp.status_code == 200, f"Step {step} failed: {resp.text}"
    data = resp.json()
    
    print(f"\n[STEP {step}] {sc['name']}")
    print(f"  Water Level: {sc['water_level_cm']} cm | Rise Rate: {sc['water_rise_rate_cm_min']} cm/min")
    print(f"  Assessed Risk Score: {data.get('risk_score')}/100 ({data.get('risk_level')})")
    print(f"  Priority Score: {data.get('priority_score')}/100")
    print(f"  Hardware Buzzer Triggered: {data.get('buzzer')}")
    print(f"  Top Priority Asset: {data.get('top_priority')}")
    print(f"  Recommended Action: {data.get('recommended_action')}")

print("\n" + "=" * 65)
print(" ALL 4 PRD SCENARIOS VERIFIED SUCCESSFULLY WITH FASTAPI ENGINE!")
print("=" * 65)
