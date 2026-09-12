"""
ORACLE Edge - ESP32 Tabletop Hardware Mock Simulator & Test Suite
Step 1: Core Ingestion & Actuator Feedback Verification

Simulates ESP32 tabletop node transmitting multi-asset telemetry and
verifies immediate actuator commands (Buzzer & LEDs) and database persistence.
"""

import sys
import os
import json
import argparse

# Ensure backend module is importable
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app
from backend.models import SessionLocal, TelemetryReading, Asset

# Color helpers for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def print_header(title: str):
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} {title}{RESET}")
    print(f"{CYAN}{'='*65}{RESET}")


def display_actuators(response_json: dict):
    top = response_json.get("top_priority", "NONE")
    buzzer = response_json.get("buzzer", False)
    actuators = response_json.get("actuators", {})

    buzzer_str = f"{RED}ALARM ON [2.4kHz]{RESET}" if buzzer else f"{GREEN}SILENT{RESET}"
    print(f"  [TOP PRIORITY ASSET]: {BOLD}{top}{RESET}")
    print(f"  [HARDWARE BUZZER]  : {buzzer_str}")
    print("  [HARDWARE LEDS]    :")
    for asset_id, state in actuators.items():
        status = state.get("status")
        led_safe = state.get("led_safe")
        led_crit = state.get("led_critical")
        status_color = RED if status == "CRITICAL" else GREEN
        safe_led_str = f"{GREEN}[GREEN ON]{RESET}" if led_safe else "[OFF]"
        crit_led_str = f"{RED}[RED ON]{RESET}" if led_crit else "[OFF]"
        print(f"    - {asset_id}: Status: {status_color}{status:<8}{RESET} | Safe LED: {safe_led_str} | Crit LED: {crit_led_str}")


