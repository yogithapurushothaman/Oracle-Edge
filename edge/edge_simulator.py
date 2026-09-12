"""
ORACLE Edge - IoT Edge Node Telemetry Simulator
Simulates the ESP32 edge sensor node transmitting telemetry to FastAPI backend
per PRD Section 10 & Section 22 Demonstration Scenarios.
"""

import sys
import time
import argparse
from datetime import datetime
import urllib.request
import json

API_URL = "http://localhost:8000/api/v1/sensors/readings"

SCENARIOS = {
    1: {
        "name": "Step 1: Normal Water Baseline",
        "device_id": "ORACLE-001",
        "water_level_cm": 20.0,
        "water_rise_rate_cm_min": 0.1,
        "rain_detected": False,
        "rainfall_1h_mm": 0.0,
        "rainfall_3h_mm": 1.5,
        "rainfall_24h_mm": 5.0,
        "battery_voltage": 4.15,
        "expected_risk": "LOW (~22)"
    },
    2: {
        "name": "Step 2: Rising Water",
        "device_id": "ORACLE-001",
        "water_level_cm": 40.0,
        "water_rise_rate_cm_min": 0.8,
        "rain_detected": True,
        "rainfall_1h_mm": 15.0,
        "rainfall_3h_mm": 32.0,
        "rainfall_24h_mm": 55.0,
        "battery_voltage": 4.10,
        "expected_risk": "MODERATE (~48)"
    },
    3: {
        "name": "Step 3: Rapid Water Rise",
        "device_id": "ORACLE-001",
        "water_level_cm": 65.0,
        "water_rise_rate_cm_min": 2.2,
        "rain_detected": True,
        "rainfall_1h_mm": 35.0,
        "rainfall_3h_mm": 70.0,
        "rainfall_24h_mm": 120.0,
        "battery_voltage": 4.05,
        "expected_risk": "HIGH (~76)"
    },
    4: {
        "name": "Step 4: Critical Bridge B17 Emergency",
        "device_id": "ORACLE-001",
        "water_level_cm": 75.0,
        "water_rise_rate_cm_min": 2.8,
        "rain_detected": True,
        "rainfall_1h_mm": 50.0,
        "rainfall_3h_mm": 105.0,
        "rainfall_24h_mm": 190.0,
        "battery_voltage": 3.98,
        "expected_risk": "CRITICAL (~92, BUZZER/LED TRIGGER)"
    }
}

def send_telemetry(payload: dict, target_url: str = API_URL):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        target_url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except Exception as e:
        return {"error": str(e)}

def run_step(step_number: int, target_url: str = API_URL):
    if step_number not in SCENARIOS:
        print(f"Invalid step: {step_number}. Choose 1, 2, 3, or 4.")
        return

    sc = SCENARIOS[step_number]
    payload = {
        "device_id": sc["device_id"],
        "timestamp": datetime.utcnow().isoformat(),
        "water_level_cm": sc["water_level_cm"],
        "water_rise_rate_cm_min": sc["water_rise_rate_cm_min"],
        "rain_detected": sc["rain_detected"],
        "rainfall_1h_mm": sc["rainfall_1h_mm"],
        "rainfall_3h_mm": sc["rainfall_3h_mm"],
        "rainfall_24h_mm": sc["rainfall_24h_mm"],
        "battery_voltage": sc["battery_voltage"]
    }

    print("\n" + "=" * 65)
    print(f" [TRANSMITTING] PRD Demonstration {sc['name']}")
    print(f" Target Endpoint: {target_url}")
    print(f" Sensor Data: Water={sc['water_level_cm']}cm, Rise={sc['water_rise_rate_cm_min']}cm/min, Rain={sc['rain_detected']}")
    print(f" Expected Status: {sc['expected_risk']}")
    print("=" * 65)

    response = send_telemetry(payload, target_url)
    if "error" in response:
        print(f"❌ Transmission failed: {response['error']}")
        print("   (Ensure backend is running: uvicorn backend.main:app --port 8000)")
    else:
        print("✅ Response Received:")
        print(f"   Asset: {response.get('asset_id')}")
        print(f"   Assessed Risk Score: {response.get('risk_score')}/100 ({response.get('risk_level')})")
        print(f"   Priority Score: {response.get('priority_score')}/100")
        print(f"   Recommended Action: {response.get('recommended_action')}")
        print(f"   Physical Alert Loop (Buzzer/LED): {'🔴 ACTIVATED!' if response.get('physical_alert_triggered') else '🟢 Normal'}")
        if "factors" in response:
            print("   Top Contributing Factors:")
            for f in response["factors"]:
                print(f"     - {f.get('factor')}: {f.get('value')} (Impact: {f.get('impact_pct')}%)")

def run_continuous_demo(interval: int = 4, target_url: str = API_URL):
    print("================================================================")
    print(" ORACLE Edge - Continuous PRD Demonstration Sequence")
    print(" Demonstrating physical-to-digital decision loop escalation")
    print("================================================================")
    for step in [1, 2, 3, 4]:
        run_step(step, target_url)
        if step < 4:
            print(f"\nWaiting {interval} seconds before next scenario escalation...")
            time.sleep(interval)
    print("\n[SUCCESS] End-to-end PRD demonstration sequence completed.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ORACLE Edge Telemetry Simulator")
    parser.add_argument("--step", type=int, choices=[1, 2, 3, 4], help="Run specific PRD demonstration step")
    parser.add_argument("--url", type=str, default=API_URL, help="FastAPI backend URL")
    parser.add_argument("--demo", action="store_true", help="Run full 4-step demonstration cycle")
    args = parser.parse_args()

    if args.step:
        run_step(args.step, args.url)
    elif args.demo:
        run_continuous_demo(target_url=args.url)
    else:
        # Default run step 4 or show help
        print("Usage examples:")
        print("  python edge/edge_simulator.py --step 1    # Normal 20cm")
        print("  python edge/edge_simulator.py --step 4    # Critical Bridge B17 75cm")
        print("  python edge/edge_simulator.py --demo      # Run full 4-step sequence")
        run_step(1, args.url)