def run_tests(base_url: str = None):
    use_live = bool(base_url)
    if use_live:
        import requests
        print(f"{BOLD}Running mock ESP32 tests against LIVE backend at {base_url}{RESET}")
        def post_telemetry(payload):
            resp = requests.post(f"{base_url}/api/v1/sensors/telemetry", json=payload)
            return resp.status_code, resp.json()
    else:
        print(f"{BOLD}Running mock ESP32 tests via FastAPI TestClient (Local Engine){RESET}")
        client = TestClient(app)
        def post_telemetry(payload):
            resp = client.post("/api/v1/sensors/telemetry", json=payload)
            return resp.status_code, resp.json()

    # Verify seeded assets in DB
    db = SessionLocal()
    h01 = db.query(Asset).filter(Asset.asset_id == "H01").first()
    b17 = db.query(Asset).filter(Asset.asset_id == "B17").first()
    db.close()

    print_header("VERIFYING SEEDED DATABASE ASSETS")
    assert h01 is not None, "H01 must be seeded in SQLite"
    assert b17 is not None, "B17 must be seeded in SQLite"
    print(f"  {GREEN}[OK]{RESET} H01: {h01.name} (Criticality: {h01.criticality}, Pop: {h01.population_served})")
    print(f"  {GREEN}[OK]{RESET} B17: {b17.name} (Criticality: {b17.criticality}, Pop: {b17.population_served})")

    # ==========================================
    # TEST 1: ALL SAFE (Normal Baseline Conditions)
    # ==========================================
    print_header("TEST 1: Baseline Normal Operation (Both Assets Safe)")
    payload_safe = {
        "device_id": "ORACLE-ESP32-01",
        "readings": [
            {
                "sensor_id": "SNS-H01",
                "asset_id": "H01",
                "water_level_cm": 8.5,
                "rise_rate_cm_min": 0.1
            },
            {
                "sensor_id": "SNS-B17",
                "asset_id": "B17",
                "water_level_cm": 6.2,
                "rise_rate_cm_min": 0.05
            }
        ]
    }
    print("ESP32 Transmitting:", json.dumps(payload_safe, indent=2))
    status_code, data = post_telemetry(payload_safe)
    print("\nAPI Response Code:", status_code)
    display_actuators(data)

    assert status_code == 200, f"Expected 200, got {status_code}"
    assert data["status"] == "success"
    assert data["buzzer"] is False, "Buzzer should be OFF when all assets are safe"
    assert data["actuators"]["H01"]["status"] == "SAFE"
    assert data["actuators"]["H01"]["led_safe"] is True
    assert data["actuators"]["H01"]["led_critical"] is False
    assert data["actuators"]["B17"]["status"] == "SAFE"
    assert data["actuators"]["B17"]["led_safe"] is True
    assert data["actuators"]["B17"]["led_critical"] is False
    print(f"{GREEN}[PASS] TEST 1: Baseline safe conditions validated.{RESET}")

    # ==========================================
    # TEST 2: H01 CRITICAL (Water Level >= 18.0 cm)
    # ==========================================
    print_header("TEST 2: Metro Hospital Flood Surge (water_level_cm >= 18.0)")
    payload_h01_crit = {
        "device_id": "ORACLE-ESP32-01",
        "readings": [
            {
                "sensor_id": "SNS-H01",
                "asset_id": "H01",
                "water_level_cm": 19.5,  # Exceeds 18.0 threshold -> CRITICAL
                "rise_rate_cm_min": 0.4
            },
            {
                "sensor_id": "SNS-B17",
                "asset_id": "B17",
                "water_level_cm": 11.0,
                "rise_rate_cm_min": 0.2
            }
        ]
    }
    print("ESP32 Transmitting:", json.dumps(payload_h01_crit, indent=2))
    status_code, data = post_telemetry(payload_h01_crit)
    print("\nAPI Response Code:", status_code)
    display_actuators(data)

    assert status_code == 200
    assert data["buzzer"] is True, "Buzzer must be triggered when any asset is critical"
    assert data["actuators"]["H01"]["status"] == "CRITICAL"
    assert data["actuators"]["H01"]["led_safe"] is False
    assert data["actuators"]["H01"]["led_critical"] is True
    assert data["actuators"]["B17"]["status"] == "SAFE"
    assert data["actuators"]["B17"]["led_safe"] is True
    assert data["top_priority"] == "H01"
    print(f"{GREEN}[PASS] TEST 2: H01 water level surge triggered buzzer and critical LED.{RESET}")

    # ==========================================
    # TEST 3: B17 CRITICAL (Rise Rate >= 1.0 cm/min)
    # ==========================================
    print_header("TEST 3: Bridge B17 Flash Flood Rise Rate (rise_rate_cm_min >= 1.0)")
    payload_b17_crit = {
        "device_id": "ORACLE-ESP32-01",
        "readings": [
            {
                "sensor_id": "SNS-H01",
                "asset_id": "H01",
                "water_level_cm": 12.0,
                "rise_rate_cm_min": 0.2
            },
            {
                "sensor_id": "SNS-B17",
                "asset_id": "B17",
                "water_level_cm": 14.5,
                "rise_rate_cm_min": 1.6  # Exceeds 1.0 threshold -> CRITICAL
            }
        ]
    }
    print("ESP32 Transmitting:", json.dumps(payload_b17_crit, indent=2))
    status_code, data = post_telemetry(payload_b17_crit)
    print("\nAPI Response Code:", status_code)
    display_actuators(data)

    assert status_code == 200
    assert data["buzzer"] is True
    assert data["actuators"]["B17"]["status"] == "CRITICAL"
    assert data["actuators"]["B17"]["led_safe"] is False
    assert data["actuators"]["B17"]["led_critical"] is True
    assert data["actuators"]["H01"]["status"] == "SAFE"
    assert data["actuators"]["H01"]["led_safe"] is True
    print(f"{GREEN}[PASS] TEST 3: B17 rise rate flash surge triggered buzzer and critical LED.{RESET}")

    # ==========================================
    # TEST 4: BOTH CRITICAL - PRIORITY RANKING
    # ==========================================
    print_header("TEST 4: Double Critical Surge - Verifying Priority Ranking Formula")
    # Score formula: (water_level_cm * 0.4) + (rise_rate_cm_min * 0.2) + (criticality * 40.0)
    # H01: (20.0 * 0.4) + (1.2 * 0.2) + (0.95 * 40.0) = 8.0 + 0.24 + 38.0 = 46.24
    # B17: (19.0 * 0.4) + (1.5 * 0.2) + (0.75 * 40.0) = 7.6 + 0.30 + 30.0 = 37.90
    payload_double_crit = {
        "device_id": "ORACLE-ESP32-01",
        "readings": [
            {
                "sensor_id": "SNS-H01",
                "asset_id": "H01",
                "water_level_cm": 20.0,
                "rise_rate_cm_min": 1.2
            },
            {
                "sensor_id": "SNS-B17",
                "asset_id": "B17",
                "water_level_cm": 19.0,
                "rise_rate_cm_min": 1.5
            }
        ]
    }
    print("ESP32 Transmitting:", json.dumps(payload_double_crit, indent=2))
    status_code, data = post_telemetry(payload_double_crit)
    print("\nAPI Response Code:", status_code)
    display_actuators(data)

    assert status_code == 200
    assert data["buzzer"] is True
    assert data["actuators"]["H01"]["status"] == "CRITICAL"
    assert data["actuators"]["B17"]["status"] == "CRITICAL"
    assert data["top_priority"] == "H01", f"Expected H01 to rank top priority, got {data['top_priority']}"
    print(f"{GREEN}[PASS] TEST 4: Dual critical event correctly prioritized H01 based on criticality formula.{RESET}")

    # ==========================================
    # DATABASE PERSISTENCE VERIFICATION
    # ==========================================
    print_header("DATABASE PERSISTENCE VERIFICATION (SQLite)")
    db = SessionLocal()
    recent = db.query(TelemetryReading).order_by(TelemetryReading.id.desc()).limit(8).all()
    print(f"Found {len(recent)} stored telemetry readings. Last 4 records:")
    for r in recent[:4]:
        print(f"  [ID {r.id}] Device: {r.device_id} | Sensor: {r.sensor_id} | Asset: {r.asset_id} | Level: {r.water_level_cm}cm | Rate: {r.rise_rate_cm_min}cm/min | Score: {r.priority_score:.2f} | Status: {r.status}")
    db.close()
    assert len(recent) >= 8, "Expected at least 8 readings written across tests"
    print(f"\n{BOLD}{GREEN}{'='*65}{RESET}")
    print(f"{BOLD}{GREEN} ALL TESTS PASSED! STEP 1 HARDWARE FEEDBACK LOOP IS OPERATIONAL.{RESET}")
    print(f"{BOLD}{GREEN}{'='*65}{RESET}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ORACLE Edge Mock ESP32 Test Script")
    parser.add_argument("--url", type=str, default=None, help="Base URL of running server (e.g. http://localhost:8000)")
    parser.add_argument("--live", action="store_true", help="Test against http://localhost:8000")
    args = parser.parse_args()

    target_url = "http://localhost:8000" if args.live else args.url
    run_tests(target_url)
